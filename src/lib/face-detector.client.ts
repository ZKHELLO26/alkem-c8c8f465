// Client-only MediaPipe FaceLandmarker wrapper
// Do NOT import this file from server code — it uses browser APIs.

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export interface FaceDetectResult {
  found: boolean;
  /** Normalized face bounding box center & size (0-1) */
  cx: number;
  cy: number;
  width: number;
  height: number;
  /** 478 landmarks normalized 0-1 */
  landmarks: { x: number; y: number; z: number }[];
  /** Eye aspect ratio for blink detection (average of both eyes) */
  ear: number;
  /** Detection confidence 0-1 */
  confidence: number;
}

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

let landmarker: FaceLandmarker | null = null;
let initPromise: Promise<void> | null = null;
let initFailed = false;

/** Distance between two 2D points */
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Eye Aspect Ratio — ratio of vertical to horizontal eye opening.
 * Below ~0.21 → eye closed (blink).
 * MediaPipe eye landmark indices:
 *   Right eye: top 159, bottom 145, inner 133, outer 33
 *   Left eye:  top 386, bottom 374, inner 362, outer 263
 */
function calcEAR(lm: { x: number; y: number }[], aspect = 1): number {
  // aspect = videoWidth / videoHeight. MediaPipe returns coords normalized
  // independently by width (x) and height (y), so on a non-square frame the
  // vertical eye opening is scaled differently from the horizontal one. We
  // convert y into x-equivalent units (multiply by aspect) so the ratio is
  // geometrically correct — otherwise EAR is distorted identically for every
  // person, crushing the inter-person variance the mood scores rely on.
  const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, (a.y - b.y) * aspect);
  // Right eye
  const rVert1 = d(lm[159], lm[145]);
  const rVert2 = d(lm[158], lm[153]);
  const rHoriz = d(lm[33], lm[133]);
  const rEar = (rVert1 + rVert2) / (2 * rHoriz);

  // Left eye
  const lVert1 = d(lm[386], lm[374]);
  const lVert2 = d(lm[385], lm[380]);
  const lHoriz = d(lm[263], lm[362]);
  const lEar = (lVert1 + lVert2) / (2 * lHoriz);

  return (rEar + lEar) / 2;
}

export async function initFaceDetector(): Promise<boolean> {
  if (landmarker) return true;
  if (initFailed) return false;
  if (initPromise) {
    await initPromise;
    return !!landmarker;
  }

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    } catch (e) {
      console.error("FaceLandmarker init failed:", e);
      initFailed = true;
    }
  })();

  await initPromise;
  return !!landmarker;
}

const NO_FACE: FaceDetectResult = {
  found: false,
  cx: 0.5,
  cy: 0.5,
  width: 0,
  height: 0,
  landmarks: [],
  ear: 0.3,
  confidence: 0,
};

let lastTimestamp = -1;

export function detectFace(
  video: HTMLVideoElement,
  timestamp: number,
): FaceDetectResult {
  if (!landmarker || video.readyState < 2) return NO_FACE;

  // MediaPipe requires strictly increasing timestamps
  if (timestamp <= lastTimestamp) timestamp = lastTimestamp + 1;
  lastTimestamp = timestamp;

  try {
    const result = landmarker.detectForVideo(video, timestamp);
    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
      return NO_FACE;
    }

    const lm = result.faceLandmarks[0];

    // Bounding box from landmarks
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const p of lm) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const aspect =
      video.videoWidth && video.videoHeight
        ? video.videoWidth / video.videoHeight
        : 1;
    const ear = calcEAR(lm, aspect);

    return {
      found: true,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      width: maxX - minX,
      height: maxY - minY,
      landmarks: lm,
      ear,
      confidence: 1,
    };
  } catch {
    return NO_FACE;
  }
}

/** FACE_OVAL landmark indices for mesh contour */
export const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

/** Returns canonical MediaPipe FaceLandmarker connection groups. */
export function getFaceConnections() {
  return {
    tesselation: FaceLandmarker.FACE_LANDMARKS_TESSELATION,
    oval: FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
    lips: FaceLandmarker.FACE_LANDMARKS_LIPS,
    leftEye: FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    rightEye: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    leftBrow: FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
    rightBrow: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
    leftIris: FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
    rightIris: FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
  };
}