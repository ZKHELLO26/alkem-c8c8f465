// Lightweight session-scoped store for the scan flow.
import { ascvd, findrisc, framinghamHtn, type Sex } from "./risk-scores";
import { demographicVitals } from "./vitals/demographic";
import { blendVitals, type SourceMode } from "./vitals/hybrid-blender";
import type { ExpressionSummary } from "./expression";

export type { ExpressionSummary };

export type UserDetails = {
  name: string;
  email: string;
  countryCode: string;
  mobile: string;
  heightCm: number;
  weightKg: number;
  waistIn: number;
  age: number;
  sex: Sex;
  // Field-force context (pharma camp deployments). Optional — the app
  // still works for direct/consumer scans when these are blank.
  employeeCode?: string;
  employeeName?: string;
  employeeHq?: string;
  employeeRegion?: string;
  doctorCode?: string;
  doctorName?: string;
  doctorSpeciality?: string;
  doctorCity?: string;
  orgCode?: string;
  // Tokenised scan-link context (set when arriving via /s/:token)
  linkToken?: string;
  scanType?: string;
};


export type Answers = {
  exercise: string;
  familyHistory: string;
  friedFood: string;
  sleep: string;
};

const ANSWER_KEYS: (keyof Answers)[] = [
  "exercise",
  "familyHistory",
  "friedFood",
  "sleep",
];

export type ScanResults = {
  heartRate: number;
  respiration: number;
  hrv: number;
  stress: number; // 0-100
  spo2Low: number;
  spo2High: number;
  bpSysLow: number;
  bpSysHigh: number;
  bpDiaLow: number;
  bpDiaHigh: number;
  bmi: number;
  absi: number;
  idealWeight: number;
  vo2Max: number;
  cardiacWorkload: number;
  hrr: number;
  sdnn: number;
  rmssd: number;
  pnn50: number;
  cardiacOutput: number;
  map: number;
  hrMax: number;
  targetHrLow: number;
  targetHrHigh: number;
  heartUtilized: number;
  bloodVolume: number;
  totalBodyWater: number;
  bodyWaterPct: number;
  bodyFatPct: number;
  hypertensionRisk: "Low" | "Moderate" | "High";
  diabetesRisk: "Low" | "Moderate" | "High";
  dyslipidemiaRisk: "Low" | "Moderate" | "High";
  obesityRisk: "Low" | "Moderate" | "High";
  cardioRisk: "Low" | "Moderate" | "High";
  skinAge: number;
  skinAgeConfidence: "High" | "Medium" | "Low";
  bmr: number;
  tdee: number;
  wellnessScore: number;
  /** How the final vitals were derived — drives the source badge on /results. */
  sourceMode: SourceMode;
  /** Optional on-device mood/expression snapshot. */
  expression?: ExpressionSummary | null;
};

const KEY_DETAILS = "scan.details";
const KEY_ANSWERS = "scan.answers";
const KEY_RESULTS = "scan.results";
const KEY_FACE_METRICS = "scan.faceMetrics";
const KEY_CONSENT = "scan.consent";
const KEY_SCAN_ID = "scan.scanId";
const KEY_EXPRESSION = "scan.expression";
const KEY_SESSION_AT = "scan.sessionAt";
const KEY_USER_ID_LS = "vitalscan.userId"; // persistent across sessions

export const CONSENT_VERSION = "2026.05.2";
/** Abandon partial scan state after 30 minutes of inactivity. */
export const SESSION_TTL_MS = 30 * 60 * 1000;

