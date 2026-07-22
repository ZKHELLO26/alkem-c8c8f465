// Real rPPG (remote photoplethysmography) processor.
// Client-only — uses canvas / DOM video.
//
// Implements the POS algorithm (Wang, "Algorithmic principles of remote PPG",
// IEEE TBME 2017) on RGB samples extracted from a forehead ROI defined by
// MediaPipe FaceLandmarker landmarks. The pulse signal is bandpassed,
// then HR is estimated via a Goertzel-style DFT scan over 0.7–4 Hz,
// peaks are detected for RR intervals, and standard HRV time-domain
// metrics (SDNN, RMSSD, pNN50) are computed per the 1996 Task Force
// guidelines. Respiration is estimated from the same buffer in 0.13–0.5 Hz.
// SpO₂ is estimated from the R/B AC/DC ratio (de Haan-style RoR), flagged
// as research-preview because phone RGB lacks an IR channel.
//
// All math is reimplemented from the published formulae — no GPL code
// is incorporated. MIT-compatible.

export interface RoiSample { t: number; r: number; g: number; b: number }

export interface RppgWaveFeatures {
  /** Mean peak-to-peak pulse amplitude (normalized signal units). */
  pulseAmplitude: number;
  /** Augmentation-index proxy: (late/early systolic ratio) — stiffness surrogate. */
  augmentationIndex: number;
  /** Mean pulse rise-time (ms) — inverse pulse-transit-time surrogate. */
  riseTimeMs: number;
  /** Pulse-width at half amplitude (ms) — arterial compliance surrogate. */
  pulseWidthMs: number;
}

export interface RppgResult {
  heartRate: number;        // bpm
  respiration: number;      // br/min
  sdnn: number;             // ms
  rmssd: number;            // ms
  pnn50: number;            // %
  hrv: number;              // alias of RMSSD for downstream UI
  spo2: number;             // % (research preview)
  spo2Confidence: "High" | "Medium" | "Low";
  confidence: "High" | "Medium" | "Low";
  samples: number;
  durationSec: number;
  waveFeatures: RppgWaveFeatures;
}


// Raised from 42 → 48: a 25 s phone-camera rPPG cannot credibly resolve
// resting HR below ~48 bpm. The downstream hybrid blender does final
// harmonic-error rejection against the demographic baseline.
const MIN_HR_BPM = 48;
const MAX_HR_BPM = 180;
const MIN_RR_HZ = 0.13;
const MAX_RR_HZ = 0.5;

type LM = { x: number; y: number };

