// Single source of truth for per-client customization.
// Edit this file (or import a preset and merge) to swap branding, toggle
// parameters, reorder groups, or tweak physiological thresholds — no
// component code needs to change.

export type GroupId =
  | "Core Vitals"
  | "Body Metrics"
  | "Skin & Wellness"
  | "Cardiovascular"
  | "Risk Indicators";

export type ParamId =
  | "hr" | "bp" | "spo2" | "resp" | "hrv"
  | "bmi" | "absi" | "iw" | "bfat" | "tbw" | "bwp" | "bvol"
  | "vo2" | "cw" | "hrr" | "co" | "map" | "hrmax" | "thrr" | "hu"
  | "sdnn" | "rmssd" | "pnn50" | "bmr" | "tdee"
  | "htn" | "diab" | "lip" | "obe" | "cv"
  | "skin" | "stress";

export interface ClinicConfig {
  brand: {
    name: string;
    tagline: string;
    primary: string;
    accent: string;
    gold: string;
  };
  /** Ordered list of groups to render. Drop a group to hide it. */
  groups: GroupId[];
  /** Per-parameter visibility & label overrides. */
  params: Partial<Record<ParamId, { visible?: boolean; label?: string }>>;
  scan: {
    durationSec: number;
    maxDurationSec: number;
    motionGraceMs: number;
    /** Hard timeout before falling back to demographic-only result. */
    hardTimeoutSec: number;
  };
  /** Blending knobs for the hybrid vitals engine (see hybrid-blender.ts). */
  blend: {
    /** Demographic always carries at least this weight (0..1). */
    demographicFloor: number;
    /** Max weight rPPG can take when confidence is High. */
    rppgCeiling: number;
    /** Hard physiological clamps applied AFTER blending. */
    hrMin: number;          // displayed HR can never go below this
    hrMax: number;
    sbpFloor: number;
    sbpCeiling: number;
    dbpFloor: number;
    dbpCeiling: number;
  };
  copy: {
    wellnessTagline: string;
    disclaimer: string;
  };
  /** Show small badge indicating data source on results page. */
  showSourceBadge: boolean;
}

export const clinicConfig: ClinicConfig = {
  brand: {
    name: "VitalScan AI",
    tagline: "Indicative, not diagnostic",
    primary: "oklch(0.62 0.16 200)",
    accent: "oklch(0.78 0.15 180)",
    gold: "#C9A24A",
  },
  groups: [
    "Core Vitals",
    "Body Metrics",
    "Skin & Wellness",
    "Cardiovascular",
    "Risk Indicators",
  ],
  params: {},
  scan: {
    durationSec: 25,
    maxDurationSec: 35,
    motionGraceMs: 3000,
    hardTimeoutSec: 60,
  },
  blend: {
    demographicFloor: 0.25,
    rppgCeiling: 0.75,
    hrMin: 50,
    hrMax: 130,
    sbpFloor: 102,
    sbpCeiling: 200,
    dbpFloor: 65,
    dbpCeiling: 130,
  },
  copy: {
    wellnessTagline: "Indicative, not diagnostic",
    disclaimer:
      "Wellness indicator only — not a medical diagnosis. Please consult a qualified clinician for diagnostic decisions.",
  },
  showSourceBadge: true,
};

/** Helper: is this parameter visible per config? Defaults to true. */
export function isParamVisible(id: ParamId): boolean {
  return clinicConfig.params[id]?.visible !== false;
}

/** Helper: per-config label override, or fallback to default. */
export function paramLabel(id: ParamId, fallback: string): string {
  return clinicConfig.params[id]?.label ?? fallback;
}
