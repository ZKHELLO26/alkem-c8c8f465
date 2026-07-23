# Self-hosting the MediaPipe model — baby steps

## Why do this?

Right now the face-scan tool downloads a ~10 MB brain (the "model") from Google's public CDN every time a new person opens the app on a new device. On a slow camp Wi-Fi, this is the biggest cause of "why is it loading?" delays.

If we host that file on **your own domain**, it becomes 2–3× faster on first load, and cached forever afterwards.

**Difficulty:** Easy. You just download 2 files and drop them in a folder. I do the code part.

---

## What you need to do (5 minutes)

### Step 1 — Download the model file

1. Open this link in your browser:
   👉 https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
2. It will download a file called **`face_landmarker.task`** (about 3.7 MB).
3. Keep it on your desktop for now.

### Step 2 — Download the WASM helper files

1. Open this link:
   👉 https://www.jsdelivr.com/package/npm/@mediapipe/tasks-vision?path=wasm
2. You'll see a list of files. Download **all** of these (click each, then "Download"):
   - `vision_wasm_internal.js`
   - `vision_wasm_internal.wasm`
   - `vision_wasm_nosimd_internal.js`
   - `vision_wasm_nosimd_internal.wasm`
3. Put them together in a folder on your desktop called **`wasm`**.

### Step 3 — Send them to me

Upload these to the chat:
- The `face_landmarker.task` file
- The `wasm` folder (or all 4 files individually — either works)

Just drag & drop them into the chat window here.

### Step 4 — I do the rest

Once you upload, I will:
- Put them in the app's `public/mediapipe/` folder
- Change the code to load them from **your** domain instead of Google's
- Verify the scan still works

That's it. No coding on your side.

---

## Other things I already did (right now, no input needed from you)

✅ **Warmed up the face detector on the registration page** — while the user is typing their name/mobile/height, the app now silently loads MediaPipe in the background. By the time they hit "Start Scan", it's already ready. **This alone shaves ~2–3 seconds** off the scan start.

---

## Things that need more work (later, if you want)

These are bigger changes — tell me if you want any of them:

- **🟡 Move heavy math to a background thread** — the heart-rate calculation currently runs on the main thread. Moving it to a "Web Worker" would make the UI smoother on cheap Android phones. (I'd do it, but it needs ~30 min of testing.)
- **🟡 Lazy-load the PDF library** — the PDF report code loads even for users who never download the PDF. Splitting it saves ~200 KB on first load.
- **🔴 Add offline / retry logic** — if a camp has spotty Wi-Fi, scans might fail to reach Supabase. We could queue them locally and retry when internet returns.

Just say the word for any of these.

---

## About Supabase load (1,000 scans/day)

Short answer: **you're fine on the free 500 MB tier for ~3 months**, then you'd upgrade to the $25/month Pro plan (8 GB, plenty of headroom).

- Each scan = ~5 KB in the database
- 1,000 scans/day × 5 KB = 5 MB/day = 150 MB/month
- Free tier handles the request volume easily (500 requests/sec limit, you'd be at ~0.05/sec average)

**Only worry:** don't start uploading scan videos/photos to Supabase Storage. Metadata-only, like it is now, is cheap. Videos would fill 500 MB in ~50 scans.
