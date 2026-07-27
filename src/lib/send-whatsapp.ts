// Generates the PDF report, encodes it, and asks the server function to
// upload it (via service role) into the private bucket, sign it, and send
// the "face_scan" WhatsApp template through Interakt. The browser has NO
// direct access to the storage bucket.
import { generateReportPdf, type PdfParam } from "./report-pdf";
import { sendWhatsappReport } from "./whatsapp.functions";
import { wellnessLabel, type ScanResults, type UserDetails } from "./scan-store";

let sentFor: string | null = null;

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
    );
  }
  return btoa(binary);
}

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
    const pdfBase64 = await blobToBase64(blob);

    const res = await sendWhatsappReport({
      data: {
        name: details.name,
        countryCode: details.countryCode,
        mobile: details.mobile,
        pdfBase64,
        fileName: filename,
      },
    });
    if (!res?.ok) {
      console.warn("[whatsapp] interakt returned non-ok:", res);
      sentFor = null;
    }
  } catch (e) {
    console.warn("[whatsapp] send failed:", e);
    sentFor = null;
  }
}