export const touchSession = () => {
  safe()?.setItem(KEY_SESSION_AT, String(Date.now()));
};
export const isSessionStale = (): boolean => {
  const v = safe()?.getItem(KEY_SESSION_AT);
  if (!v) return false;
  const at = Number(v);
  if (!Number.isFinite(at)) return true;
  return Date.now() - at > SESSION_TTL_MS;
};
export const clearAllScanState = () => {
  const s = safe();
  if (!s) return;
  s.removeItem(KEY_DETAILS);
  s.removeItem(KEY_ANSWERS);
  s.removeItem(KEY_RESULTS);
  s.removeItem(KEY_FACE_METRICS);
  s.removeItem(KEY_RPPG);
  s.removeItem(KEY_EXPRESSION);
  s.removeItem(KEY_CONSENT);
  s.removeItem(KEY_SCAN_ID);
  s.removeItem(KEY_SESSION_AT);
};

export type ConsentRecord = {
  consented: boolean;
  /** Separate opt-in for email/SMS/WhatsApp communications. */
  communications: boolean;
  version: string;
  at: string; // ISO timestamp
};

// In-memory only — never serialized
let snapshotBlob: Blob | null = null;
let signalsPayload: unknown | null = null;

export const saveSnapshotBlob = (b: Blob | null) => { snapshotBlob = b; };
export const loadSnapshotBlob = () => snapshotBlob;
export const saveSignalsBlob = (s: unknown | null) => { signalsPayload = s; };
export const loadSignalsBlob = () => signalsPayload;
export const clearTelemetryArtifacts = () => { snapshotBlob = null; signalsPayload = null; };

export const saveConsent = (consented: boolean, communications = false) => {
  const rec: ConsentRecord = {
    consented,
    communications,
    version: CONSENT_VERSION,
    at: new Date().toISOString(),
  };
  safe()?.setItem(KEY_CONSENT, JSON.stringify(rec));
  return rec;
};
export const loadConsent = (): ConsentRecord | null => {
  const v = safe()?.getItem(KEY_CONSENT);
  if (!v) return null;
  const parsed = JSON.parse(v) as Partial<ConsentRecord>;
  return {
    consented: !!parsed.consented,
    communications: !!parsed.communications,
    version: parsed.version ?? "",
    at: parsed.at ?? new Date(0).toISOString(),
  };
};

export const newScanId = (): string => {
  const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  safe()?.setItem(KEY_SCAN_ID, id);
  return id;
};
export const loadScanId = (): string | null => safe()?.getItem(KEY_SCAN_ID) ?? null;

export const loadOrCreateUserId = (): string => {
  if (typeof window === "undefined") return "00000000-0000-0000-0000-000000000000";
  const existing = window.localStorage.getItem(KEY_USER_ID_LS);
  if (existing) return existing;
  const id = "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
  window.localStorage.setItem(KEY_USER_ID_LS, id);
  return id;
};


export type FaceMetrics = {
  /** face height / face width */
  aspectRatio: number;
  /** average eye aperture (EAR) across scan */
  eyeAperture: number;
  /** lower-face proportion (chin→nose vs full face height) */
  lowerFaceRatio: number;
  /** mouth width vs face width */
  mouthRatio: number;
  /** nasolabial proxy: nose→mouth corner distance / face height */
  nasolabial: number;
  /** forehead green-channel temporal variance (skin smoothness proxy) */
  skinSmoothness: number;
  /** signal samples used */
  samples: number;
  /** Interquartile-mean predicted age from the on-device model (null if none). */
  predictedAge?: number | null;
  /** Number of valid age predictions kept after gating. */
  ageSamples?: number;
  /** Standard deviation across kept age samples — confidence proxy. */
  ageStdDev?: number;
  /** Confidence label for the face-only skin age estimate. */
  ageConfidence?: "High" | "Medium" | "Low";
  /**
   * Skin age returned by Lovable AI (Gemini vision). When present, this
   * is used DIRECTLY on the results card with no anchoring to entered age.
   */
  geminiSkinAge?: number | null;
  /** Confidence label the vision model attached to its estimate. */
  geminiConfidence?: "High" | "Medium" | "Low" | null;
};

