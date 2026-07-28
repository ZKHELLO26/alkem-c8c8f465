// The "phone tries first" fast path for WhatsApp report delivery.
//
// Why this file exists: generating a PDF (font loading, drawing) takes
// real CPU time. Doing that on the SERVER for every single scan is real,
// avoidable cost. Instead, the person's own phone generates the branded
// PDF itself (their own CPU, free to us) and only asks the server to
// upload + send it — a cheap network call, not a compute-heavy one.
//
// If this fails for any reason (network hiccup, tab closed too early),
// nothing is lost: the database's own safety-net queue (report_queue,
// created durably the instant the scan was saved) still has the job.
// The scheduled server worker picks it up automatically about 75 seconds
// later and finishes the job itself — that fallback is the only path
// that costs real server compute, and it only runs for the exceptions.
//
// Runs entirely silently — no on-screen indicator, by design, so a
// failure here is never visible or confusing to the person scanning.
import { generateReportPdf, type PdfParam } from "./report-pdf";
import { buildRawParams } from "./build-report-params";
import { sendWhatsappReportNow } from "./whatsapp.functions";
import { loadScanId, wellnessLabel, type ScanResults, type UserDetails } from "./scan-store";

let attemptedFor: string | null = null;

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

export async function tryDeliverReportFromThisDevice(
  details: UserDetails,
  results: ScanResults,
): Promise<void> {
  if (!details.mobile || !details.countryCode) return;
  const scanId = loadScanId();
  if (!scanId) return; // no stable id yet — the server-side fallback still has the queue row
  if (attemptedFor === scanId) return; // quick local skip; real safety is the DB's atomic claim
  attemptedFor = scanId;

  try {
    const rawParams = buildRawParams(results, details.age);
    const pdfParams: PdfParam[] = rawParams.map(({ id: _id, ...rest }) => rest);

    const out = await generateReportPdf(
      details,
      results,
      pdfParams,
      wellnessLabel(results.wellnessScore),
      { returnBlob: true },
    );
    if (!out) return;
    const { blob, filename } = out;
    const pdfBase64 = await blobToBase64(blob);

    await sendWhatsappReportNow({
      data: { scanId, pdfBase64, fileName: filename },
    });
    // Whether this returned ok:true or ok:false, we do nothing further —
    // silent by design. A false result just means the scheduled worker
    // will finish the job shortly; no retry loop needed on this end.
  } catch (e) {
    // Swallowed on purpose — same reasoning as above. The database-backed
    // queue (created the instant the scan saved) is the real safety net.
    console.warn("[whatsapp] on-device attempt failed, server fallback will handle it:", e);
  }
}

