import type { Json } from "@/integrations/supabase/types";

const BUCKET = "whatsapp-reports";
const SIGNED_URL_TTL_SEC = 60 * 60 * 24;
const APP_BASE_URL = process.env.APP_BASE_URL || "https://facescan.ap.zeikonglobal.com";

type ReportDetails = {
  name?: string;
  email?: string;
  countryCode?: string;
  mobile?: string;
  age?: number;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  waistIn?: number;
  doctorName?: string;
  employeeName?: string;
  // Already present in every row the trigger writes (enqueue_scan_report
  // includes 'scanType', NEW.scan_type) — this fix just starts reading it.
  scanType?: string;
};

type ReportPayload = {
  details?: ReportDetails;
  results?: Record<string, unknown>;
  answers?: Record<string, unknown>;
};

export type QueueRow = {
  id: string;
  scan_id: string;
  name: string | null;
  country_code: string | null;
  mobile: string | null;
  report_payload: Json | null;
};

type AdminClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  storage: {
    from: (bucket: string) => {
      upload: (path: string, bytes: Uint8Array, options: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      createSignedUrl: (path: string, ttl: number) => Promise<{ data: { signedUrl?: string } | null; error: { message: string } | null }>;
    };
  };
};

function asPayload(value: Json | null): ReportPayload {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value as ReportPayload;
}

/**
 * Builds the Face Scan report PDF for a queued job.
 */
export async function pdfBytes(row: QueueRow): Promise<{ bytes: Uint8Array; filename: string }> {
  const payload = asPayload(row.report_payload);
  const details = payload.details ?? {};
  const results = (payload.results ?? {}) as Record<string, unknown>;



  // Unchanged for everything else (Face Scan, and anything without a
  // recognized scanType) — exactly the original behavior, byte-for-byte.
  const { generateReportPdf } = await import("./report-pdf");
  const { buildRawParams } = await import("./build-report-params");
  const { wellnessLabel } = await import("./scan-store");

  const faceResults = results as Record<string, number | string>;
  const age = typeof details.age === "number" ? details.age : 30;

  const fullResults = faceResults as unknown as Parameters<typeof buildRawParams>[0];
  const rawParams = buildRawParams(fullResults, age);
  const pdfParams = rawParams.map((p) => {
    const { id: _id, ...rest } = p;
    void _id;
    return rest;
  });
  const score = typeof faceResults.wellnessScore === "number" ? faceResults.wellnessScore : 0;

  const userDetails = {
    name: details.name ?? row.name ?? "Participant",
    email: details.email ?? "",
    countryCode: details.countryCode ?? row.country_code ?? "",
    mobile: details.mobile ?? row.mobile ?? "",
    heightCm: details.heightCm ?? 0,
    weightKg: details.weightKg ?? 0,
    waistIn: details.waistIn ?? 0,
    age,
    sex: (details.sex as "M" | "F" | "") ?? "",
    doctorName: details.doctorName,
    employeeName: details.employeeName,
  } as unknown as Parameters<typeof generateReportPdf>[0];

  const out = await generateReportPdf(userDetails, fullResults, pdfParams, wellnessLabel(score), { returnBlob: true });
  if (!out) throw new Error("PDF generation returned nothing");

  const arrayBuf = await out.blob.arrayBuffer();
  const safeName = (details.name ?? row.name ?? "user").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40);
  return {
    bytes: new Uint8Array(arrayBuf),
    filename: out.filename || `VitalScan-Report-${safeName}.pdf`,
  };
}

async function finish(
  admin: AdminClient,
  row: QueueRow,
  ok: boolean,
  path?: string,
  error?: string,
  providerMessageId?: string,
) {
  const { error: rpcError } = await admin.rpc("complete_report_job", {
    p_id: row.id,
    p_ok: ok,
    p_pdf_path: path ?? null,
    p_error: error ?? null,
    p_provider_message_id: providerMessageId ?? null,
  });
  if (rpcError) console.error(`[whatsapp] could not finalize ${row.scan_id}: ${rpcError.message}`);
}

