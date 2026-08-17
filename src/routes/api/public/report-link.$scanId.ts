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
 * URL right then and redirects to it. The report itself is never
 * actually deleted, so this always works, no matter how long ago the
 * message was sent.
 */
const SHORT_TTL_SEC = 5 * 60; // just enough time to complete the redirect + download

export const Route = createFileRoute("/api/public/report-link/$scanId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row, error } = await supabaseAdmin
          .from("report_queue")
          .select("pdf_path, name")
          .eq("scan_id", params.scanId)
          .maybeSingle();

        if (error || !row?.pdf_path) {
          return new Response(
            "This report isn't ready yet, or the link is incorrect. Please try again in a minute, or contact support.",
            { status: 404, headers: { "Content-Type": "text/plain" } },
          );
        }

        const { data: signed, error: signError } = await supabaseAdmin.storage
          .from("whatsapp-reports")
          .createSignedUrl(row.pdf_path, SHORT_TTL_SEC);

        if (signError || !signed?.signedUrl) {
          return new Response("Couldn't open this report right now. Please try again shortly.", {
            status: 500,
            headers: { "Content-Type": "text/plain" },
          });
        }

        return new Response(null, { status: 302, headers: { Location: signed.signedUrl } });
      },
    },
  },
});
