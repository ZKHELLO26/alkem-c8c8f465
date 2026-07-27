// Generates the PDF report and asks the server to queue + deliver it via
// Interakt. Real duplicate-prevention now lives in the database (report_queue,
// keyed on scan_id) — this file's own guard is just a fast local skip, not
// the safety mechanism, so a page reload or flaky network can no longer
// cause a missed or doubled report.
import { generateReportPdf, type PdfParam } from "./report-pdf";
import { sendWhatsappReport, retryQueuedReports } from "./whatsapp.functions";
import { loadScanId } from "./scan-store";
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
): Promise<boolean> {
  if (!details.mobile || !details.countryCode) return false;
  const scanId = loadScanId();
  if (!scanId) return false; // no stable id yet — nothing safe to key the queue on
  if (sentFor === scanId) return true; // quick local skip, not the real guard
  sentFor = scanId;

  try {
    const out = await generateReportPdf(
      details,
      results,
      orderedParams,
      wellnessLabel(results.wellnessScore),
      { returnBlob: true },
    );
    if (!out) {
      sentFor = null;
      return false;
    }
    const { blob, filename } = out;
    const pdfBase64 = await blobToBase64(blob);

    const res = await sendWhatsappReport({
      data: {
        scanId,
        name: details.name,
        countryCode: details.countryCode,
        mobile: details.mobile,
        pdfBase64,
        fileName: filename,
        orgCode: details.orgCode,
      },
    });
    if (!res?.ok) {
      // Not a dead end anymore: this attempt is recorded as "failed" in the
      // database and will be retried automatically (see below) — no manual
      // action needed, and no risk of it silently vanishing.
      console.warn("[whatsapp] send failed, will auto-retry later:", res);
      sentFor = null;
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[whatsapp] send failed, will auto-retry later:", e);
    sentFor = null;
    return false;
  } finally {
    // Piggyback: while we're here, nudge along any other camp attendee's
    // report that failed earlier. Cheap, fire-and-forget, self-healing —
    // no separate scheduler/cron needed.
    retryQueuedReports().catch(() => {});
  }
}