export class RppgProcessor {
  private samples: RoiSample[] = [];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private lastSampleAt = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 32;
    this.canvas.height = 32;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
  }

  reset() {
    this.samples = [];
    this.lastSampleAt = 0;
  }

  sampleCount() {
    return this.samples.length;
  }

  /**
   * Pull mean RGB from a forehead patch (above eyebrows, below hairline).
   * Call freely from the frame loop — internally rate-limited to ~30 Hz.
   */
  sample(video: HTMLVideoElement, lm: LM[], now: number) {
    if (!this.ctx || video.readyState < 2) return;
    if (now - this.lastSampleAt < 32) return;
    this.lastSampleAt = now;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    if (!lm[10] || !lm[151] || !lm[105] || !lm[334]) return;

    // Forehead patch: midpoint between landmark 10 (top of forehead) and
    // 151 (between eyebrows), spanning the brow horizontal width.
    const top = lm[10];
    const midF = lm[151];
    const leftBrow = lm[105];
    const rightBrow = lm[334];
    const cx = (top.x + midF.x) / 2;
    const cy = (top.y + midF.y) / 2 + (midF.y - top.y) * 0.15;
    const w = Math.abs(rightBrow.x - leftBrow.x) * 0.6;
    const h = Math.abs(midF.y - top.y) * 0.6;
    if (!(w > 0.02 && h > 0.01)) return;

    const sx = Math.max(0, (cx - w / 2) * vw);
    const sy = Math.max(0, (cy - h / 2) * vh);
    const sw = Math.min(vw - sx, w * vw);
    const sh = Math.min(vh - sy, h * vh);
    if (sw < 4 || sh < 4) return;

    try {
      this.ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 32, 32);
      const data = this.ctx.getImageData(0, 0, 32, 32).data;
      let r = 0, g = 0, b = 0;
      const n = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      this.samples.push({ t: now, r: r / n, g: g / n, b: b / n });
      // hard cap so a long pause can't blow memory
      if (this.samples.length > 2000) this.samples.shift();
    } catch {
      // CORS / readback failure — skip frame
    }
  }

  compute(): RppgResult | null {
    const s = this.samples;
    if (s.length < 180) return null; // need ~6 s @ 30 Hz minimum

    const t0 = s[0].t;
    const tEnd = s[s.length - 1].t;
    const durationSec = (tEnd - t0) / 1000;
    if (durationSec < 8) return null;

    // Resample to fixed 30 Hz via linear interpolation
    const FS = 30;
    const N = Math.floor(durationSec * FS);
    const R = new Float32Array(N);
    const G = new Float32Array(N);
    const B = new Float32Array(N);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const t = t0 + (i * 1000) / FS;
      while (j < s.length - 2 && s[j + 1].t < t) j++;
      const a = s[j];
      const b = s[Math.min(j + 1, s.length - 1)];
      const span = Math.max(1, b.t - a.t);
      const f = Math.max(0, Math.min(1, (t - a.t) / span));
      R[i] = a.r + (b.r - a.r) * f;
      G[i] = a.g + (b.g - a.g) * f;
      B[i] = a.b + (b.b - a.b) * f;
    }

    // POS pulse signal
    const pulse = pos(R, G, B, FS);
    // Bandpass to HR band
    const filtered = bandpass(pulse, FS, 0.7, 4.0);
    // HR via spectral peak in HR band
    let hrBpm = peakBpm(filtered, FS, MIN_HR_BPM / 60, MAX_HR_BPM / 60);

    // Half-rate harmonic guard: if the chosen peak is suspiciously low
    // (<60 bpm) AND the power at 2× is at least 60% of the power at the
    // chosen frequency, the algorithm has locked onto every other beat.
    // Prefer the doubled frequency.
    if (hrBpm < 60) {
      const fLo = hrBpm / 60;
      const fHi = (hrBpm * 2) / 60;
      if (fHi <= MAX_HR_BPM / 60) {
        const pLo = goertzelPower(filtered, FS, fLo);
        const pHi = goertzelPower(filtered, FS, fHi);
        if (pHi > pLo * 0.6) hrBpm = hrBpm * 2;
      }
    }

    // Peak detection → RR intervals
    const peaks = detectPeaks(filtered, FS, hrBpm);
    const rrMsRaw: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      rrMsRaw.push(((peaks[i] - peaks[i - 1]) / FS) * 1000);
    }
    // Strict physiological filter (40–200 bpm window).
    let rrClean = rrMsRaw.filter((v) => v >= 300 && v <= 1500);
    // Reject ectopic / motion artifacts: drop any RR deviating >18 % from the
    // running 5-beat median. Tightened from 25 % to reduce HRV inflation.
    rrClean = rrFilterEctopic(rrClean, 0.18);
    // Additional Poincaré-style outlier removal: drop anything > 2× or
    // < 0.5× the overall median.
    if (rrClean.length >= 5) {
      const sorted = rrClean.slice().sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      rrClean = rrClean.filter((v) => v <= med * 2 && v >= med * 0.5);
    }

    let sdnn = 0, rmssd = 0, pnn50 = 0;
    if (rrClean.length >= 8) {
      const mean = rrClean.reduce((a, b) => a + b, 0) / rrClean.length;
      sdnn = Math.sqrt(
        rrClean.reduce((a, b) => a + (b - mean) ** 2, 0) / rrClean.length,
      );

      let sd = 0, c = 0;
      for (let i = 1; i < rrClean.length; i++) {
        const d = rrClean[i] - rrClean[i - 1];
        sd += d * d;
        if (Math.abs(d) > 50) c++;
      }
      rmssd = Math.sqrt(sd / (rrClean.length - 1));
      pnn50 = (c / (rrClean.length - 1)) * 100;
    }

    // Respiration from same pulse, low band
    const respFiltered = bandpass(pulse, FS, MIN_RR_HZ, MAX_RR_HZ);
    const respBpm = peakBpm(respFiltered, FS, MIN_RR_HZ, MAX_RR_HZ);

    const confidence = scoreConfidence(filtered, FS, hrBpm, rrClean.length);

    // SpO₂ estimate via R/B AC/DC ratio (Ratio-of-Ratios).
    const Rbp = bandpass(R, FS, 0.7, 4.0);
    const Bbp = bandpass(B, FS, 0.7, 4.0);
    const rAc = rms(Rbp);
    const bAc = rms(Bbp);
    const rDc = mean(R);
    const bDc = mean(B);
    let spo2 = 97;
    let spo2Confidence: "High" | "Medium" | "Low" = "Low";
    if (rDc > 1 && bDc > 1 && bAc > 1e-3) {
      const ror = (rAc / rDc) / (bAc / bDc);
      spo2 = clamp(Math.round(110 - 25 * ror), 85, 100);
      if (confidence === "High") spo2Confidence = "Medium";
      else if (confidence === "Medium") spo2Confidence = "Low";
    }

    // Pulse-wave features (used downstream for hybrid BP).
    const waveFeatures = computeWaveFeatures(filtered, peaks, FS);

    return {
      heartRate: clamp(Math.round(hrBpm), MIN_HR_BPM, MAX_HR_BPM),
      respiration: clamp(Math.round(respBpm), 8, 30),
      sdnn: Math.round(sdnn),
      rmssd: Math.round(rmssd),
      pnn50: Math.round(pnn50),
      hrv: Math.round(rmssd > 0 ? rmssd : sdnn),
      spo2,
      spo2Confidence,
      confidence,
      samples: s.length,
      durationSec,
      waveFeatures,
    };

  }
}

