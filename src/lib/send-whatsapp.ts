// Uploads the generated PDF to Supabase Storage, creates a signed URL,
// and asks the Interakt server function to send the "face_scan" WhatsApp
// template with the report attached.
import { supabase } from "@/integrations/supabase/client";
import { generateReportPdf, type PdfParam } from "./report-pdf";
import { sendWhatsappReport } from "./whatsapp.functions";
import { wellnessLabel, type ScanResults, type UserDetails } from "./scan-store";

const BUCKET = "whatsapp-reports";
// Signed URL lifetime — WhatsApp fetches the media once at send time, so a
// day is plenty. Keeping it short-lived means abandoned links auto-expire.
const SIGNED_URL_TTL_SEC = 60 * 60 * 24;

let sentFor: string | null = null;

export async function sendReportToWhatsapp(
  details: UserDetails,
  results: ScanResults,
  orderedParams: PdfParam[],
): Promise<void> {
  if (!details.mobile || !details.countryCode) return;
  const key = `${details.mobile}-${results.wellnessScore}-${details.name}`;
  if (sentFor === key) return;
  sentFor = key;

  try {
    const out = await generateReportPdf(
      details,
      results,
      orderedParams,
      wellnessLabel(results.wellnessScore),
      { returnBlob: true },
    );
    if (!out) return;
    const { blob, filename } = out;

    const safeName = (details.name || "user").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40);
    const path = `${new Date().toISOString().slice(0, 10)}/${safeName}-${Date.now()}.pdf`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "application/pdf", upsert: false });
    if (upErr) throw upErr;

    const { data: signed, error: sErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SEC);
    if (sErr || !signed?.signedUrl) throw sErr ?? new Error("no signed url");

    const res = await sendWhatsappReport({
      data: {
        name: details.name,
        countryCode: details.countryCode,
        mobile: details.mobile,
        pdfUrl: signed.signedUrl,
        fileName: filename,
      },
    });
    if (!res?.ok) {
      console.warn("[whatsapp] interakt returned non-ok:", res);
      sentFor = null; // allow a retry next mount
    }
  } catch (e) {
    console.warn("[whatsapp] send failed:", e);
    sentFor = null;
  }
}
