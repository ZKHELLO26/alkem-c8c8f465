# Self-host MediaPipe — simple steps

## What this means

Your face-scan app uses a small "brain" file from Google's internet server. On slow camp Wi-Fi, downloading it takes time.

Self-hosting = keeping that same brain file on **your own app server** so it loads faster.

**You download 2 things. I do the code.**

---

## Step 1 — Download the brain file

1. Click this link:
   https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
2. A file named `face_landmarker.task` will download (about 3.7 MB).
3. Keep it on your desktop.

## Step 2 — Download 4 helper files

1. Go to:
   https://www.jsdelivr.com/package/npm/@mediapipe/tasks-vision?path=wasm
2. Download these 4 files:
   - `vision_wasm_internal.js`
   - `vision_wasm_internal.wasm`
   - `vision_wasm_nosimd_internal.js`
   - `vision_wasm_nosimd_internal.wasm`
3. Put them in a folder on your desktop called `wasm`.

## Step 3 — Send them to me

Drag and drop these into the chat:
- `face_landmarker.task`
- the `wasm` folder (or the 4 files inside it)

I will put them in your app and change the code to use them.

---

## Already done

✅ Face detector now warms up while the user fills the form. This makes the scan start 2–3 seconds faster.

## Supabase load

Free 500 MB plan = fine for about 3 months at 1,000 scans/day. Then upgrade to Pro ($25/month).

---

*File: `SELF_HOST_MEDIAPIPE.md` in the project root.*
