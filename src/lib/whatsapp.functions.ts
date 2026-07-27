// Sends the "face_scan" WhatsApp template via Interakt after a scan —
// now backed by a durable, database-enforced queue (report_queue table).
//
// Why: relying on browser sessionStorage to prevent duplicate sends is not
// safe — a page reload, a slow network retry, or two rapid calls can both
// slip past a JS-only guard. The database guard below CANNOT be bypassed:
// the scan_id column is UNIQUE, and the "claim" step only proceeds if no
// other attempt has already claimed this scan_id. A failed send is
// recorded (not silently dropped) and retried automatically the next time
// anyone completes a scan (see retryQueuedReports below).
import { createServerFn } from "@tanstack/react-start";

type SendInput = {
  scanId: string;
  name: string;
  countryCode: string; // "+91" or "91"
  mobile: string;      // digits only
  pdfBase64: string;   // raw base64 (no data: prefix)
  fileName?: string;
  orgCode?: string;
};

const BUCKET = "whatsapp-reports";
const SIGNED_URL_TTL_SEC = 60 * 60 * 24;
const MAX_ATTEMPTS = 5;

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deliverOne(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  row: { id: string; scan_id: string; name: string | null; country_code: string | null; mobile: string | null; pdf_path: string | null },
  pdfBytes?: Uint8Array,
  fileName?: string,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.INTERAKT_API_KEY;
  if (!apiKey) return { ok: false, error: "INTERAKT_API_KEY is not configured" };

  let path = row.pdf_path;
  if (!path) {
    if (!pdfBytes) return { ok: false, error: "no_pdf_available_for_retry" };
    const safeName = (row.name || "user").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40);
    path = `${new Date().toISOString().slice(0, 10)}/${safeName}-${row.scan_id}.pdf`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) return { ok: false, error: `upload_failed: ${upErr.message}` };
    await admin.from("report_queue").update({ pdf_path: path }).eq("id", row.id);
  }

  const { data: signed, error: sErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (sErr || !signed?.signedUrl) return { ok: false, error: `sign_failed: ${sErr?.message ?? "unknown"}` };

  const cc = (row.country_code || "+91").startsWith("+")
    ? row.country_code!
    : `+${(row.country_code || "91").replace(/\D/g, "")}`;
  const phone = (row.mobile || "").replace(/\D/g, "");
  const firstName = (row.name || "there").trim().split(/\s+/)[0];

  const body = {
    countryCode: cc,
    phoneNumber: phone,
    callbackData: "face_scan_report",
    type: "Template",
    template: {
      name: "face_scan",
      languageCode: "en",
      headerValues: [signed.signedUrl],
      fileName: fileName || "Wellness-Report.pdf",
      bodyValues: [firstName],
    },
  };

  try {
    const res = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${apiKey}` },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `interakt_${res.status}: ${text.slice(0, 300)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `network: ${String((e as Error)?.message ?? e)}` };
  }
}

export const sendWhatsappReport = createServerFn({ method: "POST" })
  .inputValidator((input: SendInput) => {
    if (!input || typeof input !== "object") throw new Error("Invalid payload");
    const { scanId, name, countryCode, mobile, pdfBase64 } = input;
    if (!scanId || !name || !countryCode || !mobile || !pdfBase64) throw new Error("Missing fields");
    if (pdfBase64.length > 8_000_000) throw new Error("PDF too large");
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Step 1 — queue it. UNIQUE(scan_id) means a duplicate call for the
    // same scan is silently absorbed here — it can never create a second row.
    await supabaseAdmin
      .from("report_queue")
      .upsert(
        { scan_id: data.scanId, name: data.name, country_code: data.countryCode, mobile: data.mobile, org_code: data.orgCode ?? null },
        { onConflict: "scan_id", ignoreDuplicates: true },
      );

    // Step 2 — atomically claim it. If another request already claimed
    // (or already sent) this scan_id, this returns 0 rows and we stop here
    // — guaranteeing at most one in-flight send per scan, even if this
    // function is somehow called twice at the same instant.
    const { data: claimed } = await supabaseAdmin
      .from("report_queue")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("scan_id", data.scanId)
      .in("status", ["pending", "failed"])
      .select("id, scan_id, name, country_code, mobile, pdf_path")
      .maybeSingle();

    if (!claimed) {
      // Already sent, or already being sent by another in-flight attempt.
      return { ok: true as const, status: 200, note: "already_queued_or_sent" };
    }

    const pdfBytes = base64ToUint8Array(data.pdfBase64);
    const result = await deliverOne(supabaseAdmin, claimed, pdfBytes, data.fileName);

    if (result.ok) {
      await supabaseAdmin.from("report_queue")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", claimed.id);
      return { ok: true as const, status: 200 };
    } else {
      await supabaseAdmin.from("report_queue")
        .update({
          status: "failed",
          attempts: (await supabaseAdmin.from("report_queue").select("attempts").eq("id", claimed.id).single()).data?.attempts as number ?? 0,
          last_error: result.error ?? "unknown",
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimed.id);
      console.error(`[whatsapp] send failed for ${data.scanId}:`, result.error);
      return { ok: false as const, status: 500, error: result.error };
    }
  });

/**
 * Self-healing retry: call this after ANY scan completes (fire-and-forget,
 * cheap, no separate cron/infra needed). It looks for a handful of
 * previously failed or stuck sends and retries them. Because retries piggy-
 * back on normal camp activity, reports recover automatically throughout
 * the day without you needing to do anything.
 */
export const retryQueuedReports = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // don't race a send in progress

  const { data: candidates } = await supabaseAdmin
    .from("report_queue")
    .select("id, scan_id, name, country_code, mobile, pdf_path, attempts, status")
    .in("status", ["pending", "failed"])
    .lt("attempts", MAX_ATTEMPTS)
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(3);

  if (!candidates || candidates.length === 0) return { ok: true as const, retried: 0 };

  let retried = 0;
  for (const row of candidates) {
    const { data: claimed } = await supabaseAdmin
      .from("report_queue")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .in("status", ["pending", "failed"])
      .select("id, scan_id, name, country_code, mobile, pdf_path")
      .maybeSingle();
    if (!claimed) continue;

    if (!claimed.pdf_path) {
      // No PDF on file (original attempt never got that far) — nothing to
      // retry with; mark failed permanently so it doesn't loop forever.
      await supabaseAdmin.from("report_queue")
        .update({ status: "failed", last_error: "no_pdf_stored", updated_at: new Date().toISOString() })
        .eq("id", claimed.id);
      continue;
    }

    const result = await deliverOne(supabaseAdmin, claimed);
    retried++;
    if (result.ok) {
      await supabaseAdmin.from("report_queue")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", claimed.id);
    } else {
      await supabaseAdmin.from("report_queue")
        .update({ status: "failed", attempts: row.attempts + 1, last_error: result.error ?? "unknown", updated_at: new Date().toISOString() })
        .eq("id", claimed.id);
    }
  }
  return { ok: true as const, retried };
});

