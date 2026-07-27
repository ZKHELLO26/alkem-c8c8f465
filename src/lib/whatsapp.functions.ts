// Sends the "face_scan" WhatsApp template via Interakt after a scan.
// The PDF is uploaded server-side (using the service role) into a fully
// private bucket, then a short-lived signed URL is minted and passed to
// Interakt. The browser never touches the bucket directly, so the bucket
// has no anon/authenticated policies at all.
import { createServerFn } from "@tanstack/react-start";

type SendInput = {
  name: string;
  countryCode: string; // "+91" or "91"
  mobile: string;      // digits only
  pdfBase64: string;   // raw base64 (no data: prefix)
  fileName?: string;
};

const BUCKET = "whatsapp-reports";
const SIGNED_URL_TTL_SEC = 60 * 60 * 24;

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const sendWhatsappReport = createServerFn({ method: "POST" })
  .inputValidator((input: SendInput) => {
    if (!input || typeof input !== "object") throw new Error("Invalid payload");
    const { name, countryCode, mobile, pdfBase64 } = input;
    if (!name || !countryCode || !mobile || !pdfBase64) throw new Error("Missing fields");
    if (pdfBase64.length > 8_000_000) throw new Error("PDF too large");
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.INTERAKT_API_KEY;
    if (!apiKey) throw new Error("INTERAKT_API_KEY is not configured");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const safeName = (data.name || "user").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40);
    const rand = crypto.randomUUID();
    const path = `${new Date().toISOString().slice(0, 10)}/${safeName}-${rand}.pdf`;

    const bytes = base64ToUint8Array(data.pdfBase64);
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) {
      console.error("[whatsapp] upload failed:", upErr);
      return { ok: false as const, status: 500, error: "upload_failed" };
    }

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SEC);
    if (sErr || !signed?.signedUrl) {
      console.error("[whatsapp] sign failed:", sErr);
      return { ok: false as const, status: 500, error: "sign_failed" };
    }

    const cc = data.countryCode.startsWith("+")
      ? data.countryCode
      : `+${data.countryCode.replace(/\D/g, "")}`;
    const phone = data.mobile.replace(/\D/g, "");
    const firstName = (data.name || "there").trim().split(/\s+/)[0];

    const body = {
      countryCode: cc,
      phoneNumber: phone,
      callbackData: "face_scan_report",
      type: "Template",
      template: {
        name: "face_scan",
        languageCode: "en",
        headerValues: [signed.signedUrl],
        fileName: data.fileName || "Wellness-Report.pdf",
        bodyValues: [firstName],
      },
    };

    const res = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`[interakt] ${res.status}: ${text}`);
      return { ok: false as const, status: res.status, error: text };
    }
    return { ok: true as const, status: res.status, response: text };
  });