async function deliverBytes(
  admin: AdminClient,
  row: QueueRow,
  bytes: Uint8Array,
  filename: string,
): Promise<boolean> {
  const apiKey = process.env.AISENSY_API_KEY;
  const campaignName = process.env.AISENSY_CAMPAIGN_NAME;
  if (!apiKey || !campaignName) {
    await finish(admin, row, false, undefined, "AISENSY_API_KEY or AISENSY_CAMPAIGN_NAME is not configured");
    return false;
  }

  const safeName = (row.name ?? "user").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40);
  const path = `${new Date().toISOString().slice(0, 10)}/${safeName}-${row.scan_id}.pdf`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadError) {
    await finish(admin, row, false, undefined, `upload_failed: ${uploadError.message}`);
    return false;
  }

  const { data: signed, error: signedError } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (signedError || !signed?.signedUrl) {
    await finish(admin, row, false, path, `sign_failed: ${signedError?.message ?? "unknown"}`);
    return false;
  }
  const stableReportUrl = `${APP_BASE_URL}/api/public/report-link/${row.scan_id}`;

  const countryDigits = (row.country_code ?? "+91").replace(/\D/g, "") || "91";
  const localDigits = (row.mobile ?? "").replace(/\D/g, "");
  const destination = `${countryDigits}${localDigits}`;
  const firstName = (row.name ?? "there").trim().split(/\s+/)[0] || "there";

  const configured = process.env.AISENSY_TEMPLATE_PARAMS;
  const candidates: string[][] = configured
    ? [
        configured
          .split(",")
          .map((p) =>
            p
              .trim()
              .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
              .replace(/\{\{\s*name\s*\}\}/gi, row.name ?? "there"),
          ),
      ]
    : [[firstName, "Face Scan"], [firstName], [], [firstName, firstName, firstName]];

  let lastStatus = 0;
  let lastBody = "";

  try {
    for (const templateParams of candidates) {
      const response = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          campaignName,
          destination,
          userName: row.name ?? "there",
          source: "face-scan-report",
          media: { url: stableReportUrl, filename },
          templateParams,
          tags: ["face_scan_report"],
          attributes: { scan_id: row.scan_id },
        }),
      });
      const responseText = await response.text();
      if (!response.ok) {
        lastStatus = response.status;
        lastBody = responseText;
        if (/template params/i.test(responseText)) continue;
        break;
      }
      let providerMessageId: string | undefined;
      try {
        const parsed = JSON.parse(responseText) as { id?: string; messageId?: string };
        providerMessageId = parsed.id ?? parsed.messageId;
      } catch {
        providerMessageId = undefined;
      }
      console.log(`[whatsapp] aisensy accepted ${row.scan_id} with ${templateParams.length} template param(s)`);
      await finish(admin, row, true, path, undefined, providerMessageId);
      return true;
    }
    await finish(admin, row, false, path, `aisensy_${lastStatus}: ${lastBody.slice(0, 500)}`);
    return false;
  } catch (error) {
    await finish(admin, row, false, path, `network: ${String(error)}`);
    return false;
  }
}

async function deliver(admin: AdminClient, row: QueueRow): Promise<boolean> {
  let generated: Awaited<ReturnType<typeof pdfBytes>>;
  try {
    generated = await pdfBytes(row);
  } catch (error) {
    await finish(admin, row, false, undefined, `pdf_failed: ${String(error)}`);
    return false;
  }
  return deliverBytes(admin, row, generated.bytes, generated.filename);
}

export async function processReportQueue(limit = 5): Promise<{ claimed: number; sent: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as AdminClient;
  const { data, error } = await admin.rpc("claim_report_jobs", { p_limit: limit });
  if (error) throw new Error(`Queue claim failed: ${error.message}`);
  const rows = Array.isArray(data) ? data as QueueRow[] : [];
  const outcomes = await Promise.all(rows.map((row) => deliver(admin, row)));
  return { claimed: rows.length, sent: outcomes.filter(Boolean).length };
}

export async function processScanNow(
  scanId: string,
  pdfBytes: Uint8Array,
  filename: string,
): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as AdminClient;
  const { data, error } = await admin.rpc("claim_report_job_for_scan", { p_scan_id: scanId });
  if (error) throw new Error(`Claim failed: ${error.message}`);
  const rows = Array.isArray(data) ? data as QueueRow[] : [];
  if (rows.length === 0) return false;
  return deliverBytes(admin, rows[0], pdfBytes, filename);
}
