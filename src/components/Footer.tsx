import { useState } from "react";
import { LegalModal, type LegalKind } from "./LegalModal";

export function Footer() {
  const [open, setOpen] = useState<LegalKind | null>(null);
  return (
    <footer className="mt-16 border-t border-white/5 px-4 py-8 text-center text-xs text-muted-foreground/80">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => setOpen("privacy")}
          className="hover:text-foreground transition"
        >
          Privacy Policy
        </button>
        <span aria-hidden>·</span>
        <button
          type="button"
          onClick={() => setOpen("terms")}
          className="hover:text-foreground transition"
        >
          Terms and Conditions
        </button>
        <span aria-hidden>·</span>
        <span>Informational only — not a medical diagnosis.</span>
      </div>
      <div className="mt-2 opacity-60">
        © {new Date().getFullYear()} Zeikon Global · VitalScan AI
      </div>
      {open && <LegalModal kind={open} onClose={() => setOpen(null)} />}
    </footer>
  );
}
