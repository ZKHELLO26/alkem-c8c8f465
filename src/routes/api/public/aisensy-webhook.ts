import { createFileRoute } from "@tanstack/react-router";

/**
 * Receives AiSensy's delivery status callbacks (delivered / read / failed)
 * so report_queue can show the REAL outcome, not just "we handed this off
 * to AiSensy". Enable this in AiSensy's dashboard: Project Settings →
 * Webhooks → paste this endpoint's URL, turn on the toggle. No coding
 * needed on AiSensy's side.
 *
 * IMPORTANT — read before relying on this: AiSensy's exact webhook field
 * names couldn't be confirmed from their public docs (the reference page
 * is JavaScript-only and not readable by automated tools). So this parses
 * DEFENSIVELY — it tries several likely field names for the message id
 * and status, and ALWAYS saves the complete raw payload regardless of
 * whether parsing succeeds. After the very first real message status
 * comes in, check the `raw_webhook_payload` column in `report_queue` to
 * see AiSensy's actual field names — if the guessed names below don't
 * match, that column tells us exactly what to fix, in one small edit.
 */
export const Route = createFileRoute("/api/public/aisensy-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Optional shared-secret via URL query (?key=...), since most
        // webhook providers' UI only lets you paste a URL, not add custom
        // headers. If AISENSY_WEBHOOK_SECRET isn't set, this is skipped —
        // safe default so the first real test isn't blocked on a secret
        // neither side has configured yet.
        const url = new URL(request.url);
        const configuredSecret = process.env.AISENSY_WEBHOOK_SECRET;
        if (configuredSecret && url.searchParams.get("key") !== configuredSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "not_json" }, { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const b = (body ?? {}) as Record<string, unknown>;

        // Try several likely shapes/field names defensively — WhatsApp
        // Business API status callbacks commonly nest under
        // entry[0].changes[0].value.statuses[0], while simpler providers
        // send a flat object. Cover both without assuming either is right.
        const flat = b;
        const nested =
          (((b.entry as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined)
            ?.changes as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
        const value = (nested?.value as Record<string, unknown> | undefined) ?? {};
        const statusObj =
          ((value.statuses as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined) ??
          flat;

        const messageId =
          (statusObj?.id as string | undefined) ??
          (statusObj?.messageId as string | undefined) ??
          (statusObj?.message_id as string | undefined) ??
          (flat.id as string | undefined) ??
          (flat.messageId as string | undefined) ??
          null;

        const status =
          (statusObj?.status as string | undefined) ??
          (flat.status as string | undefined) ??
          (flat.event as string | undefined) ??
          null;

        const errorDetail =
          (statusObj?.errors as unknown[] | undefined)?.[0]
            ? JSON.stringify((statusObj!.errors as unknown[])[0])
            : undefined;
        const reason: string | null =
          errorDetail ??
          (flat.reason as string | undefined) ??
          (flat.failureReason as string | undefined) ??
          null;

        // Always keep the raw payload — this is what lets us fix field
        // names quickly if the guesses above don't match reality, without
        // losing any data in the meantime.
        if (messageId) {
          await supabaseAdmin
            .from("report_queue")
            .update({
              delivery_status: status,
              delivery_detail: reason,
              delivery_updated_at: new Date().toISOString(),
              raw_webhook_payload: body as never,
            })
            .eq("provider_message_id", messageId);
        } else {
          // Couldn't identify which report this belongs to — still log it
          // so nothing is silently lost; check this row's payload to find
          // the right field name, then this branch won't be needed.
          await supabaseAdmin.from("report_queue").insert({
            scan_id: `webhook-unmatched-${Date.now()}`,
            status: "pending",
            last_error: "unmatched_webhook_payload",
            raw_webhook_payload: body as never,
          }).select().maybeSingle();
        }

        return Response.json({ ok: true });
      },
    },
  },
});
