import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { answersComplete, loadAnswers, loadResults, loadDetails, wellnessLabel, isSessionStale, clearAllScanState, touchSession, type ScanResults } from "../lib/scan-store";
import type { UserDetails } from "../lib/scan-store";

const TrendsSection = lazy(() => import("../components/TrendsSection"));

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Your Results — VitalScan AI" },
      { name: "description", content: "Your AI-estimated wellness vitals and risk indicators." },
    ],
  }),
  component: ResultsPage,
});

type Status = "Low" | "Moderate" | "High" | "Normal" | "Info";

type Param = {
  id: string;
  group: string;
  name: string;
  value: string;
  status: Status;
  range: string;
  explain: string;
  icon: React.ReactNode;
};

const statusColor = (s: Status) => {
  if (s === "Normal" || s === "Low") return "oklch(0.55 0.18 155)";
  if (s === "Moderate") return "oklch(0.65 0.18 70)";
  if (s === "High") return "oklch(0.58 0.22 25)";
  return "oklch(0.55 0.18 240)";
};

// One accent per group — disciplined multi-color (Vibrant Wellness).
const GROUP_ACCENT: Record<string, { grad: string; soft: string; tint: string; ring: string }> = {
  "Core Vitals":      { grad: "var(--gradient-brand)",  soft: "var(--shadow-teal)",   tint: "color-mix(in oklab, var(--teal) 18%, white)",     ring: "oklch(0.70 0.16 195 / 0.35)" },
  "Body Metrics":     { grad: "var(--gradient-mint)",   soft: "var(--shadow-mint)",   tint: "color-mix(in oklab, var(--mint) 18%, white)",     ring: "oklch(0.82 0.16 160 / 0.35)" },
  "Skin & Wellness":  { grad: "var(--gradient-violet)", soft: "var(--shadow-violet)", tint: "color-mix(in oklab, var(--violet) 16%, white)",   ring: "oklch(0.65 0.20 285 / 0.35)" },
  "Cardiovascular":   { grad: "var(--gradient-azure)",  soft: "var(--shadow-azure)",  tint: "color-mix(in oklab, var(--azure) 16%, white)",    ring: "oklch(0.66 0.18 245 / 0.35)" },
  "Risk Indicators":  { grad: "var(--gradient-coral)",  soft: "var(--shadow-coral)",  tint: "color-mix(in oklab, var(--coral) 18%, white)",    ring: "oklch(0.74 0.18 25 / 0.35)" },
};

const statusGlow = (s: Status, accentRing: string, accentSoft: string) => {
  // Status drives the inner ring + outer halo color (so users still scan at-a-glance),
  // but the resting drop-shadow uses the group accent for the layered, colored shadow
  // the Vibrant Wellness system asks for.
  if (s === "Normal" || s === "Low") return `${accentSoft}, 0 0 0 1.5px oklch(0.55 0.18 155 / 0.40) inset, 0 0 18px 2px oklch(0.55 0.18 155 / 0.25)`;
  if (s === "Moderate")               return `${accentSoft}, 0 0 0 1.5px oklch(0.65 0.18 70 / 0.45) inset,  0 0 22px 3px oklch(0.65 0.18 70 / 0.30)`;
  if (s === "High")                   return `${accentSoft}, 0 0 0 1.5px oklch(0.58 0.22 25 / 0.50) inset,  0 0 26px 4px oklch(0.58 0.22 25 / 0.35)`;
  return `${accentSoft}, 0 0 0 1.5px ${accentRing} inset`;
};


const I = {
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/></svg>
  ),
  lungs: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M12 3v10M6 21a3 3 0 01-3-3v-2a8 8 0 015-7l1 9a3 3 0 01-3 3zM18 21a3 3 0 003-3v-2a8 8 0 00-5-7l-1 9a3 3 0 003 3z"/></svg>,
  brain: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M9 3a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 003 3 3 3 0 003-3V3a3 3 0 00-3 0zM15 3a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-3 3 3 3 0 01-3-3"/></svg>,
  pulse: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>,
  drop: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M12 3s7 7 7 12a7 7 0 11-14 0c0-5 7-12 7-12z"/></svg>,
  scale: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M12 3v18M5 21h14M4 7h16M7 7l-3 7h6zM17 7l-3 7h6z"/></svg>,
  body: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><circle cx="12" cy="5" r="2"/><path d="M12 7v6m-4 8l4-8 4 8M8 13h8"/></svg>,
  bolt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg>,
  sparkles: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/></svg>,
};

