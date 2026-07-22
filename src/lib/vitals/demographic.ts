// Demographic baseline vitals.
//
// These are the formulas the app used BEFORE rPPG was wired in. They're
// purely a function of user-entered profile data (age, sex, BMI, lifestyle)
// — no camera signal. We keep them as a stable anchor so the hybrid blender
// (see hybrid-blender.ts) can pull rPPG estimates back toward physiological
// reality when the camera signal is noisy, and as a hard fail-safe when the
// camera/network are unavailable.

import type { Answers, UserDetails } from "../scan-store";

export interface DemographicVitals {
  heartRate: number;
  respiration: number;
  hrv: number;          // RMSSD-equivalent
  sdnn: number;
  rmssd: number;
  pnn50: number;
  spo2: number;
  sbp: number;
  dbp: number;
}

export function demographicVitals(d: UserDetails, a: Answers): DemographicVitals {
  const heightM = d.heightCm / 100;
  const bmi = d.weightKg / (heightM * heightM);

  // Heart rate — typical resting adult, modulated by fitness & sleep.
  let heartRate = 72;
  if (a.exercise === "Yes") heartRate -= 6;
  else if (a.exercise === "No") heartRate += 6;
  if (a.sleep === "No") heartRate += 3;
  // Slight age drift (older = marginally higher resting HR for sedentary).
  heartRate += Math.max(0, (d.age - 40) * 0.05);

  // Respiration — adults sit at 14–16/min.
  const respiration = 15 + (a.exercise === "No" ? 1 : a.exercise === "Yes" ? -1 : 0);

  // HRV (RMSSD-equivalent) — age-decline curve + lifestyle.
  // Healthy 30 yr non-athlete ≈ 40–50 ms; drops ~3 ms/decade.
  let hrv = 50 - Math.max(0, (d.age - 25)) * 0.35;
  if (a.exercise === "Yes") hrv += 10;
  if (a.exercise === "No") hrv -= 8;
  if (a.sleep === "No") hrv -= 8;
  hrv = Math.max(15, Math.min(75, hrv));
  const rmssd = hrv;
  const sdnn = Math.min(90, hrv * 1.15);
  const pnn50 = Math.max(3, Math.min(45, hrv * 0.5));

  // SpO₂ — healthy adults sit at 97–98%.
  const spo2 = 97;

  // Blood pressure — recalibrated so age alone does not push readings
  // into the hypertensive range. Final value is still nudged by the rPPG
  // waveform in hybrid-blender when signal quality is good.
  const sexAdj = d.sex === "M" ? 2 : 0;
  const sbpRaw =
    110 +
    0.26 * d.age +
    1.2 * Math.max(-5, bmi - 22) +
    sexAdj +
    (a.familyHistory === "Yes" ? 3 : 0) +
    (a.exercise === "No" ? 2 : a.exercise === "Yes" ? -3 : 0);
  const dbpRaw =
    72 +
    0.16 * d.age +
    0.7 * Math.max(-5, bmi - 22) +
    (a.familyHistory === "Yes" ? 2 : 0);
  // Soft cap on the demographic baseline: age + lifestyle alone can never
  // push the baseline above 138/88 (upper end of pre-hypertension). BMI +
  // rPPG waveform can still legitimately elevate the final displayed reading.
  const sbp = Math.min(138, sbpRaw);
  const dbp = Math.min(88, dbpRaw);

  return {
    heartRate: Math.round(heartRate),
    respiration: Math.round(respiration),
    hrv: Math.round(hrv),
    sdnn: Math.round(sdnn),
    rmssd: Math.round(rmssd),
    pnn50: Math.round(pnn50),
    spo2,
    sbp: Math.round(sbp),
    dbp: Math.round(dbp),
  };
}
