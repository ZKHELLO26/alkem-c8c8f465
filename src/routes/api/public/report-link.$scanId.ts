import { createFileRoute } from "@tanstack/react-router";

/**
 * THE FIX for "InvalidJWT — exp claim timestamp check failed".
 *
 * Root cause (confirmed): the PDF link sent in the WhatsApp message was a
 * Supabase Storage SIGNED URL with a 24-hour expiry, baked in at the
 * moment the message was sent. WhatsApp messages sit in someone's phone
 * (and in AiSensy's own dashboard history) indefinitely — so ANY fixed
 * expiry eventually breaks, whether it's 24 hours or 24 days. Extending
 * the timer only delays the same bug, it doesn't fix it.
 *
 * The real fix: never send a link that can expire. Instead, send a link
 * to THIS endpoint (which never expires, because it doesn't need to
 * expire) — every time someone clicks it, it mints a BRAND NEW signed
 * URL right then and redirects to it.
 *
 * UPDATED: the underlying file can now be purged from storage after a
 * retention window (see PURGE_OLD_REPORTS.sql) to control storage size —
 * so this endpoint is now self-healing: if the file is missing, it
 * silently rebuilds the exact same PDF from the permanent JSON data
 * already sitting in `report_queue.report_payload` (which is NEVER
 * deleted by the purge job), re-uploads it, and continues as normal.
 * The person clicking the link never sees any difference either way.
 */
const SHORT_TTL_SEC = 5 * 60; // just enough time to complete the redirect + download

export const Route = createFileRoute("/api/public/report-link/$scanId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row, error } = await supabaseAdmin
          .from("report_queue")
          .select("scan_id, pdf_path, name, country_code, mobile, report_payload")
          .eq("scan_id", params.scanId)
          .maybeSingle();

        if (error || !row?.pdf_path) {
          return new Response(
            "This report isn't ready yet, or the link is incorrect. Please try again in a minute, or contact support.",
            { status: 404, headers: { "Content-Type": "text/plain" } },
          );
        }

        let signed = await supabaseAdmin.storage
          .from("whatsapp-reports")
          .createSignedUrl(row.pdf_path, SHORT_TTL_SEC);

        // File missing (most likely purged by the retention job) — rebuild
        // it fresh from the permanent JSON and re-upload to the same path,
        // then retry the signed URL once.
        if (signed.error || !signed.data?.signedUrl) {
          try {
            const { pdfBytes } = await import("@/lib/whatsapp-worker");
            const { bytes } = await pdfBytes(row);
            const { error: reuploadError } = await supabaseAdmin.storage
              .from("whatsapp-reports")
              .upload(row.pdf_path, bytes, { contentType: "application/pdf", upsert: true });
            if (!reuploadError) {
              signed = await supabaseAdmin.storage
                .from("whatsapp-reports")
                .createSignedUrl(row.pdf_path, SHORT_TTL_SEC);
            }
          } catch (rebuildError) {
            console.error("[report-link] rebuild-on-demand failed", rebuildError);
          }
        }

        if (signed.error || !signed.data?.signedUrl) {
          return new Response("Couldn't open this report right now. Please try again shortly.", {
            status: 500,
            headers: { "Content-Type": "text/plain" },
          });
        }

        return new Response(null, { status: 302, headers: { Location: signed.data.signedUrl } });
      },
    },
  },
});

