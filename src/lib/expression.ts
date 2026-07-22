// Lightweight on-device expression / mood scoring.
// Uses MediaPipe FaceLandmarker landmarks we already compute — no extra model,
// no extra network calls, nothing leaves the device.
//
// Inputs: a sequence of per-frame samples accumulated during the scan.
// Outputs: a single ExpressionSummary at scan-finalize time.

export type ExpressionSample = {
  smile: number; // 0..1, mouth-corner lift normalized by face height
  ear: number; // eye aspect ratio (already computed) — alertness proxy
  brow: number; // inner-brow distance / eye width — calmness proxy (higher = more relaxed)
  yaw: number; // simple yaw proxy from landmark geometry
  pitch: number; // simple pitch proxy
};

export type ExpressionSummary = {
  /** 0..100 smile score */
  smileScore: number;
  /** 0..100 alertness (eyes open + low blink rate) */
  alertness: number;
  /** 0..100 calmness (relaxed brows + steady head) */
  calmness: number;
  /** 0..100 head-pose stability (low yaw/pitch variance) */
  stability: number;
  /** human-readable summary label */
  moodLabel: "Relaxed & Alert" | "Calm" | "Neutral" | "Tense" | "Tired";
  /** short friendly sentence for the results card */
  moodCopy: string;
  samples: number;
};

const LM = {
  // mouth
  mouthLeft: 61,
  mouthRight: 291,
  upperLip: 13,
  lowerLip: 14,
  // face frame
  faceTop: 10,
  chin: 152,
  // brows / eyes
  leftBrowInner: 55,
  rightBrowInner: 285,
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  leftEyeInner: 133,
  rightEyeInner: 362,
  // nose
  noseTip: 1,
};

/** Build a single per-frame expression sample from MP landmarks + EAR. */
export function sampleExpression(
  lm: { x: number; y: number; z?: number }[],
  ear: number,
  aspect = 1,
): ExpressionSample | null {
  const need = [
    LM.mouthLeft,
    LM.mouthRight,
    LM.upperLip,
    LM.lowerLip,
    LM.faceTop,
    LM.chin,
    LM.leftBrowInner,
    LM.rightBrowInner,
    LM.leftEyeOuter,
    LM.rightEyeOuter,
    LM.leftEyeInner,
    LM.rightEyeInner,
    LM.noseTip,
  ];
  for (const i of need) if (!lm[i]) return null;

  const faceH = Math.max(0.001, lm[LM.chin].y - lm[LM.faceTop].y);

  // Smile: mouth-corner lift relative to the lip midline, normalized by face height.
  // When corners go up (lower y in image coords), mouth-corner-y < lip-mid-y.
  const lipMidY = (lm[LM.upperLip].y + lm[LM.lowerLip].y) / 2;
  const cornerLift =
    lipMidY - (lm[LM.mouthLeft].y + lm[LM.mouthRight].y) / 2; // positive when smiling
  const smile = Math.max(0, Math.min(1, cornerLift / (faceH * 0.04)));

  // Brow tension: inner-brow-y vs eye-inner-y. Brows pulled down/in (tense) -> small gap.
  // Higher gap = more relaxed.
  const eyeInnerY = (lm[LM.leftEyeInner].y + lm[LM.rightEyeInner].y) / 2;
  const browY = (lm[LM.leftBrowInner].y + lm[LM.rightBrowInner].y) / 2;
  const eyeWidth = Math.max(
    0.001,
    Math.abs(lm[LM.leftEyeOuter].x - lm[LM.leftEyeInner].x) +
      Math.abs(lm[LM.rightEyeOuter].x - lm[LM.rightEyeInner].x),
  );
  // eye-to-brow gap is a vertical (y) measure while eyeWidth is horizontal (x);
  // convert y to x-equivalent units via aspect so the ratio is geometrically
  // correct and actually differs person-to-person.
  const brow = ((eyeInnerY - browY) * aspect) / eyeWidth; // higher = relaxed

  // Yaw proxy: nose-x vs face midline.
  const midX = (lm[LM.leftEyeOuter].x + lm[LM.rightEyeOuter].x) / 2;
  const yaw = (lm[LM.noseTip].x - midX) / eyeWidth;

  // Pitch proxy: nose-y vs face midline-y.
  const midY = (lm[LM.faceTop].y + lm[LM.chin].y) / 2;
  const pitch = (lm[LM.noseTip].y - midY) / faceH;

  return { smile, ear, brow, yaw, pitch };
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function std(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

/** Summarize accumulated samples into a friendly mood snapshot. */
export function summarizeExpression(
  samples: ExpressionSample[],
): ExpressionSummary | null {
  if (samples.length < 8) return null;

  const smiles = samples.map((s) => s.smile);
  const ears = samples.map((s) => s.ear);
  const brows = samples.map((s) => s.brow);
  const yaws = samples.map((s) => s.yaw);
  const pitches = samples.map((s) => s.pitch);

  // Smile: average corner-lift, scaled. Centered so a neutral mouth lands
  // mid-range rather than at 0.
  const smileScore = Math.round(
    Math.max(0, Math.min(100, 15 + mean(smiles) * 130)),
  );

  // Alertness: aspect-corrected EAR mapped across a realistic open-eye band.
  // A relaxed open eye sits ~0.24–0.32; squinting/tired ~0.18; wide ~0.36.
  const earAvg = mean(ears);
  const alertness = Math.round(
    Math.max(4, Math.min(100, ((earAvg - 0.17) / (0.34 - 0.17)) * 100)),
  );

  // Calmness: relaxed brows (higher brow gap) + steady head. Widened window
  // so it discriminates instead of pinning to an extreme.
  const browAvg = mean(brows);
  const browScore = Math.max(0, Math.min(100, ((browAvg - 0.55) / 0.9) * 100));
  const headJitter = (std(yaws) + std(pitches)) / 2;
  const stability = Math.round(
    Math.max(0, Math.min(100, 100 - headJitter * 650)),
  );
  const calmness = Math.round(browScore * 0.6 + stability * 0.4);

  // Decide a friendly label.
  let moodLabel: ExpressionSummary["moodLabel"] = "Neutral";
  if (alertness < 45) moodLabel = "Tired";
  else if (calmness < 40) moodLabel = "Tense";
  else if (smileScore >= 50 && alertness >= 55) moodLabel = "Relaxed & Alert";
  else if (calmness >= 60) moodLabel = "Calm";

  const moodCopy = (() => {
    switch (moodLabel) {
      case "Relaxed & Alert":
        return "You looked relaxed and alert during your scan. Lovely 🙂";
      case "Calm":
        return "You appeared nice and calm through the scan.";
      case "Tense":
        return "You looked a little tense. A few slow breaths can help next time.";
      case "Tired":
        return "Your eyes looked a little tired — consider a short break or some rest.";
      default:
        return "You appeared composed and steady during your scan.";
    }
  })();

  return {
    smileScore,
    alertness,
    calmness,
    stability,
    moodLabel,
    moodCopy,
    samples: samples.length,
  };
}
