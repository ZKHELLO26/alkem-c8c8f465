// Weighted hybrid blender — combines rPPG-measured vitals with a
// demographic baseline so a single noisy/biased camera reading can't push
// the displayed value to an implausible extreme (e.g. 104/61 mmHg or 44 bpm).
//
// Always returns a populated set of vitals; if rPPG is null or "Low"
// confidence, the demographic value dominates. If rPPG is "High", rPPG
// dominates but demographic still anchors the result.

import { clinicConfig } from "../../config/clinic-config";
import type { DemographicVitals } from "./demographic";
import type { RppgMetrics } from "../scan-store";

export type SourceMode = "rppg-led" | "hybrid" | "demographic-led" | "demographic-fallback";

export interface BlendedVitals {
  heartRate: number;
  respiration: number;
  hrv: number;
  sdnn: number;
  rmssd: number;
  pnn50: number;
  spo2: number;
  sbp: number;
  dbp: number;
  sourceMode: SourceMode;
  /** rPPG weight actually used after gating (0..1). */
  rppgWeight: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Map rPPG confidence label → numeric weight, scaled by blend config. */
function confidenceToWeight(c: "High" | "Medium" | "Low" | undefined): number {
  const { demographicFloor, rppgCeiling } = clinicConfig.blend;
  switch (c) {
    case "High":   return rppgCeiling;                            // 0.75 default
    case "Medium": return (rppgCeiling + (1 - demographicFloor)) / 2 * 0.65; // ~0.5
    case "Low":    return 1 - (1 - demographicFloor) * 0.9;       // ~0.27
    default:       return 0;
  }
}

/**
 * Detect half-rate / double-rate harmonic errors in rPPG HR.
 * If the camera value is far from the demographic anchor by ~2× or ~0.5×,
 * assume it locked onto the wrong harmonic and reject.
 */
function isLikelyHarmonicError(rppgHr: number, demoHr: number): boolean {
  if (rppgHr <= 0) return false;
  const ratio = rppgHr / demoHr;
  // 2× harmonic (e.g. demo 70, rppg 140) or 1/2× (demo 70, rppg 35)
  if (ratio > 1.7 && ratio < 2.3) return true;
  if (ratio > 0.42 && ratio < 0.58) return true;
  // Implausibly low for resting adult (<45 bpm from phone camera)
  if (rppgHr < 45) return true;
  return false;
}

export function blendVitals(
  demo: DemographicVitals,
  rppg: RppgMetrics | null,
): BlendedVitals {
  const cfg = clinicConfig.blend;

  // No rPPG signal at all → pure demographic fail-safe.
  if (!rppg) {
    return {
      heartRate: clamp(demo.heartRate, cfg.hrMin, cfg.hrMax),
      respiration: demo.respiration,
      hrv: demo.hrv,
      sdnn: demo.sdnn,
      rmssd: demo.rmssd,
      pnn50: demo.pnn50,
      spo2: demo.spo2,
      sbp: clamp(demo.sbp, cfg.sbpFloor, cfg.sbpCeiling),
      dbp: clamp(demo.dbp, cfg.dbpFloor, cfg.dbpCeiling),
      sourceMode: "demographic-fallback",
      rppgWeight: 0,
    };
  }

  const wBase = confidenceToWeight(rppg.confidence);

  // HR — special-case harmonic rejection: if rPPG looks like a 2×/½× lock-on,
  // drop its weight to near-zero so demographic dominates.
  const hrHarmonicBad = isLikelyHarmonicError(rppg.heartRate, demo.heartRate);
  const wHr = hrHarmonicBad ? Math.min(wBase, 0.15) : wBase;
  const heartRate = clamp(
    Math.round(wHr * rppg.heartRate + (1 - wHr) * demo.heartRate),
    cfg.hrMin,
    cfg.hrMax,
  );

  // Respiration — full blend.
  const respiration = Math.round(
    wBase * rppg.respiration + (1 - wBase) * demo.respiration,
  );

  // HRV — blend with demographic anchor; physiological clamps stay.
  const sdnn = Math.min(90, Math.round(wBase * rppg.sdnn + (1 - wBase) * demo.sdnn));
  let rmssd = Math.min(75, Math.round(wBase * rppg.rmssd + (1 - wBase) * demo.rmssd));
  if (sdnn > 0) rmssd = Math.min(rmssd, Math.round(sdnn * 1.05));
  const pnn50 = Math.min(50, Math.round(wBase * rppg.pnn50 + (1 - wBase) * demo.pnn50));
  const hrv = Math.min(75, rmssd);

  // SpO₂ — rPPG SpO₂ is noisy on phones, so weight is reduced further.
  const wSpo2 = wBase * 0.6;
  const spo2 = Math.round(wSpo2 * rppg.spo2 + (1 - wSpo2) * demo.spo2);

  // Blood pressure — use rPPG wave features to NUDGE the demographic
  // baseline within a tight band. This is the key fix: rPPG never owns
  // the BP reading, it only shifts it.
  let sbpAdjust = 0;
  let dbpAdjust = 0;
  const wf = rppg.waveFeatures;
  if (wf && (rppg.confidence === "High" || rppg.confidence === "Medium")) {
    const aixDev = wf.augmentationIndex - 0.45;
    sbpAdjust += clamp(aixDev * 20, -6, 8);
    dbpAdjust += clamp(aixDev * 8, -3, 4);
    if (wf.riseTimeMs > 0) {
      sbpAdjust += clamp((160 - wf.riseTimeMs) / 40 * 3, -4, 4);
    }
    if (wf.pulseWidthMs > 0) {
      dbpAdjust += clamp((260 - wf.pulseWidthMs) / 60 * 2, -3, 3);
    }
  }
  // Scale adjustments by rPPG confidence — Low confidence → barely move.
  sbpAdjust *= wBase;
  dbpAdjust *= wBase;

  const sbp = clamp(Math.round(demo.sbp + sbpAdjust), cfg.sbpFloor, cfg.sbpCeiling);
  let dbp = clamp(Math.round(demo.dbp + dbpAdjust), cfg.dbpFloor, cfg.dbpCeiling);
  // Keep physiological pulse pressure 30–65 mmHg.
  if (sbp - dbp < 30) dbp = sbp - 30;
  if (sbp - dbp > 65) dbp = sbp - 55;

  const sourceMode: SourceMode =
    wBase >= 0.6 ? "rppg-led" :
    wBase >= 0.4 ? "hybrid" :
    wBase > 0    ? "demographic-led" :
                   "demographic-fallback";

  return {
    heartRate,
    respiration,
    hrv,
    sdnn,
    rmssd,
    pnn50,
    spo2,
    sbp,
    dbp,
    sourceMode,
    rppgWeight: wBase,
  };
}
