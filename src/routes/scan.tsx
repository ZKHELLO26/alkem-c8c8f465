import { createClientOnlyFn } from "@tanstack/react-start";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearScanOutcome,
  computeResults,
  loadDetails,
  loadFaceMetrics,
  loadRppg,
  saveFaceMetrics,
  saveAnswers,
  saveResults,
  saveRppg,
  saveSignalsBlob,
  saveExpression,
  skinAgeConfidence,
  touchSession,
  isSessionStale,
  clearAllScanState,
  type Answers,
  type FaceMetrics,
} from "../lib/scan-store";
import type { RppgResult } from "../lib/load-rppg.client";
import {
  sampleExpression,
  summarizeExpression,
  type ExpressionSample,
} from "../lib/expression";
import { estimateSkinAge } from "../lib/skin-age.functions";


/** Capture a JPEG data URL centered on the face bounding box for AI skin analysis. */
function captureFaceJpeg(
  video: HTMLVideoElement,
  box: { cx: number; cy: number; width: number; height: number } | null,
): string | null {
  try {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    // Expand the face box a bit so hairline/jaw context is included, then clamp to frame.
    const b = box ?? { cx: 0.5, cy: 0.5, width: 0.5, height: 0.65 };
    const pad = 1.25;
    const w = Math.min(1, b.width * pad);
    const h = Math.min(1, b.height * pad);
    const cx = Math.min(1 - w / 2, Math.max(w / 2, b.cx));
    const cy = Math.min(1 - h / 2, Math.max(h / 2, b.cy));
    const sx = Math.round((cx - w / 2) * vw);
    const sy = Math.round((cy - h / 2) * vh);
    const sw = Math.round(w * vw);
    const sh = Math.round(h * vh);
    // Target 384px on the long side — plenty for Gemini and keeps payload small.
    const target = 384;
    const scale = Math.min(1, target / Math.max(sw, sh));
    const dw = Math.max(64, Math.round(sw * scale));
    const dh = Math.max(64, Math.round(sh * scale));
    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch (err) {
    console.warn("[skin-age] frame capture failed", err);
    return null;
  }
}


type FaceDetectResult = {
  found: boolean;
  cx: number;
  cy: number;
  width: number;
  height: number;
  landmarks: { x: number; y: number; z: number }[];
  ear: number;
};

type FaceDetectorApi = {
  initFaceDetector: () => Promise<boolean>;
  detectFace: (video: HTMLVideoElement, timestamp: number) => FaceDetectResult;
};

const loadFaceDetector = createClientOnlyFn(async (): Promise<FaceDetectorApi> => {
  const mod = await import("../lib/face-detector.client");
  return {
    initFaceDetector: mod.initFaceDetector,
    detectFace: mod.detectFace,
  };
});

const loadMeshConnections = createClientOnlyFn(async () => {
  const mod = await import("../lib/face-detector.client");
  return mod.getFaceConnections();
});

const loadAgeEstimator = createClientOnlyFn(async () => {
  const mod = await import("../lib/age-estimator.client");
  return { initAgeEstimator: mod.initAgeEstimator, estimateAgeFromCrop: mod.estimateAgeFromCrop };
});

const loadRppgProcessor = createClientOnlyFn(async () => {
  const mod = await import("../lib/rppg/processor.client");
  return new mod.RppgProcessor();
});

type RppgProcessorApi = {
  reset: () => void;
  sample: (v: HTMLVideoElement, lm: { x: number; y: number }[], now: number) => void;
  sampleCount: () => number;
  compute: () => RppgResult | null;
};


export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Face Scan — VitalScan AI" },
      {
        name: "description",
        content: "20-second AI face scan capturing physiological signals.",
      },
    ],
  }),
  component: ScanPage,
});

const SCAN_SECONDS = 20;
const SCAN_MAX_SECONDS = 30; // adaptive extension when signal is Low
const ANALYZE_MIN_MS = 2800;
const ANALYZE_STAGES = [
  "Extracting pulse waveform…",
  "Analyzing your health profile…",
  "Finalizing your report…",
];
const FACE_HOLD_MS = 1000; // face must stay 1s before scan starts
const BLINK_EAR_THRESHOLD = 0.24;
const BLINK_DROP_RATIO = 0.72;
const BLINK_FRAMES_REQUIRED = 1;
const RPPG_WINDOW = 30; // frames to evaluate signal quality
const REQUIRED_FACE_RADIUS = 0.43;

const QUESTIONS: { id: keyof Answers; q: string; options: string[] }[] = [
  {
    id: "exercise",
    q: "Do you exercise 3+ times a week?",
    options: ["Yes", "No", "Sometimes"],
  },
  {
    id: "familyHistory",
    q: "Family history of diabetes or heart disease?",
    options: ["Yes", "No", "Not sure"],
  },
  {
    id: "friedFood",
    q: "Eat fried or processed food often?",
    options: ["Yes", "No", "Sometimes"],
  },
  {
    id: "sleep",
    q: "Sleep 6–7 hours regularly?",
    options: ["Yes", "No", "Sometimes"],
  },
];