/**
 * Range-aware status: flags both low AND high deviations.
 * - Inside [lo, hi]            → Good
 * - Mildly outside (≤ 50% off) → Moderate
 * - Severely outside           → High
 */
function rangeStatus(value: number, lo: number, hi: number): Status {
  if (value >= lo && value <= hi) return "Normal";
  const span = hi - lo;
  const offBy = value < lo ? lo - value : value - hi;
  return offBy > span * 0.5 ? "High" : "Moderate";
}

function buildParams(r: ScanResults, age: number): Param[] {
  const avgSys = Math.round((r.bpSysLow + r.bpSysHigh) / 2);
  const avgDia = Math.round((r.bpDiaLow + r.bpDiaHigh) / 2);
  const avgSpo2 = Math.round((r.spo2Low + r.spo2High) / 2);
  // ACC/AHA 2017 guidelines:
  //   Normal     <120 AND <80
  //   Elevated   120–129 AND <80          → Moderate
  //   Stage 1    130–139 OR 80–89         → Moderate
  //   Stage 2    ≥140 OR ≥90              → High
  //   Hypotension <100 OR <65             → Moderate (flag for attention)
  const bpStatus: Status =
    avgSys >= 140 || avgDia >= 90 ? "High"
      : avgSys < 100 || avgDia < 65 ? "Moderate"
      : avgSys >= 120 || avgDia >= 80 ? "Moderate"
      : "Normal";
  const spo2Status: Status = avgSpo2 < 90 ? "High" : avgSpo2 < 95 ? "Moderate" : "Normal";

  const stressLabel = r.stress > 65 ? "High" : r.stress > 40 ? "Moderate" : "Low";
  return [
    // Core Vitals
    { id: "hr", group: "Core Vitals", name: "Heart Rate", value: `${r.heartRate} bpm`, status: rangeStatus(r.heartRate, 60, 100), range: "60–100 bpm", explain: "Resting heart rate between 60–100 bpm is normal. Lower rates indicate better cardiovascular fitness. Elevated rates may signal stress, dehydration, or health concerns.", icon: I.heart },
    { id: "bp", group: "Core Vitals", name: "Blood Pressure", value: `${avgSys >= 140 ? "140+" : avgSys}/${avgDia >= 90 ? "90+" : avgDia} mmHg`, status: bpStatus, range: "Normal: < 120/80 mmHg", explain: `Systolic (${avgSys >= 140 ? "140+" : avgSys} mmHg) measures arterial pressure during heartbeats. Diastolic (${avgDia >= 90 ? "90+" : avgDia} mmHg) measures pressure between beats. Sustained high BP increases risk of heart disease and stroke.`, icon: I.heart },
    { id: "spo2", group: "Core Vitals", name: "Oxygen Saturation (SpO₂)", value: `${avgSpo2}%`, status: spo2Status, range: "Normal: 95–100%", explain: "Estimated from red and blue channel pulsation captured by the camera. Healthy levels stay between 95–100%. Lower readings can indicate respiratory or circulation issues.", icon: I.drop },
    { id: "resp", group: "Core Vitals", name: "Respiration Rate", value: `${r.respiration} br/min`, status: rangeStatus(r.respiration, 12, 20), range: "Normal: 12–20 br/min", explain: "Breaths per minute at rest. Normal is 12–20. Abnormal rates may suggest stress, respiratory infection, or other underlying conditions.", icon: I.lungs },
    { id: "hrv", group: "Core Vitals", name: "Heart Rate Variability (HRV)", value: `${r.hrv} ms`, status: rangeStatus(r.hrv, 20, 70), range: "Normal: 20–70 ms", explain: "HRV measures beat-to-beat time variation. Higher HRV means better stress adaptability and recovery. Low HRV may indicate fatigue or elevated stress.", icon: I.pulse },
    // Body Metrics
    { id: "bmi", group: "Body Metrics", name: "Body Mass Index (BMI)", value: `${r.bmi}`, status: rangeStatus(r.bmi, 18.5, 24.9), range: "Normal: 18.5–24.9", explain: "BMI estimates body fat from height and weight. 18.5–24.9 is normal, 25–29.9 overweight, 30+ obese. It doesn't account for muscle mass.", icon: I.scale },
    { id: "absi", group: "Body Metrics", name: "A Body Shape Index (ABSI)", value: `${r.absi}`, status: r.absi > 0.09 ? "High" : r.absi > 0.083 ? "Moderate" : "Normal", range: "Normal: 0.07–0.08", explain: "ABSI factors in waist circumference, BMI, and height for a more accurate health risk picture. Higher values indicate more abdominal fat and increased cardiovascular risk.", icon: I.body },
    { id: "iw", group: "Body Metrics", name: "Ideal Weight", value: `${r.idealWeight} kg`, status: "Info", range: "Based on BMI 22", explain: "Calculated as the weight for a BMI of 22 at your height — the healthiest reference point. Actual ideal may vary by body type.", icon: I.scale },
    { id: "bfat", group: "Body Metrics", name: "Body Fat %", value: `${r.bodyFatPct}%`, status: rangeStatus(r.bodyFatPct, 10, 25), range: "Normal: 10–25%", explain: "Estimated body fat percentage based on BMI and age. Excess body fat raises risk for metabolic and cardiovascular disease.", icon: I.body },
    { id: "tbw", group: "Body Metrics", name: "Total Body Water", value: `${r.totalBodyWater} L`, status: "Info", range: "Varies by lean mass", explain: "Estimated total water content in the body, derived from lean body mass. Proper hydration supports every metabolic function.", icon: I.drop },
    { id: "bwp", group: "Body Metrics", name: "Body Water %", value: `${r.bodyWaterPct}%`, status: rangeStatus(r.bodyWaterPct, 45, 65), range: "Normal: 45–65%", explain: "Percentage of body weight that is water. Adequate hydration is critical for circulation, temperature regulation, and joint health.", icon: I.drop },
    { id: "bvol", group: "Body Metrics", name: "Blood Volume", value: `${r.bloodVolume} L`, status: "Info", range: "~7% of body weight", explain: "Estimated total blood volume based on body weight. Blood volume affects oxygen delivery, blood pressure regulation, and exercise capacity.", icon: I.drop },
    // Cardiovascular
    { id: "vo2", group: "Cardiovascular", name: "VO₂ Max", value: `${r.vo2Max} ml/kg/min`, status: rangeStatus(r.vo2Max, 30, 50), range: "Normal: 30–50 ml/kg/min", explain: "Maximum oxygen your body uses during exercise. Higher = better cardiovascular fitness. Regular aerobic exercise improves VO₂ Max significantly.", icon: I.bolt },
    { id: "cw", group: "Cardiovascular", name: "Cardiac Workload", value: `${r.cardiacWorkload}`, status: rangeStatus(r.cardiacWorkload, 70, 110), range: "Normal: 70–110", explain: "Estimates how hard your heart works at rest using heart rate × blood pressure. Values above 110 suggest cardiovascular strain. Exercise and stress management can help lower it.", icon: I.heart },
    { id: "hrr", group: "Cardiovascular", name: "Heart Rate Reserve", value: `${r.hrr} bpm`, status: rangeStatus(r.hrr, 80, 140), range: `Normal: 80–140 bpm (Max HR: ${220 - age})`, explain: "Difference between your max heart rate and resting rate. A larger reserve means greater exercise capacity and better cardiovascular fitness.", icon: I.pulse },
    { id: "co", group: "Cardiovascular", name: "Cardiac Output", value: `${r.cardiacOutput} L/min`, status: rangeStatus(r.cardiacOutput, 4, 8), range: "Normal: 4–8 L/min", explain: "Volume of blood pumped by the heart per minute. It determines how effectively oxygen and nutrients reach your tissues during rest and exercise.", icon: I.heart },
    { id: "map", group: "Cardiovascular", name: "Mean Arterial Pressure", value: `${r.map} mmHg`, status: rangeStatus(r.map, 70, 105), range: "Normal: 70–105 mmHg", explain: "Average blood pressure during a single cardiac cycle. MAP reflects the perfusion pressure driving blood to your organs.", icon: I.heart },
    { id: "hrmax", group: "Cardiovascular", name: "Heart Rate Max", value: `${r.hrMax} bpm`, status: "Info", range: "220 − age", explain: "Theoretical maximum heart rate based on age. Used to calculate exercise intensity zones, target heart rate, and cardiovascular reserve.", icon: I.bolt },
    { id: "thrr", group: "Cardiovascular", name: "Target HR Range", value: `${r.targetHrLow}–${r.targetHrHigh} bpm`, status: "Info", range: "50–85% of HR Max", explain: "The heart rate zone for optimal cardiovascular exercise benefits. Training within this range maximizes fat burn and aerobic conditioning.", icon: I.bolt },
    { id: "hu", group: "Cardiovascular", name: "Heart Utilized %", value: `${r.heartUtilized}%`, status: rangeStatus(r.heartUtilized, 30, 50), range: "Normal: 30–50% at rest", explain: "Percentage of maximum heart rate being used at rest. Lower values indicate a more efficient heart with greater reserve for physical demands.", icon: I.heart },
    { id: "sdnn", group: "Cardiovascular", name: "SDNN", value: `${r.sdnn} ms`, status: rangeStatus(r.sdnn, 20, 80), range: "Normal: 20–80 ms", explain: "Standard deviation of beat-to-beat intervals — reflects overall autonomic variability. Higher values indicate a healthier, more adaptable nervous system.", icon: I.pulse },
    { id: "rmssd", group: "Cardiovascular", name: "RMSSD", value: `${r.rmssd} ms`, status: rangeStatus(r.rmssd, 15, 60), range: "Normal: 15–60 ms", explain: "Reflects parasympathetic (rest & digest) activity. Low values suggest reduced recovery capacity. Improves with sleep, hydration, and aerobic training.", icon: I.pulse },
    { id: "pnn50", group: "Cardiovascular", name: "pNN50", value: `${r.pnn50}%`, status: rangeStatus(r.pnn50, 5, 40), range: "Normal: 5–40%", explain: "Percentage of consecutive beat intervals differing by more than 50 ms. Higher values indicate stronger vagal tone and better cardiac resilience.", icon: I.pulse },
    // Energy
    { id: "bmr", group: "Cardiovascular", name: "Basal Metabolic Rate (BMR)", value: `${r.bmr} kcal/day`, status: "Info", range: "Calories burned at rest", explain: "BMR is the energy your body needs to perform basic life-sustaining functions at complete rest — breathing, circulation, cell production. Calculated from your gender, age, height, and weight.", icon: I.bolt },
    { id: "tdee", group: "Cardiovascular", name: "Total Daily Energy Expenditure (TDEE)", value: `${r.tdee} kcal/day`, status: "Info", range: "BMR × activity factor", explain: "TDEE estimates the total calories you burn per day including movement and exercise, based on the activity level inferred from your questionnaire. Use it as a baseline for weight maintenance, loss, or gain.", icon: I.bolt },
    // Risk Indicators
    { id: "htn", group: "Risk Indicators", name: "Hypertension Risk", value: r.hypertensionRisk, status: r.hypertensionRisk, range: "Low is best", explain: "High blood pressure damages arteries over time, increasing risk of heart attack, stroke, and kidney disease. Often symptomless — regular monitoring is key.", icon: I.shield },
    { id: "diab", group: "Risk Indicators", name: "HbA1c Risk", value: r.diabetesRisk, status: r.diabetesRisk, range: "Low is best", explain: "HbA1c reflects average blood sugar over 2–3 months. Elevated levels indicate insulin resistance and increased diabetes risk. Diet, exercise, and weight management help control it.", icon: I.shield },
    { id: "lip", group: "Risk Indicators", name: "Cholesterol Risk", value: r.dyslipidemiaRisk, status: r.dyslipidemiaRisk, range: "Low is best", explain: "Excess LDL cholesterol builds plaques in arteries, raising heart attack and stroke risk. A balanced diet and regular exercise help maintain healthy levels.", icon: I.shield },
    { id: "obe", group: "Risk Indicators", name: "Obesity Risk", value: r.obesityRisk, status: r.obesityRisk, range: "Low is best", explain: "Excess body fat increases risk of heart disease, diabetes, and joint issues. Even 5–10% weight loss can meaningfully reduce health risks.", icon: I.shield },
    { id: "cv", group: "Risk Indicators", name: "Cardiovascular Risk", value: r.cardioRisk, status: r.cardioRisk, range: "Low is best", explain: "Combined estimate from BP, BMI, and lifestyle factors. Higher risk means greater chance of heart events. Exercise and balanced diet are the best defenses.", icon: I.shield },
    // Skin
    { id: "skin", group: "Skin & Wellness", name: "Estimated Skin Age", value: `${r.skinAge} yrs`, status: r.skinAgeConfidence === "High" ? "Normal" : r.skinAgeConfidence === "Medium" ? "Moderate" : "Info", range: `AI skin analysis · confidence: ${r.skinAgeConfidence}`, explain: "Estimated from visible facial skin cues (fine lines, texture, tone) by an AI vision model, independent of the age you entered. This is a wellness estimate only.", icon: I.sparkles },
    { id: "stress", group: "Skin & Wellness", name: "Stress Level", value: stressLabel, status: stressLabel as Status, range: "Low is best", explain: "Derived from HRV analysis, sleep quality, dietary habits, and physical activity levels. Lower HRV correlates with higher stress. Poor sleep and sedentary lifestyle further elevate stress. Chronic stress weakens immunity, disrupts hormonal balance, and increases cardiovascular risk.", icon: I.brain },
  ];
}

