import { useEffect } from "react";

export type LegalKind = "privacy" | "terms";

const PRIVACY_POINTS = [
  "We collect only what's needed: your details, lifestyle answers, and scan results.",
  "Your face video is never recorded or stored — only the wellness signals derived from it.",
  "We never perform facial recognition or identity matching.",
  "We never sell your data or share it with insurers or advertisers.",
  "Data is sent over HTTPS and stored on secure, access-controlled infrastructure.",
  "Submissions are kept for up to 24 months, then anonymized or deleted.",
  "You can request access, correction, or deletion of your data at any time.",
  "This is a wellness tool — not a medical device and not a diagnosis.",
  "Intended for users 18 years and older.",
];

const TERMS_POINTS = [
  "By using this service, you agree to these terms.",
  "This is a wellness tool for informational purposes only — not a medical diagnosis.",
  "Never use it in an emergency. Always consult a qualified healthcare professional.",
  "Results are AI estimates and may be inaccurate.",
  "You must be at least 18 years old to use the service.",
  "Please provide accurate information so results are meaningful.",
  "Don't attempt to reverse-engineer, scrape, or misuse the service.",
  "The service is provided \"as is\" without warranties of any kind.",
  "We are not liable for health decisions made based on the output.",
  "Terms may be updated from time to time.",
];

export function LegalModal({
  kind,
  onClose,
}: {
  kind: LegalKind;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const isPrivacy = kind === "privacy";
  const title = isPrivacy ? "Privacy Policy" : "Terms and Conditions";
  const points = isPrivacy ? PRIVACY_POINTS : TERMS_POINTS;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-white/10 bg-[oklch(0.18_0.02_220)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-3 border-b border-white/5">
          <h2 id="legal-modal-title" className="text-xl font-bold text-gradient">{title}</h2>
          <p className="mt-1 text-xs text-white/60">Last updated: June 2026</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <ul className="space-y-3">
            {points.map((p, i) => (
              <li key={i} className="flex gap-3 text-sm text-white/90 leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--teal)]" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>


        <div className="px-6 py-4 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
