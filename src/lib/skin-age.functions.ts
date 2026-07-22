import { createServerFn } from "@tanstack/react-start";

/**
 * Skin-age estimation via Lovable AI Gateway (Gemini vision).
 *
 * Intentionally decoupled from the user's entered age — the caller must NOT
 * anchor the returned value against any user-supplied number, or the whole
 * point of running a vision model is lost.
 *
 * Returns `null` on any gateway failure (network, 402 credits exhausted,
 * 429 rate limited, unparseable response). The scan pipeline then falls
 * back to the on-device face-age model with today's anchoring behaviour.
 */
export const estimateSkinAge = createServerFn({ method: "POST" })
  .inputValidator((input: { imageDataUrl: string }) => {
    if (
      !input ||
      typeof input.imageDataUrl !== "string" ||
      !input.imageDataUrl.startsWith("data:image/")
    ) {
      throw new Error("imageDataUrl must be a data:image/... URL");
    }
    // ~4MB base64 cap; the scan snapshot is well under this.
    if (input.imageDataUrl.length > 6_000_000) {
      throw new Error("image too large");
    }
    return input;
  })
  .handler(async ({ data }): Promise<{
    skinAge: number;
    confidence: "High" | "Medium" | "Low";
  } | null> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      console.warn("[skin-age] LOVABLE_API_KEY missing; skipping");
      return null;
    }

    const prompt =
      "You are a dermatology-adjacent visual estimator. Look at the visible skin on the face in the image and estimate the person's apparent skin age in whole years based ONLY on visible skin cues (fine lines, wrinkles, skin texture/tone evenness, under-eye area, nasolabial fold depth, jawline definition). " +
      "Do NOT guess based on hairstyle, clothing, makeup, or accessories. " +
      "Return STRICT JSON matching exactly this shape and nothing else: " +
      '{"skinAge": <integer 12-90>, "confidence": "High" | "Medium" | "Low"}. ' +
      "Confidence should be Low if the face is small, blurry, oddly lit, or partially covered; Medium if usable but imperfect; High only for a clear, well-lit, unobstructed face.";

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: data.imageDataUrl } },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn(`[skin-age] gateway ${res.status}: ${body.slice(0, 300)}`);
        return null;
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content) as {
        skinAge?: unknown;
        confidence?: unknown;
      };
      const ageNum = Number(parsed.skinAge);
      if (!Number.isFinite(ageNum)) return null;
      const skinAge = Math.round(Math.max(12, Math.min(90, ageNum)));
      const conf = String(parsed.confidence ?? "").toLowerCase();
      const confidence: "High" | "Medium" | "Low" =
        conf === "high" ? "High" : conf === "medium" ? "Medium" : "Low";
      return { skinAge, confidence };
    } catch (err) {
      console.warn("[skin-age] request failed", err);
      return null;
    }
  });