// ───────────────────────── Helpers ─────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function mean(x: Float32Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i];
  return x.length ? s / x.length : 0;
}

function rms(x: Float32Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return x.length ? Math.sqrt(s / x.length) : 0;
}


/**
 * POS — Plane-Orthogonal-to-Skin (Wang 2017).
 * Windowed projection of temporally normalised RGB onto a 2-D plane
 * orthogonal to the average skin-tone vector.
 */
function pos(R: Float32Array, G: Float32Array, B: Float32Array, fs: number): Float32Array {
  const N = R.length;
  const win = Math.max(8, Math.round(1.6 * fs));
  const H = new Float32Array(N);
  if (N <= win) return H;

  for (let n = win; n < N; n++) {
    let mr = 0, mg = 0, mb = 0;
    for (let i = n - win; i < n; i++) {
      mr += R[i]; mg += G[i]; mb += B[i];
    }
    mr /= win; mg /= win; mb /= win;
    if (mr < 1e-3 || mg < 1e-3 || mb < 1e-3) continue;

    const S1 = new Float32Array(win);
    const S2 = new Float32Array(win);
    for (let i = 0; i < win; i++) {
      const k = n - win + i;
      const rN = R[k] / mr;
      const gN = G[k] / mg;
      const bN = B[k] / mb;
      S1[i] = gN - bN;
      S2[i] = -2 * rN + gN + bN;
    }
    let m1 = 0, m2 = 0;
    for (let i = 0; i < win; i++) { m1 += S1[i]; m2 += S2[i]; }
    m1 /= win; m2 /= win;
    let v1 = 0, v2 = 0;
    for (let i = 0; i < win; i++) {
      v1 += (S1[i] - m1) ** 2;
      v2 += (S2[i] - m2) ** 2;
    }
    const std1 = Math.sqrt(v1 / win);
    const std2 = Math.sqrt(v2 / win) || 1e-6;
    const alpha = std1 / std2;

    for (let i = 0; i < win; i++) {
      const k = n - win + i;
      H[k] += S1[i] - alpha * S2[i];
    }
  }
  return H;
}

/** Cheap bandpass via difference of two moving averages. */
function bandpass(x: Float32Array, fs: number, lo: number, hi: number): Float32Array {
  const N = x.length;
  const wHP = Math.max(2, Math.round(fs / lo));
  const wLP = Math.max(2, Math.round(fs / hi));
  // High-pass: subtract long moving average
  const hp = new Float32Array(N);
  {
    let sum = 0; const buf: number[] = [];
    for (let i = 0; i < N; i++) {
      buf.push(x[i]); sum += x[i];
      if (buf.length > wHP) sum -= buf.shift()!;
      hp[i] = x[i] - sum / buf.length;
    }
  }
  // Low-pass: short moving average
  const out = new Float32Array(N);
  {
    let sum = 0; const buf: number[] = [];
    for (let i = 0; i < N; i++) {
      buf.push(hp[i]); sum += hp[i];
      if (buf.length > wLP) sum -= buf.shift()!;
      out[i] = sum / buf.length;
    }
  }
  return out;
}

/** Goertzel power for a single frequency bin. */
function goertzelPower(x: Float32Array, fs: number, freq: number): number {
  const w = (2 * Math.PI * freq) / fs;
  const coeff = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let n = 0; n < x.length; n++) {
    const s0 = x[n] + coeff * s1 - s2;
    s2 = s1; s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

/** Scan the given Hz band, return peak frequency expressed as bpm. */
function peakBpm(x: Float32Array, fs: number, fLo: number, fHi: number): number {
  const stepHz = 0.01;
  let best = (fLo + fHi) / 2;
  let bestPow = -1;
  // zero-mean copy
  let mean = 0;
  for (let i = 0; i < x.length; i++) mean += x[i];
  mean /= x.length;
  const z = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) z[i] = x[i] - mean;
  for (let f = fLo; f <= fHi; f += stepHz) {
    const p = goertzelPower(z, fs, f);
    if (p > bestPow) { bestPow = p; best = f; }
  }
  return best * 60;
}