function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const meshCanvasRef = useRef<HTMLCanvasElement>(null);
  const meshConnectionsRef = useRef<ReturnType<typeof Object> | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceFeatureRef = useRef({
    aspectSum: 0,
    eyeSum: 0,
    lowerSum: 0,
    mouthSum: 0,
    nasoSum: 0,
    greenSamples: [] as number[],
    n: 0,
  });
  const ageSamplesRef = useRef<number[]>([]);
  const ageEstimatorRef = useRef<{
    initAgeEstimator: () => Promise<boolean>;
    estimateAgeFromCrop: (
      v: HTMLVideoElement,
      box: { cx: number; cy: number; width: number; height: number },
    ) => Promise<{ age: number; brightness: number } | null>;
  } | null>(null);
  const ageBusyRef = useRef(false);
  const lastAgeAtRef = useRef(0);
  const lastFaceBoxRef = useRef<{ cx: number; cy: number; width: number; height: number } | null>(null);
  const rppgRefProc = useRef<RppgProcessorApi | null>(null);
  const expressionSamplesRef = useRef<ExpressionSample[]>([]);

  const lastEarRef = useRef(0.3);
  const lastMotionRef = useRef(0);
  const finishedRef = useRef(false);
  const scanStartedRef = useRef(false);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);
  // Monotonic display value — never moves backwards, so timing rescales
  // or brief pauses can never cause a jarring "went from 90% back to 60%"
  // effect in the UI.
  const [displayProgress, setDisplayProgress] = useState(0);
  const [camError, setCamError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStage, setAnalyzeStage] = useState(0);
  const [faceFound, setFaceFound] = useState(false);
  const [faceInCircle, setFaceInCircle] = useState(false);
  const [faceHeld, setFaceHeld] = useState(false); // face held for 1s
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [signalPaused, setSignalPaused] = useState(false);
  const [splitPhase, setSplitPhase] = useState<"idle" | "opened" | "closed">(
    "idle",
  );
  const showQuestionsRef = useRef(false);
  const targetSecondsRef = useRef(SCAN_SECONDS);
  const [targetSeconds, setTargetSeconds] = useState(SCAN_SECONDS);
  const [instructionsAck, setInstructionsAck] = useState(false);



  useEffect(() => {
    // If the user drifted away and came back after >30 min, wipe the partial
    // session and send them back to the details page for a clean restart.
    if (isSessionStale() || !loadDetails()) {
      clearAllScanState();
      navigate({ to: "/details" });
      return;
    }
    touchSession();
    clearScanOutcome();
  }, [navigate]);

  // Refs for tracking state across frames
  const detectorRef = useRef<FaceDetectorApi | null>(null);
  const blinkRef = useRef({ closedFrames: 0, wasClosed: false, openEarBaseline: 0.3 });
  const faceHeldRef = useRef(false);
  const introDoneRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rppgRef = useRef<{
    greenChannel: number[];
    motionDeltas: number[];
    lastCx: number;
    lastCy: number;
  }>({ greenChannel: [], motionDeltas: [], lastCx: 0.5, lastCy: 0.5 });

  useEffect(() => {
    progressRef.current = progress;
    setDisplayProgress((prev) => (progress > prev ? progress : prev));
  }, [progress]);

  useEffect(() => {
    faceHeldRef.current = faceHeld;
  }, [faceHeld]);

  useEffect(() => {
    introDoneRef.current = introDone;
  }, [introDone]);

  // Load MediaPipe model dynamically (client-only)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await loadFaceDetector();
        if (cancelled) return;
        detectorRef.current = mod;
        const ok = await mod.initFaceDetector();
        if (!cancelled) setModelLoading(!ok);
      } catch (e) {
        console.error("Failed to load face detector:", e);
        if (!cancelled) setModelLoading(false);
      }
    })();
    (async () => {
      try {
        const conns = await loadMeshConnections();
        if (!cancelled) meshConnectionsRef.current = conns;
      } catch (e) {
        console.error("Failed to load mesh connections:", e);
      }
    })();
    (async () => {
      try {
        const mod = await loadAgeEstimator();
        if (cancelled) return;
        ageEstimatorRef.current = mod;
        await mod.initAgeEstimator();
      } catch (e) {
        console.error("Failed to load age estimator:", e);
      }
    })();
    (async () => {
      try {
        const proc = await loadRppgProcessor();
        if (cancelled) return;
        rppgRefProc.current = proc as RppgProcessorApi;
      } catch (e) {
        console.error("Failed to load rPPG processor:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCamError("Camera not supported on this device.");
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setCamError(
          "Camera permission denied. Please allow access and refresh.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  // rPPG signal quality check
  const checkRppgQuality = useCallback(
    (
      landmarks: { x: number; y: number }[],
      cx: number,
      cy: number,
    ): boolean => {
      const rppg = rppgRef.current;

      // Motion check — face should be relatively still
      const motionDelta = Math.sqrt(
        (cx - rppg.lastCx) ** 2 + (cy - rppg.lastCy) ** 2,
      );
      rppg.lastCx = cx;
      rppg.lastCy = cy;
      rppg.motionDeltas.push(motionDelta);
      if (rppg.motionDeltas.length > RPPG_WINDOW)
        rppg.motionDeltas.shift();

      // Sample green channel from forehead region (landmarks around 10, 67, 109)
      if (landmarks.length > 0) {
        // Use average y of forehead landmarks as proxy for green channel variance
        const foreheadY =
          (landmarks[10]?.y ?? 0.3) + (landmarks[67]?.y ?? 0.3);
        rppg.greenChannel.push(foreheadY * 1000);
        if (rppg.greenChannel.length > RPPG_WINDOW)
          rppg.greenChannel.shift();
      }

      if (rppg.motionDeltas.length < 10) return true; // not enough data yet

      // Excessive motion → pause
      const avgMotion =
        rppg.motionDeltas.reduce((a, b) => a + b, 0) /
        rppg.motionDeltas.length;
      if (avgMotion > 0.03) return false;

      // Check signal variance — if green channel is flat (saturated/noisy), pause
      if (rppg.greenChannel.length >= 10) {
        const mean =
          rppg.greenChannel.reduce((a, b) => a + b, 0) /
          rppg.greenChannel.length;
        const variance =
          rppg.greenChannel.reduce((a, b) => a + (b - mean) ** 2, 0) /
          rppg.greenChannel.length;
        // Too little variance = saturated sensor; too much = noisy
        if (variance < 0.001 || variance > 500) return false;
      }

      return true;
    },
    [],
  );

  // Main detection loop — uses MediaPipe
  useEffect(() => {
    if (camError || modelLoading) return;
    let raf = 0;
    let frameCount = 0;

    const tick = () => {
      const v = videoRef.current;
      const det = detectorRef.current;
      frameCount++;

      // Run detection every 3rd frame for performance (was every 2nd — too heavy on mobile)
      if (frameCount % 3 === 0 && v && det && v.readyState >= 2) {
        const result = det.detectFace(v, performance.now());

        if (result.found && result.landmarks.length > 0) {
          // Stash latest face metrics for the async age sampler.
          lastFaceBoxRef.current = {
            cx: result.cx,
            cy: result.cy,
            width: result.width,
            height: result.height,
          };
          lastEarRef.current = result.ear;
          // Draw the glowing mesh overlay
          drawMesh(result.landmarks);
          // Accumulate face geometry features (used for skin-age estimation)
          accumulateFeatures(result.landmarks, v);
          // Face must fit inside the circular viewport, not just be detected.
          const dx = result.cx - 0.5;
          const dy = result.cy - 0.5;
          const faceRadius = Math.max(result.width, result.height) / 2;
          const faceFitsCircle = Math.sqrt(dx * dx + dy * dy) + faceRadius < REQUIRED_FACE_RADIUS;
          const faceSizeOk = result.width > 0.18 && result.width < 0.62 && result.height > 0.22 && result.height < 0.72;
          const inCircle = faceFitsCircle && faceSizeOk;

          // Track recent motion for age-sample gating.
          const rppg = rppgRef.current;
          if (rppg.motionDeltas.length > 0) {
            lastMotionRef.current =
              rppg.motionDeltas[rppg.motionDeltas.length - 1] ?? 0;
          }

          // Age sample: only when face is held, in-circle, eyes open, still, large.
          if (
            inCircle &&
            faceHeldRef.current &&
            result.ear > 0.22 &&
            lastMotionRef.current < 0.015 &&
            result.width > 0.28
          ) {
            maybeSampleAge(v);
          }

          // rPPG: pull mean RGB from forehead ROI every frame while the
          // scan is actively running and the face is properly aligned.
          if (
            inCircle &&
            scanStartedRef.current &&
            lastMotionRef.current < 0.02 &&
            rppgRefProc.current
          ) {
            rppgRefProc.current.sample(v, result.landmarks, performance.now());
          }

          // Expression sampling — accumulate mood signals during active scan.
          if (
            inCircle &&
            scanStartedRef.current &&
            !showQuestionsRef.current &&
            expressionSamplesRef.current.length < 600
          ) {
            const aspect =
              v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 1;
            const sample = sampleExpression(result.landmarks, result.ear, aspect);
            if (sample) expressionSamplesRef.current.push(sample);
          }





          setFaceFound(true);
          setFaceInCircle(inCircle);
          if (!inCircle && scanStartedRef.current && progressRef.current < 100 && !showQuestionsRef.current) {
            // Pause scanning — don't reset progress, just stop advancing.
            // Grace period: keep advancing while the user is answering a
            // question, so a brief glance away doesn't abort the scan.
            scanStartedRef.current = false;
            setSignalPaused(true);
          }

          // Blink detection via EAR only counts while the face is properly aligned.
          const blink = blinkRef.current;
          const heldNow = faceHeldRef.current;
          const introDoneNow = introDoneRef.current;
          if (inCircle && !introDoneNow && result.ear > blink.openEarBaseline) {
            blink.openEarBaseline = blink.openEarBaseline * 0.85 + result.ear * 0.15;
          }
          const blinkThreshold = Math.max(
            BLINK_EAR_THRESHOLD,
            blink.openEarBaseline * BLINK_DROP_RATIO,
          );
          if (inCircle && heldNow && !introDoneNow && result.ear < blinkThreshold) {
            blink.closedFrames++;
            if (
              blink.closedFrames >= BLINK_FRAMES_REQUIRED &&
              !blink.wasClosed
            ) {
              setBlinkDetected(true);
              blink.wasClosed = true;
            }
          } else {
            if (result.ear > blinkThreshold + 0.025) {
              blink.wasClosed = false;
            }
            blink.closedFrames = 0;
          }

          // rPPG quality — suspend the pause gate while the user is
          // actively reading/answering a mid-scan question.
          if (introDone && inCircle && !showQuestionsRef.current) {
            const signalOk = checkRppgQuality(
              result.landmarks,
              result.cx,
              result.cy,
            );
            setSignalPaused(!signalOk);
          } else if (!inCircle || showQuestionsRef.current) {
            setSignalPaused(false);
          }
        } else {
          clearMesh();
          setFaceFound(false);
          setFaceInCircle(false);
          setSignalPaused(false);
          if (scanStartedRef.current && progressRef.current < 100 && !showQuestionsRef.current) {
            // Pause scanning — don't reset progress, just stop advancing
            scanStartedRef.current = false;
            setSignalPaused(true);
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [camError, modelLoading, introDone, checkRppgQuality]);

  // Face hold timer — must stay in circle for 1 second
  useEffect(() => {
    if (faceInCircle && faceFound && !faceHeld) {
      if (holdTimerRef.current) return;
      holdTimerRef.current = setTimeout(() => {
        setFaceHeld(true);
        holdTimerRef.current = null;
      }, FACE_HOLD_MS);
    } else if (!faceInCircle || !faceFound) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      setFaceHeld(false);
      if (!introDone) setBlinkDetected(false);
    }
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [faceInCircle, faceFound, faceHeld, introDone]);

  // Intro: after face held, wait for blink to confirm
  useEffect(() => {
    if (faceHeld && blinkDetected && !introDone) {
      scanStartedRef.current = true;
      setIntroDone(true);
    }
  }, [faceHeld, blinkDetected, introDone]);

  // Progress — pauses when face leaves circle or signal is bad.
  // Target duration is adaptive: starts at SCAN_SECONDS and can extend up to
  // SCAN_MAX_SECONDS when the rPPG signal quality is poor.
  const canScan = introDone && faceFound && faceInCircle && !signalPaused;
  useEffect(() => {
    if (!canScan || progress >= 100) return;
    const step = 100 / (targetSeconds * 10);
    const t = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + step);
        return next;
      });
    }, 100);
    return () => clearInterval(t);
  }, [canScan, progress, targetSeconds]);

  const elapsed = (progress / 100) * targetSeconds;
  const allAnswered = QUESTIONS.every((question) => typeof answers[question.id] === "string");
  const scanComplete = progress >= 100;

  // Adaptive extension: when we cross the base duration with a weak signal,
  // bump the target out to SCAN_MAX_SECONDS so the rPPG buffer keeps filling.
  useEffect(() => {
    if (targetSecondsRef.current !== SCAN_SECONDS) return;
    if (elapsed < SCAN_SECONDS - 1) return;
    const snapshot = rppgRefProc.current?.compute() ?? null;
    const conf = snapshot?.confidence ?? "Low";
    if (conf === "Low") {
      targetSecondsRef.current = SCAN_MAX_SECONDS;
      setTargetSeconds(SCAN_MAX_SECONDS);
      // NOTE: we intentionally do NOT rescale the current progress value —
      // the progress bar must never move backwards. Instead, the next tick
      // uses the new (slower) step, so the bar simply advances more gently
      // to 100% over the extended window.
    }
  }, [elapsed]);

  // Questions split — only after the scan completes (camera/mesh stay live).
  useEffect(() => {
    if (splitPhase === "idle" && scanComplete) {
      setSplitPhase("opened");
    }
  }, [scanComplete, splitPhase]);

  useEffect(() => {
    if (splitPhase === "opened" && allAnswered) {
      const t = setTimeout(() => setSplitPhase("closed"), 450);
      return () => clearTimeout(t);
    }
  }, [splitPhase, allAnswered]);

  const showQuestions = splitPhase === "opened";
  useEffect(() => {
    showQuestionsRef.current = showQuestions;
  }, [showQuestions]);

  // Finalize — staged analyzer so users see real-looking AI processing.
  useEffect(() => {
    if (!scanComplete || !allAnswered || finishedRef.current) return;
    finishedRef.current = true;
    setAnalyzing(true);
    setAnalyzeStage(0);

    const startedAt = Date.now();
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const run = async () => {
      const details = loadDetails();
      const finalAnswers = answers as Answers;
      saveAnswers(finalAnswers);

      // Stage A — pulse extraction (real work).
      setAnalyzeStage(0);
      await sleep(50);
      try {
        const r = rppgRefProc.current?.compute();
        if (r) {
          saveRppg(r);
          saveSignalsBlob({
            rppg: r,
            sampleCount: rppgRefProc.current?.sampleCount?.() ?? 0,
          });
        }
      } catch (e) {
        console.warn("rPPG compute failed:", e);
      }

      // Persist face-derived metrics so computeResults can estimate skin age.
      const f = faceFeatureRef.current;
      const ageSamples = ageSamplesRef.current.slice();
      let predictedAge: number | null = null;
      let ageStdDev = 0;
      let keptCount = 0;
      const usable = ageSamples.length > 6 ? ageSamples.slice(3) : ageSamples;
      if (usable.length >= 3) {
        const sorted = [...usable].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const absDev = sorted
          .map((v) => Math.abs(v - median))
          .sort((a, b) => a - b);
        const mad = absDev[Math.floor(absDev.length / 2)] || 1;
        // Tighter outlier rejection — the underlying model is noisy, so a
        // narrow MAD window prevents a couple of wild frames from dragging
        // the reported age far from the true central tendency.
        const threshold = Math.max(3, 1.8 * mad);
        const kept = sorted.filter((v) => Math.abs(v - median) <= threshold);
        const finalSet = kept.length >= 3 ? kept : sorted;
        // Median (not mean) is far more robust to the remaining outliers
        // that survive the MAD filter — a single 80-year prediction can no
        // longer skew the reported skin age.
        const sortedFinal = [...finalSet].sort((a, b) => a - b);
        const finalMedian =
          sortedFinal[Math.floor(sortedFinal.length / 2)];
        const mean = finalSet.reduce((a, b) => a + b, 0) / finalSet.length;
        const variance =
          finalSet.reduce((a, b) => a + (b - mean) ** 2, 0) / finalSet.length;
        predictedAge = finalMedian;
        ageStdDev = Math.sqrt(variance);
        keptCount = finalSet.length;
      }
      if (f.n > 30 || predictedAge !== null) {
        const greens = f.greenSamples;
        const gMean = greens.length
          ? greens.reduce((a, b) => a + b, 0) / greens.length
          : 0;
        const gVar = greens.length
          ? greens.reduce((a, b) => a + (b - gMean) ** 2, 0) / greens.length
          : 0;
        const metrics: FaceMetrics = {
          aspectRatio: f.n ? f.aspectSum / f.n : 1.35,
          eyeAperture: f.n ? f.eyeSum / f.n : 0.3,
          lowerFaceRatio: f.n ? f.lowerSum / f.n : 0.44,
          mouthRatio: f.n ? f.mouthSum / f.n : 0.4,
          nasolabial: f.n ? f.nasoSum / f.n : 0.2,
          skinSmoothness: (Math.sqrt(gVar) / Math.max(1, gMean)) * 100,
          samples: f.n,
          predictedAge,
          ageSamples: keptCount,
          ageStdDev,
        };
        metrics.ageConfidence = skinAgeConfidence(metrics);

        // Gemini vision skin age — decoupled from entered age.
        // Silent fallback if the gateway is unreachable or returns an error.
        const v = videoRef.current;
        const imageDataUrl = v ? captureFaceJpeg(v, lastFaceBoxRef.current) : null;
        if (imageDataUrl) {
          try {
            const ai = await estimateSkinAge({ data: { imageDataUrl } });
            if (ai && Number.isFinite(ai.skinAge)) {
              metrics.geminiSkinAge = ai.skinAge;
              metrics.geminiConfidence = ai.confidence;
            }
          } catch (err) {
            console.warn("[skin-age] estimateSkinAge failed", err);
          }
        }

        saveFaceMetrics(metrics);
      }

      // Stage B — blending.
      await sleep(900);
      setAnalyzeStage(1);
      if (!details) {
        navigate({ to: "/details" });
        return;
      }
      // Summarize on-device expression/mood before computing results.
      const expressionSummary = summarizeExpression(
        expressionSamplesRef.current,
      );
      if (expressionSummary) saveExpression(expressionSummary);

      const results = computeResults(
        details,
        finalAnswers,
        loadFaceMetrics(),
        loadRppg(),
      );
      if (expressionSummary) results.expression = expressionSummary;
      saveResults(results);

      // Stage C — finalizing, plus enforce min wall-time so it doesn't feel instant.
      await sleep(700);
      setAnalyzeStage(2);
      const remaining = ANALYZE_MIN_MS - (Date.now() - startedAt);
      if (remaining > 0) await sleep(remaining);

      navigate({ to: "/results" });
    };

    run();
  }, [scanComplete, allAnswered, answers, navigate]);

  const answer = (val: string) => {
    const id = QUESTIONS[qIdx].id;
    setAnswers((a) => ({ ...a, [id]: val }));
    setQIdx((idx) => Math.min(QUESTIONS.length, idx + 1));
  };

  // ─── Mesh drawing ────────────────────────────────────────────────────────
  function clearMesh() {
    const c = meshCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx?.clearRect(0, 0, c.width, c.height);
  }

  // Premium mesh color palette — cool luxury tones, slow cycle.
  // Stops are evenly spaced; the active color is the lerp between the two
  // surrounding stops based on a 7s loop driven by performance.now().
  const MESH_STOPS: [number, number, number][] = [
    [120, 230, 255], // teal
    [140, 245, 235], // cyan
    [160, 255, 210], // mint
    [230, 245, 255], // pearl white
    [255, 200, 220], // soft blush
  ];
  function currentMeshRgb(): [number, number, number] {
    const t = ((performance.now() / 7000) % 1) * MESH_STOPS.length;
    const i = Math.floor(t);
    const f = t - i;
    const a = MESH_STOPS[i % MESH_STOPS.length];
    const b = MESH_STOPS[(i + 1) % MESH_STOPS.length];
    return [
      Math.round(a[0] + (b[0] - a[0]) * f),
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f),
    ];
  }

  function drawMesh(lm: { x: number; y: number; z: number }[]) {
    const c = meshCanvasRef.current;
    const v = videoRef.current;
    const conns = meshConnectionsRef.current as ReturnType<
      typeof import("../lib/face-detector.client").getFaceConnections
    > | null;
    if (!c || !v || !conns) return;
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const [r, g, b] = currentMeshRgb();
    const stroke = `rgba(${r}, ${g}, ${b}, 0.85)`;
    const glow = `rgba(${r}, ${g}, ${b}, 1)`;

    // Tesselation — triple-stroke for very intense stacked halo.
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.shadowColor = glow;
    // Outer huge halo pass
    ctx.lineWidth = 1.0;
    ctx.shadowBlur = 48;
    ctx.beginPath();
    for (const cn of conns.tesselation) {
      const a = lm[cn.start];
      const b2 = lm[cn.end];
      if (!a || !b2) continue;
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b2.x * w, b2.y * h);
    }
    ctx.stroke();
    // Mid halo
    ctx.shadowBlur = 28;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Crisp inner core
    ctx.shadowBlur = 10;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();

    // Bright contours — irises stay white for sparkle, rest cycle with palette.
    const brightGroups = [
      { conns: conns.oval,     rgb: `${r}, ${g}, ${b}`,        alpha: 1,    width: 1.8 },
      { conns: conns.lips,     rgb: `${r}, ${g}, ${b}`,        alpha: 1,    width: 2.0 },
      { conns: conns.leftEye,  rgb: `${r}, ${g}, ${b}`,        alpha: 1,    width: 1.7 },
      { conns: conns.rightEye, rgb: `${r}, ${g}, ${b}`,        alpha: 1,    width: 1.7 },
      { conns: conns.leftBrow, rgb: `${r}, ${g}, ${b}`,        alpha: 1,    width: 1.5 },
      { conns: conns.rightBrow,rgb: `${r}, ${g}, ${b}`,        alpha: 1,    width: 1.5 },
      { conns: conns.leftIris, rgb: `255, 255, 255`,           alpha: 1,    width: 1.9 },
      { conns: conns.rightIris,rgb: `255, 255, 255`,           alpha: 1,    width: 1.9 },
    ];
    for (const grp of brightGroups) {
      ctx.save();
      const color = `rgba(${grp.rgb}, ${grp.alpha})`;
      const colorGlow = `rgba(${grp.rgb}, 1)`;
      // Big outer halo
      ctx.lineWidth = grp.width * 1.4;
      ctx.strokeStyle = color;
      ctx.shadowColor = colorGlow;
      ctx.shadowBlur = 44;
      ctx.beginPath();
      for (const cn of grp.conns) {
        const a = lm[cn.start];
        const b2 = lm[cn.end];
        if (!a || !b2) continue;
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b2.x * w, b2.y * h);
      }
      ctx.stroke();
      // Mid halo
      ctx.lineWidth = grp.width * 1.1;
      ctx.shadowBlur = 22;
      ctx.stroke();
      // Crisp inner pass
      ctx.lineWidth = grp.width;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
    }

    // ─── Gleaming scan beam (vertical + horizontal sweep) clipped to face oval ───
    // Confined to the mesh bounding box so it stays *on the mesh* only.
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (const cn of conns.oval) {
      const p = lm[cn.start];
      if (!p) continue;
      const px = p.x * w, py = p.y * h;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    if (maxX > minX && maxY > minY) {
      const bw = maxX - minX, bh = maxY - minY;
      const tNow = performance.now();
      // Alternate sweeps: vertical, then horizontal, then vertical, ...
      const cycle = (tNow / 3600) % 1; // full cycle = 3.6s
      const isVertical = cycle < 0.5;
      const sweepT = isVertical ? cycle * 2 : (cycle - 0.5) * 2;
      const beamThickness = Math.max(8, bh * 0.06);

      ctx.save();
      // Clip to face oval polygon so beam never spills outside the mesh.
      ctx.beginPath();
      let first = true;
      for (const cn of conns.oval) {
        const p = lm[cn.start];
        if (!p) continue;
        const px = p.x * w, py = p.y * h;
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.clip();

      ctx.shadowColor = glow;
      ctx.shadowBlur = 30;

      if (isVertical) {
        const yPos = minY + sweepT * bh;
        const vGrad = ctx.createLinearGradient(0, yPos - beamThickness, 0, yPos + beamThickness);
        vGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        vGrad.addColorStop(0.5, `rgba(255, 255, 255, 0.85)`);
        vGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = vGrad;
        ctx.fillRect(minX, yPos - beamThickness, bw, beamThickness * 2);
      } else {
        const xPos = minX + sweepT * bw;
        const hGrad = ctx.createLinearGradient(xPos - beamThickness, 0, xPos + beamThickness, 0);
        hGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        hGrad.addColorStop(0.5, `rgba(255, 255, 255, 0.85)`);
        hGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = hGrad;
        ctx.fillRect(xPos - beamThickness, minY, beamThickness * 2, bh);
      }
      ctx.restore();
    }
  }


  // ─── Age sampling (gated to high-quality frames only) ────────────────────
  function maybeSampleAge(v: HTMLVideoElement) {
    const est = ageEstimatorRef.current;
    const box = lastFaceBoxRef.current;
    if (!est || !box || ageBusyRef.current) return;
    const now = performance.now();
    if (now - lastAgeAtRef.current < 500) return;
    lastAgeAtRef.current = now;
    ageBusyRef.current = true;
    est
      .estimateAgeFromCrop(v, box)
      .then((sample) => {
        if (sample && Number.isFinite(sample.age)) {
          ageSamplesRef.current.push(sample.age);
          if (ageSamplesRef.current.length > 60) ageSamplesRef.current.shift();
        }
      })
      .catch(() => {})
      .finally(() => {
        ageBusyRef.current = false;
      });
  }

  function accumulateFeatures(
    lm: { x: number; y: number; z: number }[],
    v: HTMLVideoElement,
  ) {
    if (!faceHeldRef.current) return;
    if (!lm[10] || !lm[152] || !lm[234] || !lm[454] || !lm[1] || !lm[61] || !lm[291])
      return;
    const f = faceFeatureRef.current;

    const faceTop = lm[10].y;
    const faceBottom = lm[152].y;
    const faceLeft = lm[234].x;
    const faceRight = lm[454].x;
    const faceH = Math.max(0.001, faceBottom - faceTop);
    const faceW = Math.max(0.001, faceRight - faceLeft);
    const aspect = faceH / faceW;

    // Lower face: nose tip (1) → chin (152) over total face height
    const noseY = lm[1].y;
    const lowerRatio = (faceBottom - noseY) / faceH;

    // Mouth width (61↔291) / face width
    const mouthW = Math.abs(lm[291].x - lm[61].x);
    const mouthRatio = mouthW / faceW;

    // Nasolabial proxy: nose tip → mouth corner / face height
    const nDx = lm[1].x - lm[61].x;
    const nDy = lm[1].y - lm[61].y;
    const naso = Math.sqrt(nDx * nDx + nDy * nDy) / faceH;

    // Eye aperture — reuse EAR landmarks
    const ear = (
      Math.abs(lm[159].y - lm[145].y) / Math.max(0.001, Math.abs(lm[133].x - lm[33].x)) +
      Math.abs(lm[386].y - lm[374].y) / Math.max(0.001, Math.abs(lm[263].x - lm[362].x))
    ) / 2;

    f.aspectSum += aspect;
    f.eyeSum += ear;
    f.lowerSum += lowerRatio;
    f.mouthSum += mouthRatio;
    f.nasoSum += naso;
    f.n += 1;

    // Sample forehead green channel from a small ROI for smoothness proxy
    if (f.n % 3 === 0) {
      const sc = sampleCanvasRef.current ?? document.createElement("canvas");
      sampleCanvasRef.current = sc;
      sc.width = 16;
      sc.height = 16;
      const sctx = sc.getContext("2d", { willReadFrequently: true });
      if (!sctx) return;
      const fx = lm[10].x * v.videoWidth;
      const fy = lm[10].y * v.videoHeight + (lm[151]?.y ?? lm[10].y) * 6;
      try {
        sctx.drawImage(v, fx - 16, fy, 32, 24, 0, 0, 16, 16);
        const data = sctx.getImageData(0, 0, 16, 16).data;
        let sum = 0;
        for (let i = 1; i < data.length; i += 4) sum += data[i];
        f.greenSamples.push(sum / (data.length / 4));
        if (f.greenSamples.length > 600) f.greenSamples.shift();
      } catch {
        // CORS / readback failure — skip
      }
    }
  }

  // Status logic
  const getStatus = () => {
    if (modelLoading) return { text: "Loading AI model…", color: "oklch(0.7 0.15 250)" };
    if (scanComplete && !allAnswered) return { text: "Scan complete — quick questions", color: "var(--good)" };
    if (!faceFound) return { text: "Position your face", color: "oklch(0.65 0.18 70)" };
    if (!faceInCircle) return { text: "Move into the circle", color: "oklch(0.65 0.18 70)" };
    if (!faceHeld) return { text: "Hold still…", color: "var(--info)" };
    if (!blinkDetected) return { text: "Blink once to start", color: "var(--info)" };
    if (signalPaused) return { text: "Hold still — calibrating…", color: "oklch(0.7 0.18 50)" };
    if (analyzing) return { text: "Analyzing…", color: "var(--good)" };
    return { text: `Scanning ${Math.min(99, Math.round(displayProgress))}%`, color: "var(--good)" };
  };

  const status = getStatus();
  const ringColor = status.color;
  const showOutOfFrame =
    introDone && (!faceFound || !faceInCircle) && progress > 0 && progress < 100;

  return (
    <main className="h-[100dvh] flex flex-col overflow-hidden">
      {!instructionsAck && !camError && (
        <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center px-6 animate-fade-up overflow-y-auto py-8">
          <div className="max-w-md w-full text-center">
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
              Before you begin
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              For an accurate scan, please make sure:
            </p>
            <ul className="mt-6 space-y-4 text-left">
              <li className="flex items-start gap-3 glass rounded-2xl px-4 py-3.5">
                <span className="mt-1 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground text-sm font-bold">1</span>
                <div>
                  <p className="font-semibold text-base">Well-lit area</p>
                  <p className="text-sm text-muted-foreground">Face a soft, even light source — avoid backlight or harsh shadows.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 glass rounded-2xl px-4 py-3.5">
                <span className="mt-1 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground text-sm font-bold">2</span>
                <div>
                  <p className="font-semibold text-base">Good internet connectivity</p>
                  <p className="text-sm text-muted-foreground">A stable connection helps the AI model load and process smoothly.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 glass rounded-2xl px-4 py-3.5">
                <span className="mt-1 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground text-sm font-bold">3</span>
                <div>
                  <p className="font-semibold text-base">Stay stable</p>
                  <p className="text-sm text-muted-foreground">Hold your device steady and remain still throughout the scan.</p>
                </div>
              </li>
            </ul>
            <button
              type="button"
              onClick={() => setInstructionsAck(true)}
              className="mt-7 w-full rounded-full bg-gradient-brand px-8 py-4 text-base font-semibold text-primary-foreground hover:opacity-95 transition"
            >
              I'm ready — start scan
            </button>
          </div>
        </div>
      )}

      <section
        className={`relative flex-shrink-0 overflow-hidden transition-all duration-700 ease-out ${
          showQuestions ? "h-[50%]" : "h-full"
        }`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {camError ? (
            <div className="text-center px-6">
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {camError}
              </p>
            </div>
          ) : (
            <div
              className="relative"
              style={{
                width: showQuestions
                  ? "min(58vw, 17rem)"
                  : "min(78vw, 28rem)",
                aspectRatio: "1",
                transition: "width 700ms ease-out",
              }}
            >
              <div
                className="absolute -inset-8 rounded-full blur-3xl opacity-90 animate-pulse-glow"
                style={{
                  background: `radial-gradient(circle, ${ringColor}, transparent 70%)`,
                }}
              />
              <div
                className="relative h-full w-full rounded-full overflow-hidden"
                style={{
                  boxShadow: `0 0 60px ${ringColor}, inset 0 0 0 2px ${ringColor}`,
                }}
              >
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`h-full w-full object-cover transition-transform duration-300 ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
                />
                <canvas
                  ref={meshCanvasRef}
                  className={`absolute inset-0 h-full w-full object-cover pointer-events-none mix-blend-screen transition-transform duration-300 ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
                />
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((m) => (m === "user" ? "environment" : "user"))
                  }
                  aria-label="Switch camera"
                  className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-black/55 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/70 active:scale-95 transition"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path d="M20 8h-3l-2-2H9L7 8H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V9a1 1 0 00-1-1z" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 14a3 3 0 003 3m3-3a3 3 0 01-3 3m0-6l2-2m-2 2l-2-2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Intro prompts */}
              {faceHeld && !blinkDetected && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="px-5 py-2.5 rounded-full bg-black/60 backdrop-blur-md text-white text-sm font-medium animate-fade-up">
                    Blink once to start
                  </div>
                </div>
              )}

              {faceFound && !faceHeld && faceInCircle && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="px-5 py-2.5 rounded-full bg-black/60 backdrop-blur-md text-white text-sm font-medium animate-fade-up">
                    Hold still…
                  </div>
                </div>
              )}

              {showOutOfFrame && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="px-5 py-2.5 rounded-full bg-black/75 backdrop-blur-md text-white text-sm font-medium">
                    Align your face inside the frame
                  </div>
                </div>
              )}

              {signalPaused && introDone && !showOutOfFrame && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="px-5 py-2.5 rounded-full bg-black/60 backdrop-blur-md text-amber-300 text-sm font-medium">
                    Too much movement — hold still
                  </div>
                </div>
              )}

              {!faceFound && progress === 0 && !modelLoading && (
                <div className="absolute inset-x-0 -bottom-12 text-center pointer-events-none">
                  <span className="text-sm text-muted-foreground">
                    Position your face inside the circle
                  </span>
                </div>
              )}

              {modelLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="px-5 py-2.5 rounded-full bg-black/70 backdrop-blur-md text-white text-sm font-medium flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    Loading AI model…
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top status */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-black/40 backdrop-blur text-white text-sm font-medium flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ background: ringColor }}
          />
          {status.text}
        </div>

        <div className="absolute bottom-0 inset-x-0 h-1 bg-black/10">
          <div
            className="h-full bg-gradient-brand transition-[width] duration-300 ease-linear"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </section>

      {showQuestions && !analyzing && (
        <section className="flex-1 min-h-0 glass-strong glass border-t px-5 py-5 flex flex-col justify-center animate-fade-up overflow-y-auto">
          <div className="max-w-[34rem] w-full mx-auto">
            {qIdx < QUESTIONS.length ? (
              <div key={qIdx} className="animate-fade-up text-center">
                <p className="text-sm uppercase tracking-wider text-muted-foreground font-medium">
                  Question {qIdx + 1} of {QUESTIONS.length}
                </p>
                <h2 className="mt-3 text-2xl sm:text-3xl font-semibold leading-tight">
                  {QUESTIONS[qIdx].q}
                </h2>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {QUESTIONS[qIdx].options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => answer(opt)}
                      className="rounded-full glass px-7 py-4 text-lg font-semibold min-w-[7rem] hover:bg-black/5 active:scale-95 transition border"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-lg text-muted-foreground animate-fade-up">
                Thanks — analyzing your scan…
              </div>
            )}
          </div>
        </section>
      )}


      {analyzing && (
        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center animate-fade-up">
          <div className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--teal)] animate-pulse" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--mint)] animate-pulse [animation-delay:200ms]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--azure)] animate-pulse [animation-delay:400ms]" />
          </div>
          <p className="mt-5 text-xl font-semibold">
            Analyzing Your Health Insights
          </p>
          <p className="mt-1 text-base text-muted-foreground transition-opacity">
            {ANALYZE_STAGES[analyzeStage] ?? "Just a moment…"}
          </p>
        </div>
      )}
    </main>
  );
}