export type RppgMetrics = {
  heartRate: number;
  respiration: number;
  sdnn: number;
  rmssd: number;
  pnn50: number;
  hrv: number;
  spo2: number;
  spo2Confidence: "High" | "Medium" | "Low";
  confidence: "High" | "Medium" | "Low";
  samples: number;
  durationSec: number;
  waveFeatures?: {
    pulseAmplitude: number;
    augmentationIndex: number;
    riseTimeMs: number;
    pulseWidthMs: number;
  };
};


const safe = (): Storage | null =>
  typeof window === "undefined" ? null : window.sessionStorage;

const KEY_RPPG = "scan.rppg";

export const saveDetails = (d: UserDetails) =>
  safe()?.setItem(KEY_DETAILS, JSON.stringify(d));
export const loadDetails = (): UserDetails | null => {
  const v = safe()?.getItem(KEY_DETAILS);
  return v ? (JSON.parse(v) as UserDetails) : null;
};
export const saveAnswers = (a: Answers) =>
  safe()?.setItem(KEY_ANSWERS, JSON.stringify(a));
export const loadAnswers = (): Answers | null => {
  const v = safe()?.getItem(KEY_ANSWERS);
  return v ? (JSON.parse(v) as Answers) : null;
};
export const answersComplete = (a: Partial<Answers> | null): a is Answers =>
  !!a && ANSWER_KEYS.every((key) => typeof a[key] === "string" && a[key].trim().length > 0);
export const saveResults = (r: ScanResults) =>
  safe()?.setItem(KEY_RESULTS, JSON.stringify(r));
export const loadResults = (): ScanResults | null => {
  const v = safe()?.getItem(KEY_RESULTS);
  return v ? (JSON.parse(v) as ScanResults) : null;
};
export const saveFaceMetrics = (m: FaceMetrics) =>
  safe()?.setItem(KEY_FACE_METRICS, JSON.stringify(m));
export const loadFaceMetrics = (): FaceMetrics | null => {
  const v = safe()?.getItem(KEY_FACE_METRICS);
  return v ? (JSON.parse(v) as FaceMetrics) : null;
};
export const saveRppg = (m: RppgMetrics) =>
  safe()?.setItem(KEY_RPPG, JSON.stringify(m));
export const loadRppg = (): RppgMetrics | null => {
  const v = safe()?.getItem(KEY_RPPG);
  return v ? (JSON.parse(v) as RppgMetrics) : null;
};
export const saveExpression = (e: ExpressionSummary) =>
  safe()?.setItem(KEY_EXPRESSION, JSON.stringify(e));
export const loadExpression = (): ExpressionSummary | null => {
  const v = safe()?.getItem(KEY_EXPRESSION);
  return v ? (JSON.parse(v) as ExpressionSummary) : null;
};
export const clearScanOutcome = () => {
  const storage = safe();
  storage?.removeItem(KEY_ANSWERS);
  storage?.removeItem(KEY_RESULTS);
  storage?.removeItem(KEY_FACE_METRICS);
  storage?.removeItem(KEY_RPPG);
  storage?.removeItem(KEY_EXPRESSION);
};


const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const riskFrom = (score: number): "Low" | "Moderate" | "High" =>
  score < 35 ? "Low" : score < 65 ? "Moderate" : "High";

function faceGeometryReliable(m: FaceMetrics): boolean {
  return (
    m.samples >= 80 &&
    m.aspectRatio >= 1.15 &&
    m.aspectRatio <= 1.75 &&
    m.eyeAperture >= 0.18 &&
    m.eyeAperture <= 0.48 &&
    m.lowerFaceRatio >= 0.38 &&
    m.lowerFaceRatio <= 0.54 &&
    m.nasolabial >= 0.16 &&
    m.nasolabial <= 0.28
  );
}