function detectPeaks(x: Float32Array, fs: number, hrBpm: number): number[] {
  const period = fs * (60 / Math.max(40, hrBpm));
  const minDist = Math.max(4, Math.round(period * 0.55));
  const peaks: number[] = [];
  let last = -minDist;
  for (let i = 1; i < x.length - 1; i++) {
    if (x[i] > 0 && x[i] > x[i - 1] && x[i] >= x[i + 1] && i - last >= minDist) {
      peaks.push(i);
      last = i;
    }
  }
  return peaks;
}

function scoreConfidence(
  x: Float32Array,
  fs: number,
  hrBpm: number,
  nRR: number,
): "High" | "Medium" | "Low" {
  const target = goertzelPower(x, fs, hrBpm / 60);
  let total = 0, count = 0;
  for (let bpm = MIN_HR_BPM; bpm <= MAX_HR_BPM; bpm += 3) {
    total += goertzelPower(x, fs, bpm / 60);
    count++;
  }
  const snr = target / Math.max(1e-9, total / count);
  if (snr > 6 && nRR >= 15) return "High";
  if (snr > 3 && nRR >= 8) return "Medium";
  return "Low";
}

/**
 * Reject ectopic / motion-glitch RR intervals — any beat that deviates more
 * than `tolerance` (fractional) from the local 5-beat median is dropped.
 * Mirrors the Camm/Malik (1996) HRV task-force pre-processing.
 */
function rrFilterEctopic(rr: number[], tolerance: number): number[] {
  if (rr.length < 5) return rr.slice();
  const out: number[] = [];
  for (let i = 0; i < rr.length; i++) {
    const lo = Math.max(0, i - 2);
    const hi = Math.min(rr.length, i + 3);
    const win = rr.slice(lo, hi).slice().sort((a, b) => a - b);
    const med = win[Math.floor(win.length / 2)];
    if (Math.abs(rr[i] - med) / med <= tolerance) out.push(rr[i]);
  }
  return out.length >= 5 ? out : rr.slice();
}

/**
 * Extract pulse-wave features used for hybrid BP estimation:
 *   – pulseAmplitude  : mean peak-to-trough amplitude (normalized units)
 *   – augmentationIndex: late-systolic / early-systolic ratio (stiffness)
 *   – riseTimeMs      : mean trough→peak rise time (ms)
 *   – pulseWidthMs    : mean half-height pulse width (ms)
 */
function computeWaveFeatures(
  x: Float32Array,
  peaks: number[],
  fs: number,
): RppgWaveFeatures {
  const fallback: RppgWaveFeatures = {
    pulseAmplitude: 0,
    augmentationIndex: 0,
    riseTimeMs: 0,
    pulseWidthMs: 0,
  };
  if (peaks.length < 3) return fallback;

  const amps: number[] = [];
  const rises: number[] = [];
  const widths: number[] = [];
  const aix: number[] = [];

  for (let i = 1; i < peaks.length; i++) {
    const p0 = peaks[i - 1];
    const p1 = peaks[i];
    if (p1 - p0 < 4) continue;
    // Find trough between p0 and p1
    let troughIdx = p0;
    let troughVal = x[p0];
    for (let k = p0 + 1; k < p1; k++) {
      if (x[k] < troughVal) { troughVal = x[k]; troughIdx = k; }
    }
    const peakVal = x[p1];
    const amp = peakVal - troughVal;
    if (amp <= 0) continue;
    amps.push(amp);
    rises.push(((p1 - troughIdx) / fs) * 1000);

    // Half-height width on the rising flank and falling flank
    const half = troughVal + amp / 2;
    let leftHalf = troughIdx;
    for (let k = troughIdx; k <= p1; k++) {
      if (x[k] >= half) { leftHalf = k; break; }
    }
    let rightHalf = p1;
    const searchEnd = Math.min(x.length - 1, p1 + (p1 - troughIdx));
    for (let k = p1; k <= searchEnd; k++) {
      if (x[k] <= half) { rightHalf = k; break; }
    }
    widths.push(((rightHalf - leftHalf) / fs) * 1000);

    // Augmentation index proxy: amplitude at 2/3 of rise vs full peak.
    const midIdx = Math.round(troughIdx + (p1 - troughIdx) * 0.66);
    const midAmp = x[midIdx] - troughVal;
    if (amp > 1e-6) aix.push(midAmp / amp);
  }

  if (!amps.length) return fallback;
  const meanOf = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  return {
    pulseAmplitude: meanOf(amps),
    augmentationIndex: aix.length ? meanOf(aix) : 0,
    riseTimeMs: meanOf(rises),
    pulseWidthMs: widths.length ? meanOf(widths) : 0,
  };
}
