// Canonical consent text shown on /details. Bump CONSENT_VERSION in
// scan-store.ts AND edit CONSENT_TEXT together whenever legal copy changes.
// The SHA-256 hash of this exact string is recorded with every submission so
// we can prove which wording a user actually agreed to at that point in time.

export const CONSENT_TEXT = [
  "I agree to the Terms of Use and Privacy Policy.",
  "I understand this is a wellness tool, not a medical diagnosis.",
].join(" ");

export async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) return "";
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function consentTextHash(): Promise<string> {
  return sha256Hex(CONSENT_TEXT);
}
