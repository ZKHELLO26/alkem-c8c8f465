// Telemetry server function — scan data capture.
//
// Receives one submission per completed scan from the browser. Validates,
// strips raw IP (keeps country if the edge provides it), uploads the
// signals artifact to a private storage bucket, and inserts
// a row in scan_submissions. Upserts the contact in scan_users by
// normalized email/mobile so repeat users map to the same user_id.
//
// All writes use the service-role admin client. The tables and bucket
// have RLS enabled with no policies, so this server fn is the only
// path into them. Never call from a public-route loader.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_BYTES = 2_000_000; // ~2 MB hard cap per submission

const SubmissionSchema = z.object({
  scanId: z.string().uuid(),
  userId: z.string().uuid(),
  consent: z.object({
    consented: z.literal(true),
    communications: z.boolean().optional(),
    consentVersion: z.string().min(1).max(32),
    consentedAt: z.string().datetime(),
    consentTextHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }),

  appVersion: z.string().max(32).optional(),
  user: z.object({
    name: z.string().max(200).optional(),
    email: z.string().trim().email().max(255).optional().or(z.literal("")),
    countryCode: z.string().max(8).optional(),
    mobile: z.string().max(32).optional(),
  }),
  profile: z.object({
    age: z.number().int().min(1).max(120).optional(),
    sex: z.enum(["M", "F"]).optional(),
    heightCm: z.number().min(50).max(260).optional(),
    weightKg: z.number().min(10).max(400).optional(),
    waistIn: z.number().min(10).max(80).optional(),
  }),
  fieldForce: z
    .object({
      employeeCode: z.string().max(20).optional(),
      employeeName: z.string().max(200).optional(),
      employeeHq: z.string().max(120).optional(),
      employeeRegion: z.string().max(120).optional(),
      doctorCode: z.string().max(40).optional(),
      doctorName: z.string().max(200).optional(),
      doctorSpeciality: z.string().max(120).optional(),
      doctorCity: z.string().max(120).optional(),
      orgCode: z.string().max(40).optional(),
    })
    .optional(),
  lifestyle: z.record(z.string(), z.unknown()).optional(),
  rawInputs: z.record(z.string(), z.unknown()).optional(),
  results: z.record(z.string(), z.unknown()).optional(),
  expression: z.record(z.string(), z.unknown()).optional(),
  quality: z
    .object({
      durationS: z.number().optional(),
      fps: z.number().optional(),
      motionScore: z.number().optional(),
      lightingScore: z.number().optional(),
      confidence: z.string().max(16).optional(),
      sourceMode: z.string().max(32).optional(),
    })
    .optional(),
  // base64-encoded payloads (without data: prefix)
  snapshotB64: z.string().optional(),
  signalsGzB64: z.string().optional(),
});

export type ScanSubmissionInput = z.infer<typeof SubmissionSchema>;

