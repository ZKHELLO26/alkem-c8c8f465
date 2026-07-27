import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/report-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Was checking SUPABASE_PUBLISHABLE_KEY — but that key is meant to be
        // public (it's baked into the app's own bundle), so it was no real
        // gate at all. This now requires a real secret that only the
        // scheduled cron job knows, set as REPORT_QUEUE_CRON_SECRET.
        const configuredSecret = process.env.REPORT_QUEUE_CRON_SECRET;
        const suppliedSecret = request.headers.get("x-cron-secret");
        if (!configuredSecret || suppliedSecret !== configuredSecret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { processReportQueue } = await import("@/lib/whatsapp-worker");
        try {
          const result = await processReportQueue(10);
          return Response.json({ ok: true, ...result });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("[whatsapp] scheduled queue run failed", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});