function ScoreRing({ score }: { score: number }) {
  const radius = 88;
  const c = 2 * Math.PI * radius;
  const dash = (score / 100) * c;
  return (
    <div className="relative h-56 w-56">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.15 180)" />
            <stop offset="50%" stopColor="oklch(0.88 0.20 155)" />
            <stop offset="100%" stopColor="oklch(0.70 0.18 240)" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={radius} stroke="oklch(1 0 0 / 0.08)" strokeWidth="10" fill="none" />
        <circle
          cx="100" cy="100" r={radius}
          stroke="url(#ringG)" strokeWidth="10" fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ filter: "drop-shadow(0 0 10px oklch(0.78 0.15 180 / 0.5))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold text-gradient">{score}</span>
        <span className="text-xs text-muted-foreground mt-1">Wellness Score</span>
      </div>
    </div>
  );
}

function Card({ p }: { p: Param }) {
  const [open, setOpen] = useState(false);
  const dotColor = statusColor(p.status);
  const accent = GROUP_ACCENT[p.group] ?? GROUP_ACCENT["Core Vitals"];
  const glowShadow = statusGlow(p.status, accent.ring, accent.soft);
  return (
    <button
      onClick={() => setOpen((o) => !o)}
      className="text-left glass p-5 sm:p-6 transition duration-300 ease-out hover:scale-[1.02] hover:-translate-y-0.5 w-full"
      style={{ boxShadow: glowShadow, borderRadius: "1.25rem" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-2xl flex items-center justify-center text-white flex-shrink-0"
            style={{ background: accent.grad, boxShadow: accent.soft }}
          >
            {p.icon}
          </div>
          <h3 className="text-lg sm:text-xl font-bold leading-tight tracking-tight">{p.name}</h3>
        </div>
        <span
          className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-semibold whitespace-nowrap flex-shrink-0 mt-1"
          style={{ background: `color-mix(in oklab, ${dotColor} 15%, transparent)`, color: dotColor }}
        >
          {p.status}
        </span>
      </div>
      <div className="mt-3 ml-[3.25rem]">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight">{p.value}</div>
        <div className="mt-1.5 text-sm text-muted-foreground">{p.range}</div>
      </div>
      {open && (
        <div className="mt-4 pt-4 border-t animate-fade-up ml-[3.25rem] space-y-2">
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{p.explain}</p>
          <p className="text-xs sm:text-sm font-semibold text-[var(--teal)] leading-relaxed">
            Wellness indicator only — not a medical diagnosis.
          </p>
        </div>
      )}
      {!open && (
        <div className="mt-2 ml-[3.25rem]">
          <span className="text-xs text-muted-foreground/60">Tap for details ↓</span>
        </div>
      )}
    </button>
  );
}


const GROUPS = [
  { key: "Core Vitals", label: "Core Vitals", icon: "❤️" },
  { key: "Body Metrics", label: "Body Metrics", icon: "⚖️" },
  { key: "Skin & Wellness", label: "Skin & Wellness", icon: "✨" },
  { key: "Cardiovascular", label: "Cardiovascular", icon: "🫀" },
  { key: "Risk Indicators", label: "Risk Indicators", icon: "🛡️" },
];

function SourceBadge({ mode }: { mode: ScanResults["sourceMode"] }) {
  const label =
    mode === "rppg-led" ? "Facial scan + profile data"
      : mode === "hybrid" ? "Facial scan + profile data"
      : mode === "demographic-led" ? "Profile data (weak camera signal)"
      : "Profile data (camera unavailable)";
  return (
    <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground/80">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--teal)]" />
      {label}
    </div>
  );
}


function ResultsPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<ScanResults | null>(null);
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [age, setAge] = useState(30);
  const [activeGroup, setActiveGroup] = useState("Core Vitals");
  const [downloading, setDownloading] = useState(false);
  const [showTrends, setShowTrends] = useState(false);

  useEffect(() => {
    if (isSessionStale()) {
      clearAllScanState();
      navigate({ to: "/details" });
      return;
    }
    const r = loadResults();
    const d = loadDetails();
    const a = loadAnswers();
    if (!answersComplete(a)) {
      navigate({ to: "/scan" });
      return;
    }
    if (!r || !d) {
      navigate({ to: "/" });
      return;
    }
    touchSession();
    setResults(r);
    setDetails(d);
    setAge(d.age);
    // Fire-and-forget telemetry (only if user consented).
    import("../lib/telemetry-submit").then((m) => m.submitScanTelemetry()).catch(() => {});
    // Give telemetry a moment to land the new row, then enable trends.
    const t = setTimeout(() => setShowTrends(true), 1800);
    return () => clearTimeout(t);
  }, [navigate]);

  const params = useMemo(() => (results ? buildParams(results, age) : []), [results, age]);
  const activeParams = useMemo(() => params.filter((p) => p.group === activeGroup), [params, activeGroup]);

  const downloadPdf = async () => {
    if (!results || !details || downloading) return;
    setDownloading(true);
    try {
      const { generateReportPdf } = await import("../lib/report-pdf");
      const groupOrder = GROUPS.map((g) => g.key);
      const orderedParams = [...params].sort(
        (a, b) => groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group),
      );
      await generateReportPdf(
        details,
        results,
        orderedParams.map((p) => ({
          group: p.group,
          name: p.name,
          value: p.value,
          range: p.range,
          explain: p.explain,
          status: p.status,
        })),
        wellnessLabel(results.wellnessScore),
      );
    } finally {
      setDownloading(false);
    }
  };

  if (!results) return null;

  // Elevated BP guard — surface a prominent, non-alarming red banner when the
  // estimated systolic hits Stage 2 territory (≥140) or diastolic ≥90. Camera
  // rPPG is indicative only; we point users to a validated cuff and clinician.
  const _avgSys = Math.round((results.bpSysLow + results.bpSysHigh) / 2);
  const _avgDia = Math.round((results.bpDiaLow + results.bpDiaHigh) / 2);
  const bpElevated = _avgSys >= 140 || _avgDia >= 90;

  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="max-w-5xl mx-auto">
        {/* Wellness Score */}
        <div className="text-center animate-fade-up">
          <div className="text-sm uppercase tracking-wider text-muted-foreground font-medium">Your Wellness Report</div>
          {details?.doctorName && (
            <div className="mt-1 text-sm text-muted-foreground">
              Dr. {details.doctorName}
            </div>
          )}
          <div className="mt-8 flex justify-center">
            <ScoreRing score={results.wellnessScore} />
          </div>
          <div className="mt-4 text-2xl font-bold">{wellnessLabel(results.wellnessScore)}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--gold,#C9A24A)] font-semibold">Indicative, not diagnostic</div>
          <p className="mt-2 text-base text-muted-foreground max-w-md mx-auto">
            Tap any card to read a detailed explanation.
          </p>

          {bpElevated && (
            <div
              role="alert"
              className="mt-6 mx-auto max-w-2xl text-left rounded-2xl p-5 sm:p-6"
              style={{
                background: "color-mix(in oklab, oklch(0.58 0.22 25) 12%, transparent)",
                border: "1.5px solid oklch(0.58 0.22 25 / 0.55)",
                boxShadow: "0 0 30px -6px oklch(0.58 0.22 25 / 0.45), inset 0 0 0 1px oklch(0.58 0.22 25 / 0.25)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="h-10 w-10 rounded-2xl flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: "oklch(0.58 0.22 25)" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-lg sm:text-xl font-bold" style={{ color: "oklch(0.72 0.20 25)" }}>
                    Elevated blood pressure estimate
                  </div>
                  <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">
                    Your camera-estimated reading is <span className="font-semibold text-foreground">{_avgSys}/{_avgDia} mmHg</span>, which is in the elevated range. <span className="font-semibold text-foreground">Please don't panic</span> — this is a wellness estimate from a webcam, not a medical measurement, and it can be affected by lighting, motion, caffeine, or a stressed moment.
                  </p>
                  <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">
                    Please <span className="font-semibold text-foreground">recheck with a validated arm cuff</span> after resting quietly for 5 minutes, and consult a qualified clinician if the elevated reading persists.
                  </p>
                </div>
              </div>
            </div>
          )}


          {results.expression && (
            <div
              className="mt-6 mx-auto max-w-xl glass p-5 sm:p-6 text-left"
              style={{
                borderRadius: "1.25rem",
                boxShadow:
                  "var(--shadow-violet), 0 0 0 1.5px oklch(0.65 0.20 285 / 0.25) inset",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-2xl flex items-center justify-center text-white"
                    style={{ background: "var(--gradient-violet)", boxShadow: "var(--shadow-violet)" }}
                  >
                    {I.sparkles}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Mood Snapshot</div>
                    <div className="text-lg sm:text-xl font-bold tracking-tight">{results.expression.moodLabel}</div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                {results.expression.moodCopy}
              </p>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[
                  { label: "Smile",     v: results.expression.smileScore, grad: "var(--gradient-sunshine)", shadow: "var(--shadow-sunshine)" },
                  { label: "Alertness", v: results.expression.alertness,  grad: "var(--gradient-azure)",    shadow: "var(--shadow-azure)" },
                  { label: "Calmness",  v: results.expression.calmness,   grad: "var(--gradient-mint)",     shadow: "var(--shadow-mint)" },
                  { label: "Stability", v: results.expression.stability,  grad: "var(--gradient-violet)",   shadow: "var(--shadow-violet)" },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-2xl px-3 py-3 text-white"
                    style={{ background: m.grad, boxShadow: m.shadow }}
                  >
                    <div className="text-2xl font-bold tracking-tight">{m.v}</div>
                    <div className="text-[10px] uppercase tracking-wider opacity-90">{m.label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground/70">
                On-device only — derived from your facial expression during the scan.
              </p>
            </div>
          )}

        </div>

        {/* Category tabs + content */}
        <div className="mt-14">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Category sidebar (desktop) / horizontal tabs (mobile) */}
            <nav className="flex-shrink-0 lg:w-60">
              <div className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 lg:sticky lg:top-8" style={{ scrollbarWidth: "none" }}>
                {GROUPS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setActiveGroup(g.key)}
                    className={`flex items-center gap-2.5 px-4 py-3.5 rounded-xl text-left font-semibold whitespace-nowrap transition-all ${
                      activeGroup === g.key
                        ? "glass text-foreground shadow-lg"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                    style={
                      activeGroup === g.key
                        ? { boxShadow: "0 0 20px 2px oklch(0.78 0.15 180 / 0.2), inset 0 0 0 1px oklch(0.78 0.15 180 / 0.15)" }
                        : undefined
                    }
                  >
                    <span className="text-xl">{g.icon}</span>
                    <span className="text-sm lg:text-base">{g.label}</span>
                  </button>
                ))}
              </div>
            </nav>

            {/* Active category content */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl lg:text-3xl font-bold mb-6 animate-fade-up">{activeGroup}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" key={activeGroup}>
                {activeParams.map((p) => (
                  <Card key={p.id} p={p} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={downloadPdf}
            disabled={downloading}
            className="rounded-full bg-gradient-brand px-8 py-4 text-base font-semibold text-primary-foreground hover:opacity-95 transition text-center inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {downloading ? "Preparing PDF…" : "Download PDF Report"}
          </button>
          <Link to="/scan" className="rounded-full glass px-8 py-4 text-base font-semibold hover:bg-white/10 transition text-center">Re-scan</Link>
          <Link to="/" className="rounded-full glass px-8 py-4 text-base font-semibold hover:bg-white/10 transition text-center">Done</Link>
        </div>

        {showTrends && details?.mobile?.trim() && (
          <Suspense fallback={null}>
            <TrendsSection countryCode={details.countryCode} mobile={details.mobile} />
          </Suspense>
        )}

      </div>
    </main>
  );
}