function normEmail(v?: string) {
  return v ? v.trim().toLowerCase() : null;
}
function normMobile(cc?: string, mob?: string) {
  if (!mob) return null;
  const digits = mob.replace(/\D/g, "");
  if (!digits) return null;
  const ccDigits = (cc ?? "").replace(/\D/g, "");
  return `+${ccDigits}${digits}`;
}
function b64ToBuf(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

export const submitScan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SubmissionSchema.parse(input))
  .handler(async ({ data }) => {
    // Size cap (rough: base64 inflates by ~33%)
    const approxBytes =
      (data.snapshotB64?.length ?? 0) * 0.75 +
      (data.signalsGzB64?.length ?? 0) * 0.75;
    if (approxBytes > MAX_BYTES) {
      throw new Error("Payload too large");
    }

    const req = getRequest();
    const ipCountry =
      req.headers.get("cf-ipcountry") ??
      req.headers.get("x-vercel-ip-country") ??
      null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    // ── Upsert user ───────────────────────────────────────────────────
    const emailNorm = normEmail(data.user.email);
    const mobileNorm = normMobile(data.user.countryCode, data.user.mobile);

    let userId = data.userId;
    // Look up an existing user by normalized email OR mobile using
    // parameterized per-column filters (no string interpolation into
    // PostgREST filter syntax → no filter-injection surface).
    const lookups: Array<Promise<{ data: { id: string } | null }>> = [];
    if (emailNorm) {
      lookups.push(
        Promise.resolve(
          supabaseAdmin
            .from("scan_users")
            .select("id")
            .eq("email_norm", emailNorm)
            .limit(1)
            .maybeSingle(),
        ),
      );
    }
    if (mobileNorm) {
      lookups.push(
        Promise.resolve(
          supabaseAdmin
            .from("scan_users")
            .select("id")
            .eq("mobile_norm", mobileNorm)
            .limit(1)
            .maybeSingle(),
        ),
      );
    }
    for (const r of await Promise.all(lookups)) {
      if (r.data?.id) {
        userId = r.data.id;
        break;
      }
    }

    const upsertPayload = {
      id: userId,
      name: data.user.name ?? null,
      email: data.user.email ?? null,
      country_code: data.user.countryCode ?? null,
      mobile: data.user.mobile ?? null,
      email_norm: emailNorm,
      mobile_norm: mobileNorm,
      last_seen_at: new Date().toISOString(),
    };
    const { error: userErr } = await supabaseAdmin
      .from("scan_users")
      .upsert(upsertPayload, { onConflict: "id" });
    if (userErr) {
      console.error("scan_users upsert failed:", userErr);
      throw new Error("Failed to record user");
    }

    // ── Upload artifacts ──────────────────────────────────────────────
    const scanId = data.scanId;
    let snapshotPath: string | null = null;
    let signalsPath: string | null = null;
    let signalsBytes: number | null = null;

    if (data.snapshotB64) {
      const path = `snapshot/${scanId}.jpg`;
      const { error } = await supabaseAdmin.storage
        .from("scan-artifacts")
        .upload(path, b64ToBuf(data.snapshotB64), {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (error) {
        console.error("snapshot upload failed:", error);
      } else {
        snapshotPath = path;
      }
    }

    if (data.signalsGzB64) {
      const path = `signals/${scanId}.json.gz`;
      const buf = b64ToBuf(data.signalsGzB64);
      const { error } = await supabaseAdmin.storage
        .from("scan-artifacts")
        .upload(path, buf, {
          contentType: "application/gzip",
          upsert: true,
        });
      if (error) {
        console.error("signals upload failed:", error);
      } else {
        signalsPath = path;
        signalsBytes = buf.byteLength;
      }
    }

    // ── Generate human-readable ref code (scan_id-based, no DB sequence) ──
    const now = new Date();
    const refCode = `WS-${now.getFullYear()}-${scanId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    // ── Insert submission row ─────────────────────────────────────────
    const { error: insErr } = await supabaseAdmin
      .from("scan_submissions")
      .insert({
        id: scanId,
        ref_code: refCode,
        user_id: userId,
        app_version: data.appVersion ?? null,
        user_agent: userAgent,
        ip_country: ipCountry,
        consent_version: data.consent.consentVersion,
        consent_text_hash: data.consent.consentTextHash ?? null,
        consented: true,
        consented_comms: !!data.consent.communications,
        consented_at: data.consent.consentedAt,
        age: data.profile.age ?? null,
        sex: data.profile.sex ?? null,

        height_cm: data.profile.heightCm ?? null,
        weight_kg: data.profile.weightKg ?? null,
        waist_in: data.profile.waistIn ?? null,
        employee_code: data.fieldForce?.employeeCode ?? null,
        employee_name: data.fieldForce?.employeeName ?? null,
        employee_hq: data.fieldForce?.employeeHq ?? null,
        employee_region: data.fieldForce?.employeeRegion ?? null,
        doctor_code: data.fieldForce?.doctorCode ?? null,
        doctor_name: data.fieldForce?.doctorName ?? null,
        doctor_speciality: data.fieldForce?.doctorSpeciality ?? null,
        doctor_city: data.fieldForce?.doctorCity ?? null,
        org_code: data.fieldForce?.orgCode ?? (data.fieldForce ? "ALKEM" : null),
        scan_type: "face",
        lifestyle: (data.lifestyle ?? null) as never,
        raw_inputs: (data.rawInputs ?? null) as never,
        results: (data.results ?? null) as never,
        expression: (data.expression ?? null) as never,
        duration_s: data.quality?.durationS ?? null,
        fps: data.quality?.fps ?? null,
        motion_score: data.quality?.motionScore ?? null,
        lighting_score: data.quality?.lightingScore ?? null,
        confidence: data.quality?.confidence ?? null,
        source_mode: data.quality?.sourceMode ?? null,
        snapshot_path: snapshotPath,
        signals_path: signalsPath,
        signals_bytes: signalsBytes,
      } as never);
    if (insErr) {
      console.error("scan_submissions insert failed:", insErr);
      throw new Error("Failed to record submission");
    }

    // Bump per-user scan counter (best-effort).
    try {
      const { data: userRow } = await supabaseAdmin
        .from("scan_users")
        .select("scans_count")
        .eq("id", userId)
        .maybeSingle();
      const next = (userRow?.scans_count ?? 0) + 1;
      await supabaseAdmin
        .from("scan_users")
        .update({ scans_count: next })
        .eq("id", userId);
    } catch {
      /* non-fatal */
    }

    return { ok: true, refCode, scanId, userId };
  });
