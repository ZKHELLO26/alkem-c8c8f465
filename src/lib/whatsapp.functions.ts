import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const processQueuedWhatsappReports = createServerFn({ method: "POST" }).handler(async () => {
  const { processReportQueue } = await import("./whatsapp-worker");
  return processReportQueue(5);
});

const ScanReportSchema = z.object({
  scanId: z.string().trim().min(1).max(100),
  pdfBase64: z.string().min(1).max(8_000_000),
  fileName: z.string().max(200).optional(),
});

/**
 * Called immediately by the person's own browser right after their scan
 * completes — the "phone tries first" fast path. The heavy PDF generation
 * already happened on their device for free; this call only uploads it
 * and sends via WhatsApp. Costs almost no server compute. If it fails or
 * the browser closes too soon, the scheduled worker (run every minute by
 * cron) automatically generates the report server-side and sends it,
 * about 75 seconds later — that fallback is the only path with real
 * server cost, and it only runs for the exceptions.
 */
export const sendWhatsappReportNow = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ScanReportSchema.parse(input))
  .handler(async ({ data }) => {
    const { processScanNow } = await import("./whatsapp-worker");
    try {
      const bin = atob(data.pdfBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const sent = await processScanNow(data.scanId, bytes, data.fileName || "Wellness-Report.pdf");
      return { ok: sent };
    } catch (error) {
      // Never throw to the client — the scheduled worker is the safety
      // net, so a failure here is a soft "didn't work this time", not
      // an error the person should ever see.
      console.warn("[whatsapp] client-first attempt failed, worker will retry:", error);
      return { ok: false };
    }
  });