function estimateSkinAgeFromFace(m: FaceMetrics, enteredAge: number): number {
  if (!faceGeometryReliable(m)) return Math.round(clampN(enteredAge, 16, 78));

  const eyeYears = clampN((0.295 - m.eyeAperture) * 45, -5, 6);
  const lowerYears = clampN((m.lowerFaceRatio - 0.445) * 42, -4, 5);
  const nasoYears = clampN((m.nasolabial - 0.198) * 38, -4, 5);
  const smoothYears = clampN((m.skinSmoothness - 1.15) * 1.2, -3, 4);
  const aspectYears = clampN((m.aspectRatio - 1.34) * 3, -2, 2);
  const delta = clampN(
    eyeYears + lowerYears + nasoYears + smoothYears + aspectYears,
    -8,
    8,
  );

  return finalizeSkinAge(enteredAge + delta, enteredAge);
}

const SKIN_AGE_MAX_DELTA = 12;

function finalizeSkinAge(estimatedAge: number, enteredAge: number): number {
  // Client-facing safety rail: skin age must stay within a plausible band of
  // the user's stated age even if any camera/model path produces a bad
  // outlier. The band is wide enough that different people produce visibly
  // different results, but tight enough that a bad frame can't show a 30
  // year old as 70.
  return Math.round(
    clampN(
      enteredAge + clampN(estimatedAge - enteredAge, -SKIN_AGE_MAX_DELTA, SKIN_AGE_MAX_DELTA),
      16,
      82,
    ),
  );
}

function anchorSkinAgeToEnteredAge(
  predictedAge: number,
  enteredAge: number,
  confidence: "High" | "Medium" | "Low",
): number {
  // Wider window when the on-device model is confident, so real inter-person
  // differences actually appear; tight window when it's shaky so we don't
  // publish absurd values.
  const modelDelta = confidence === "High" ? 12 : confidence === "Medium" ? 8 : 4;
  return finalizeSkinAge(enteredAge + clampN(predictedAge - enteredAge, -modelDelta, modelDelta), enteredAge);
}

function skinAgeConfidence(m?: FaceMetrics | null): "High" | "Medium" | "Low" {
  if (!m) return "Low";
  const n = m.ageSamples ?? 0;
  const std = m.ageStdDev ?? 99;
  if (n >= 12 && std <= 5) return "High";
  if (n >= 6 && std <= 9) return "Medium";
  if (n >= 8) return "Medium";
  return "Low";
}

