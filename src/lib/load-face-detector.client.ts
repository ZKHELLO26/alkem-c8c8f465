// Thin wrapper to dynamically import the client-only face detector
// without triggering TanStack's SSR import-protection in route files.

export async function loadFaceDetector() {
  const mod = await import("./face-detector.client");
  return {
    initFaceDetector: mod.initFaceDetector,
    detectFace: mod.detectFace,
  };
}