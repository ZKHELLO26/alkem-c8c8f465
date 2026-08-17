import type { Json } from "@/integrations/supabase/types";

const BUCKET = "whatsapp-reports";
const SIGNED_URL_TTL_SEC = 60 * 60 * 24;
// The app's own public address, used to build a link that NEVER expires
// itself (see /api/public/report-link/$scanId) — this is what actually
// gets sent in the WhatsApp message now, instead of a raw signed URL.
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
};

type ReportPayload = {
  details?: ReportDetails;
  results?: Record<string, unknown>;
  answers?: Record<string, unknown>;
};

type QueueRow = {
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

async function pdfBytes(row: QueueRow): Promise<{ bytes: Uint8Array; filename: string }> {
  // Uses the exact same branded template + parameter logic as the on-screen
  // /results page (report-pdf.ts + build-report-params.ts), so the WhatsApp
  // PDF always looks identical to what the person saw on their phone —
  // never the plain fallback layout.
  const { generateReportPdf } = await import("./report-pdf");
  const { buildRawParams } = await import("./build-report-params");
  const { wellnessLabel } = await import("./scan-store");

  const payload = asPayload(row.report_payload);
  const details = payload.details ?? {};
  const results = (payload.results ?? {}) as Record<string, number | string>;
  const age = typeof details.age === "number" ? details.age : 30;

  const fullResults = results as unknown as Parameters<typeof buildRawParams>[0];
  const rawParams = buildRawParams(fullResults, age);
  const pdfParams = rawParams.map((p) => {
    const { id: _id, ...rest } = p;
    void _id;
    return rest;
  });
  const score = typeof results.wellnessScore === "number" ? results.wellnessScore : 0;

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

/**
 * Uploads already-made PDF bytes, sends via Interakt, and finalizes the
 * queue row. This is the "cheap" half — no PDF drawing/font-loading here,
 * so it costs almost nothing regardless of whether the bytes came from
 * the person's own phone (fast path) or were generated on the server
 * (fallback path below).
 */
async function deliverBytes(
  admin: AdminClient,
  row: QueueRow,
  bytes: Uint8Array,
  filename: string,
): Promise<boolean> {
  // AiSensy (replaces Interakt as of Aug 1 launch).
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
  // THE FIX for "InvalidJWT / exp claim" errors people saw days after
  // receiving their report: don't send the raw signed URL above (it dies
  // after SIGNED_URL_TTL_SEC, no matter how long that's set to). Send a
  // link to our own stable redirect endpoint instead — it never expires
  // itself, because every click mints a brand-new signed URL right then.
  const stableReportUrl = `${APP_BASE_URL}/api/public/report-link/${row.scan_id}`;

  // AiSensy wants the full number (country code + number) with NO "+".
  const countryDigits = (row.country_code ?? "+91").replace(/\D/g, "") || "91";
  const localDigits = (row.mobile ?? "").replace(/\D/g, "");
  const destination = `${countryDigits}${localDigits}`;
  const firstName = (row.name ?? "there").trim().split(/\s+/)[0] || "there";

  // AiSensy rejects a send with "Template params does not match the campaign"
  // when the number of {{n}} variables we send differs from the approved
  // template. The exact count differs per template, so:
  //  1. If AISENSY_TEMPLATE_PARAMS is set (comma-separated, supports the
  //     placeholders {{name}} and {{first_name}}), use exactly that.
  //  2. Otherwise try the plausible shapes in order until one is accepted.
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
    : // The approved "wellness_report" template reads:
      //   "Hello {{1}}, Your {{2}} report is ready." -> 2 variables.
      [[firstName, "Face Scan"], [firstName], [], [firstName, firstName, firstName]];

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
        // Only a param-count mismatch is worth retrying with another shape.
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
      console.log(
        `[whatsapp] aisensy accepted ${row.scan_id} with ${templateParams.length} template param(s)`,
      );
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


/**
 * Fallback path (run by the scheduled cron worker only): generates the
 * branded PDF on the server from the stored payload — the expensive part
 * — then hands off to the shared cheap upload/send logic above. This only
 * runs for scans the person's own phone didn't manage to send itself.
 */
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

/**
 * The "phone tries first" fast path. The phone has ALREADY generated the
 * branded PDF itself (using its own CPU, for free) and just needs this
 * server call to: claim the queue row, upload the phone's PDF, and send
 * it via Interakt. No PDF drawing happens here — that's the whole point.
 * If this never gets called (browser closed too early) or fails, the
 * row is simply left claimed-then-failed (or still pending), and the
 * scheduled worker's `deliver()` above generates the PDF server-side as
 * the fallback ~75 seconds later — that's the only path that costs real
 * server compute, and only for the exceptions.
 */
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
  if (rows.length === 0) return false; // already sent, or already being handled elsewhere
  return deliverBytes(admin, rows[0], pdfBytes, filename);
}