export function computeResults(
  d: UserDetails,
  a: Answers,
  faceMetrics?: FaceMetrics | null,
  rppg?: RppgMetrics | null,
): ScanResults {
  const heightM = d.heightCm / 100;
  const bmi = +(d.weightKg / (heightM * heightM)).toFixed(1);
  const waistM = d.waistIn * 0.0254;
  const absi = +(waistM / (Math.pow(bmi, 2 / 3) * Math.sqrt(heightM))).toFixed(3);
  const idealWeight = +(22 * heightM * heightM).toFixed(1);

  // ─── Hybrid vitals ─────────────────────────────────────────────────
  // Always compute a demographic baseline, then weight-blend the rPPG
  // reading on top of it. The blender owns all clamps, harmonic-error
  // detection, and fail-safe behaviour (see vitals/hybrid-blender.ts).
  const demo = demographicVitals(d, a);
  const blended = blendVitals(demo, rppg ?? null);

  const heartRate = blended.heartRate;
  const respiration = blended.respiration;
  const hrv = blended.hrv;
  const sdnn = blended.sdnn;
  const rmssd = blended.rmssd;
  const pnn50 = blended.pnn50;
  const sourceMode = blended.sourceMode;

  // Stress derived primarily from HRV: low HRV → high stress
  let stressBase = Math.round(100 - hrv); // inverse relationship
  if (a.sleep === "No") stressBase += 12;
  if (a.sleep === "Sometimes") stressBase += 5;
  if (a.friedFood === "Yes") stressBase += 5;
  if (a.exercise === "No") stressBase += 5;
  const stress = Math.min(95, Math.max(10, Math.round(stressBase + rand(-3, 3))));

  // SpO₂ display band (±1% around blended value).
  const spo2Low = Math.max(85, blended.spo2 - 1);
  const spo2High = Math.min(100, blended.spo2 + 1);

  // Blood pressure display band (±5/±4 around blended center).
  const sbpCenter = blended.sbp;
  const dbpCenter = blended.dbp;
  const bpSysLow = Math.round(clampN(sbpCenter - 5, 90, 195));
  const bpSysHigh = Math.round(clampN(sbpCenter + 5, 95, 200));
  const bpDiaLow = Math.round(clampN(dbpCenter - 4, 55, 125));
  const bpDiaHigh = Math.round(clampN(dbpCenter + 4, 60, 130));



  const maxHR = 220 - d.age;
  const hrr = maxHR - heartRate;
  const vo2Max = Math.round(15.3 * (maxHR / heartRate));
  const cardiacWorkload = Math.round((heartRate * (bpSysLow + bpSysHigh)) / 200);


  // Cardiovascular extras
  const avgSys = (bpSysLow + bpSysHigh) / 2;
  const avgDia = (bpDiaLow + bpDiaHigh) / 2;
  const map = Math.round(avgDia + (avgSys - avgDia) / 3);
  const strokeVolume = Math.round(70 + rand(-8, 8) + (a.exercise === "Yes" ? 8 : 0));
  const cardiacOutput = +((strokeVolume * heartRate) / 1000).toFixed(1);
  const hrMax = maxHR;
  const targetHrLow = Math.round(hrMax * 0.5);
  const targetHrHigh = Math.round(hrMax * 0.85);
  const heartUtilized = Math.round((heartRate / hrMax) * 100);

  // Body composition — sex-aware Deurenberg (1991):
  //   BF% = 1.20·BMI + 0.23·age − 10.8·sex − 5.4   (sex: 1=M, 0=F)
  const bloodVolume = +(d.weightKg * 0.07).toFixed(1);
  const sexInt = d.sex === "M" ? 1 : 0;
  const bodyFatPct = +(
    1.2 * bmi + 0.23 * d.age - 10.8 * sexInt - 5.4 + rand(-1.5, 1.5)
  ).toFixed(1);
  const leanMass = d.weightKg * (1 - bodyFatPct / 100);
  const totalBodyWater = +(leanMass * 0.73).toFixed(1);
  const bodyWaterPct = +((totalBodyWater / d.weightKg) * 100).toFixed(1);

  // Validated risk scoring (Framingham HTN, FINDRISC, ASCVD)
  const waistCm = d.waistIn * 2.54;
  const sbpAvg = Math.round((bpSysLow + bpSysHigh) / 2);
  const dbpAvg = Math.round((bpDiaLow + bpDiaHigh) / 2);

  const htn = framinghamHtn({
    age: d.age,
    sex: d.sex,
    sbp: sbpAvg,
    dbp: dbpAvg,
    bmi,
    smoker: false,
    parentalHtn: a.familyHistory === "Yes",
  });

  const fr = findrisc({
    age: d.age,
    bmi,
    waistCm,
    sex: d.sex,
    dailyActivity: a.exercise === "Yes",
    dailyVegFruit: a.friedFood === "No",
    bpMeds: false,
    highGlucoseHistory: false,
    familyHistory: a.familyHistory === "Yes" ? "first" : "none",
  });

  // Population-mean lipids — keeps ASCVD directional without needing a blood draw.
  const asc = ascvd({
    age: d.age,
    sex: d.sex,
    totalChol: 200,
    hdl: 50,
    sbp: sbpAvg,
    treatedBp: false,
    smoker: false,
    diabetes: false,
  });

  // BMR — Mifflin–St Jeor (1990): the modern gold-standard equation.
  //   Male:   10·kg + 6.25·cm − 5·age + 5
  //   Female: 10·kg + 6.25·cm − 5·age − 161
  const bmr = Math.round(
    10 * d.weightKg + 6.25 * d.heightCm - 5 * d.age + (d.sex === "M" ? 5 : -161),
  );
  // TDEE — BMR × activity factor inferred from exercise answer.
  const actFactor =
    a.exercise === "Yes" ? 1.55 : a.exercise === "Sometimes" ? 1.375 : 1.2;
  const tdee = Math.round(bmr * actFactor);

  // Lipid risk (no validated non-blood score) — keep heuristic.
  const lipidScore =
    (a.friedFood === "Yes" ? 30 : a.friedFood === "Occasionally" ? 12 : 0) +
    (bmi > 27 ? 20 : 5) +
    (a.exercise === "No" ? 15 : 0);
  const obesityScore = bmi < 25 ? 15 : bmi < 30 ? 50 : 80;


  // Skin age estimation.
  // Preferred source: Lovable AI (Gemini vision) — returned in
  // `faceMetrics.geminiSkinAge`. When present, we use it directly with no
  // anchoring to entered age, so someone entering the wrong age doesn't get
  // a "matching" skin age. Only guard rails: clamp to 12–90.
  // Fallback: on-device face-age model, anchored to entered age (today's
  // behaviour) so we always ship a value even if the AI call failed.
  let skinAge: number;
  let ageConfidence: "High" | "Medium" | "Low";
  const geminiAge = faceMetrics?.geminiSkinAge;
  if (faceMetrics && typeof geminiAge === "number" && Number.isFinite(geminiAge)) {
    skinAge = Math.round(clampN(geminiAge, 12, 90));
    ageConfidence = faceMetrics.geminiConfidence ?? "Medium";
  } else {
    ageConfidence = skinAgeConfidence(faceMetrics);
    if (
      faceMetrics &&
      typeof faceMetrics.predictedAge === "number" &&
      ageConfidence !== "Low"
    ) {
      skinAge = anchorSkinAgeToEnteredAge(faceMetrics.predictedAge, d.age, ageConfidence);
    } else if (faceMetrics) {
      skinAge = estimateSkinAgeFromFace(faceMetrics, d.age);
    } else {
      // No scan geometry at all — anchor to the entered age.
      skinAge = finalizeSkinAge(d.age, d.age);
    }
    skinAge = finalizeSkinAge(skinAge, d.age);
  }

  // Wellness score: higher is better — driven by validated risk %.
  const cardioRiskPct = asc.percent; // 10-yr ASCVD %
  const negative =
    (stress / 100) * 25 +
    Math.min(cardioRiskPct * 2.5, 35) +
    (bmi > 30 ? 15 : bmi > 25 ? 8 : 0) +
    (a.exercise === "No" ? 10 : a.exercise === "Sometimes" ? 5 : 0) +
    (a.sleep === "No" ? 10 : a.sleep === "Sometimes" ? 5 : 0);
  const wellnessScore = Math.max(20, Math.min(98, Math.round(100 - negative)));

  return {
    heartRate,
    respiration,
    hrv,
    stress,
    spo2Low,
    spo2High,
    bpSysLow,
    bpSysHigh,
    bpDiaLow,
    bpDiaHigh,
    bmi,
    absi,
    idealWeight,
    vo2Max,
    cardiacWorkload,
    hrr,
    sdnn,
    rmssd,
    pnn50,
    cardiacOutput,
    map,
    hrMax,
    targetHrLow,
    targetHrHigh,
    heartUtilized,
    bloodVolume,
    totalBodyWater,
    bodyWaterPct,
    bodyFatPct,
    hypertensionRisk: htn.band,
    diabetesRisk: fr.band,
    dyslipidemiaRisk: riskFrom(lipidScore),
    obesityRisk: riskFrom(obesityScore),
    cardioRisk: asc.band,
    skinAge,
    skinAgeConfidence: ageConfidence,
    bmr,
    tdee,
    wellnessScore,
    sourceMode,
  };
}


export { skinAgeConfidence };

export function wellnessLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Moderate";
  return "Needs Attention";
}
