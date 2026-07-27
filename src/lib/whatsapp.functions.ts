import { createServerFn } from "@tanstack/react-start";

export const processQueuedWhatsappReports = createServerFn({ method: "POST" }).handler(async () => {
  const { processReportQueue } = await import("./whatsapp-worker");
  return processReportQueue(5);
});

