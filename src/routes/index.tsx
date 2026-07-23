import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import faceMale from "../assets/face-male.jpg";
import faceFemale from "../assets/face-female.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const [showFemale, setShowFemale] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setShowFemale((v) => !v), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="relative h-[100dvh] flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 md:px-10 pt-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-brand glow-teal" />
          <span className="font-semibold tracking-tight text-base">VitalScan AI</span>
        </div>
      </header>

      <section className="flex-1 min-h-0 flex flex-col items-center justify-between px-4 py-4 text-center">
        <div className="animate-fade-up max-w-lg flex-shrink-0">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1]">
            Instant Health Vitals
            <br />
            <span className="text-gradient">from Your Face</span>
          </h1>
          <p className="mt-2 text-base md:text-lg text-muted-foreground font-medium">
            Within Seconds
          </p>
        </div>

        {/* Face + floating vitals */}
        <div className="relative flex-1 min-h-0 w-full max-w-[min(70vh,40rem)] mx-auto my-4 animate-fade-up flex items-center justify-center">
          {/* Soft glow */}
          <div className="absolute inset-8 rounded-[40%] bg-gradient-brand opacity-20 blur-3xl animate-pulse-glow pointer-events-none" />

          {/* Face image */}
          <div className="relative overflow-hidden rounded-2xl" style={{ width: "55%", aspectRatio: "5/6" }}>
            <img
              src={faceMale}
              alt="AI face scan demo"
              width={640}
              height={768}
              className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-[2000ms] ${showFemale ? "opacity-0" : "opacity-100"}`}
            />
            <img
              src={faceFemale}
              alt=""
              aria-hidden="true"
              width={640}
              height={768}
              loading="lazy"
              className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-[2000ms] ${showFemale ? "opacity-100" : "opacity-0"}`}
            />
            {/* Scan line */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="absolute left-0 right-0 h-[2px]"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, oklch(0.78 0.15 180 / 0.8) 30%, oklch(0.88 0.20 155) 50%, oklch(0.78 0.15 180 / 0.8) 70%, transparent 100%)",
                  boxShadow: "0 0 12px 4px oklch(0.78 0.15 180 / 0.4)",
                  animation: "scanUpDown 3s ease-in-out infinite",
                }}
              />
            </div>
          </div>

          {/* Floating vitals — 3 on each side */}
          <FloatingVitals />
        </div>

        <div className="flex-shrink-0 flex flex-col items-center gap-3">
          <p className="text-sm md:text-base text-muted-foreground animate-fade-up">
            Contactless Wellness Insights
          </p>
          <button
            type="button"
            onClick={() => setShowDisclaimer(true)}
            className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-brand px-10 py-4 text-base md:text-lg font-semibold tracking-wide text-primary-foreground shadow-[0_10px_40px_-10px_oklch(0.62_0.16_200/0.6)] hover:scale-[1.02] transition-transform animate-pulse-glow"
          >
            CONTINUE
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </button>
        </div>
      </section>


      {showDisclaimer && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disclaimer-title"
          onClick={() => setShowDisclaimer(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white text-gray-900 shadow-2xl max-h-[85vh] flex flex-col animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-6 pt-6 pb-3">
              <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-lg font-bold">i</div>
              <h2 id="disclaimer-title" className="text-xl font-bold">Disclaimer</h2>
            </div>
            <div className="px-6 pb-4 overflow-y-auto text-[15px] leading-relaxed text-gray-700 space-y-4">
              <p>
                This tool collects specific personal information, including your name,
                phone number, height, weight, age and gender. This information is
                essential for tailoring the assessment and delivering an optimal
                experience.
              </p>
              <p>
                We are committed to protecting your privacy and handle your data with
                the utmost care. All data collected is securely stored and used solely
                for assessment purposes, in compliance with applicable privacy laws
                and regulations.
              </p>
              <p>
                By clicking Accept, you agree with the{" "}
                <a
                  href="https://termsandconditions.zeikonglobal.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Terms and Conditions
                </a>{" "}
                and{" "}
                <a
                  href="https://privacypolicy.zeikonglobal.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>
            <div className="px-6 pb-6 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDisclaimer(false);
                  navigate({ to: "/details" });
                }}
                className="w-full rounded-full bg-gradient-brand px-6 py-3.5 text-base font-semibold text-primary-foreground hover:opacity-95 transition"
              >
                Accept &amp; Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const VITALS = [
  { label: "Blood Pressure", icon: "❤️" },
  { label: "SpO₂", icon: "💧" },
  { label: "Stress Level", icon: "🧠" },
  { label: "Skin Age", icon: "✨" },
  { label: "HbA1c Risk", icon: "🛡️" },
  { label: "20+ Vitals", icon: "⚡" },
];

function FloatingVitals() {
  const leftItems = [VITALS[0], VITALS[2], VITALS[4]];
  const rightItems = [VITALS[1], VITALS[3], VITALS[5]];
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Left side */}
      {leftItems.map((v, i) => (
        <div
          key={v.label}
          className="absolute glass px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap flex items-center gap-1.5 shadow-lg"
          style={{
            top: `${12 + i * 28}%`,
            left: "2%",
            animation: `floatVital 3.5s ease-in-out ${i * 0.7}s infinite, fadeInVital 0.5s ease-out ${i * 0.2 + 0.2}s both`,
          }}
        >
          <span>{v.icon}</span>
          <span>{v.label}</span>
        </div>
      ))}
      {/* Right side */}
      {rightItems.map((v, i) => (
        <div
          key={v.label}
          className="absolute glass px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap flex items-center gap-1.5 shadow-lg"
          style={{
            top: `${12 + i * 28}%`,
            right: "2%",
            animation: `floatVital 3.5s ease-in-out ${i * 0.7 + 0.35}s infinite, fadeInVital 0.5s ease-out ${i * 0.2 + 0.3}s both`,
          }}
        >
          <span>{v.icon}</span>
          <span>{v.label}</span>
        </div>
      ))}
      <style>{`
        @keyframes floatVital {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeInVital {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scanUpDown {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}
