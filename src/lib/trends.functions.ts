// Trends lookup gated strictly by an unguessable per-device user id.
//
// To prevent enumeration by phone number, the caller ONLY supplies the
// random UUID that was assigned to their device (stored in localStorage as
// vitalscan.userId). Phone number is never accepted as a lookup key here.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  userId: z.string().uuid(),
});

export type TrendPoint = {
  at: string;
  wellness: number | null;
  heartRate: number | null;
  bpSys: number | null;
  hrv: number | null;
  spo2: number | null;
  bmi: number | null;
};

export type TrendsResult = {
  scans: number;
  points: TrendPoint[];
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function avg(a: unknown, b: unknown): number | null {
  const x = num(a);
  const y = num(b);
  if (x === null && y === null) return null;
  if (x === null) return y;
  if (y === null) return x;
  return Math.round((x + y) / 2);
}

export const getScanTrends = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<TrendsResult> => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { scans: 0, points: [] };
    }

    let supabaseAdmin;
    try {
      ({ supabaseAdmin } = await import("@/integrations/supabase/client.server"));
    } catch {
      return { scans: 0, points: [] };
    }

    // Only the device that generated this userId knows it (random UUID stored
    // in localStorage). No phone/email is accepted as a lookup key.
    const { data: user } = await supabaseAdmin
      .from("scan_users")
      .select("id")
      .eq("id", data.userId)
      .limit(1)
      .maybeSingle();
    if (!user?.id) return { scans: 0, points: [] };

    const { data: rows, error } = await supabaseAdmin
      .from("scan_submissions")
      .select("created_at, results")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(20);
    if (error || !rows) return { scans: 0, points: [] };

    const points: TrendPoint[] = rows.map((row) => {
      const r = (row.results ?? {}) as Record<string, unknown>;
      return {
        at: row.created_at as string,
        wellness: num(r.wellnessScore),
        heartRate: num(r.heartRate),
        bpSys: avg(r.bpSysLow, r.bpSysHigh),
        hrv: num(r.hrv),
        spo2: avg(r.spo2Low, r.spo2High),
        bmi: num(r.bmi),
      };
    });

    return { scans: points.length, points };
  });
