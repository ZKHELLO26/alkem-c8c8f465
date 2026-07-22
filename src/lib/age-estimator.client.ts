import { Human } from "@vladmandic/human";

let initPromise: Promise<boolean> | null = null;
let ready = false;
let human: Human | null = null;

// Reusable offscreen canvas for the face crop — avoids per-frame allocation.
let cropCanvas: HTMLCanvasElement | null = null;

export async function initAgeEstimator(): Promise<boolean> {
  if (ready) return true;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      human = new Human({
        backend: "webgl",
        debug: false,
        async: true,
        warmup: "none",
        cacheSensitivity: 0.01,
        modelBasePath: "https://vladmandic.github.io/human-models/models/",
        filter: { enabled: true, equalization: true, flip: false },
        face: {
          enabled: true,
          detector: {
            enabled: true,
            rotation: false,
            minConfidence: 0.4,
            minSize: 160,
            maxDetected: 1,
            return: false,
            mask: false,
            square: true,
            scale: 1.2,
          },
          mesh: { enabled: false },
          attention: { enabled: false },
          iris: { enabled: false },
          emotion: { enabled: false },
          antispoof: { enabled: false },
          liveness: { enabled: false },
          gear: { enabled: false },
          description: { enabled: true, minConfidence: 0.3 },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
      });
      await human.load();
      ready = true;
      return true;
    } catch (e) {
      console.error("[age-estimator] failed to load models", e);
      return false;
    }
  })();
  return initPromise;
}

export interface FaceBox {
  /** Normalized (0-1) face center and size in the source video. */
  cx: number;
  cy: number;
  width: number;
  height: number;
}

export interface AgeSample {
  age: number;
  /** Mean luma 0-255 of the cropped face — used to gate bad-lighting frames. */
  brightness: number;
}

/**
 * Run a single age estimate on a tight, aligned crop around the face box.
 * Returns null when the crop is unusable (out of bounds, too dark/bright,
 * or the detector finds nothing inside the crop).
 */
export async function estimateAgeFromCrop(
  video: HTMLVideoElement,
  box: FaceBox,
): Promise<AgeSample | null> {
  if (!ready || !human || video.readyState < 2) return null;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  // Expand the face box by 25% so chin / forehead are included, then square it.
  const pad = 1.25;
  const w = box.width * vw * pad;
  const h = box.height * vh * pad;
  const side = Math.min(vw, vh, Math.max(w, h));
  if (side < 64) return null; // face too small to be meaningful

  const cxPx = box.cx * vw;
  const cyPx = box.cy * vh;
  let sx = Math.round(cxPx - side / 2);
  let sy = Math.round(cyPx - side / 2);
  sx = Math.max(0, Math.min(vw - Math.round(side), sx));
  sy = Math.max(0, Math.min(vh - Math.round(side), sy));
  const sSide = Math.min(Math.round(side), vw - sx, vh - sy);
  if (sSide < 64) return null;

  // Draw to a 224x224 canvas for stable age inference on the cropped face.
  if (!cropCanvas) cropCanvas = document.createElement("canvas");
  cropCanvas.width = 224;
  cropCanvas.height = 224;
  const ctx = cropCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(video, sx, sy, sSide, sSide, 0, 0, 224, 224);
  } catch {
    return null;
  }

  // Brightness gate — reject very dark or blown-out crops.
  let lumaSum = 0;
  try {
    const data = ctx.getImageData(0, 0, 224, 224).data;
    // Sample every 4th pixel for speed
    let n = 0;
    for (let i = 0; i < data.length; i += 16) {
      lumaSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      n++;
    }
    const brightness = lumaSum / n;
    if (brightness < 55 || brightness > 215) return null;

    const res = await human.detect(cropCanvas);
    const face = res.face?.[0];
    const age = face?.age;
    if (!face || typeof age !== "number" || !Number.isFinite(age)) return null;
    return { age, brightness };
  } catch {
    return null;
  }
}
