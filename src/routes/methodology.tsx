import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology — VitalScan AI" },
      {
        name: "description",
        content:
          "How VitalScan AI estimates each wellness parameter from a contactless face scan. Full formulas, inputs, and references.",
      },
    ],
  }),
  component: MethodologyPage,
});

type Entry = {
  name: string;
  inputs: string;
  formula: string;
  reference: string;
};

const PIPELINE: { step: string; detail: string }[] = [
  { step: "1. Capture", detail: "Front camera streams at ~30 fps. MediaPipe FaceLandmarker detects 468 facial landmarks per frame." },
  { step: "2. ROI Extraction", detail: "A forehead patch (between brows, below hairline) is selected each frame. Mean R, G, B values are extracted." },
  { step: "3. POS Algorithm", detail: "RGB signal is projected onto a plane orthogonal to the average skin-tone vector to isolate the pulsatile component (Wang, IEEE TBME 2017)." },
  { step: "4. Bandpass", detail: "Two cascaded moving-average filters isolate 0.7–4 Hz (heart) and 0.13–0.5 Hz (respiration) bands." },
  { step: "5. Spectral Analysis", detail: "Goertzel DFT scans the HR band; peak frequency × 60 = bpm." },
  { step: "6. Peak Detection", detail: "Adaptive minimum-distance peak picking on the filtered pulse yields RR intervals for HRV time-domain metrics." },
  { step: "7. Risk Scoring", detail: "Validated published equations consume the derived vitals + user inputs to produce indicative risk bands." },
  { step: "8. Wellness Score", detail: "Composite of cardiovascular risk %, stress, BMI band, exercise and sleep — bounded 20–98." },
];

const VITALS: Entry[] = [
  {
    name: "Heart Rate",
    inputs: "Forehead PPG signal (rPPG)",
    formula: "Peak frequency of POS-derived pulse in 0.7–4 Hz band × 60",
    reference: "Wang et al., Algorithmic Principles of Remote PPG, IEEE TBME 2017",
  },
  {
    name: "Respiration Rate",
    inputs: "Same forehead PPG signal",
    formula: "Peak frequency in 0.13–0.5 Hz band × 60",
    reference: "Karlen et al., Multiparameter Resp. Rate, IEEE TBME 2013",
  },
  {
    name: "HRV / SDNN / RMSSD / pNN50",
    inputs: "RR intervals from PPG peak detection",
    formula:
      "SDNN = std(RR); RMSSD = √(mean(Δ²RR)); pNN50 = % consecutive Δ > 50 ms. Reject RR outside 300–1600 ms.",
    reference: "Task Force, Eur Heart J 1996, HRV Standards",
  },
  {
    name: "SpO₂ (research preview)",
    inputs: "R and B channel AC/DC ratio (RoR)",
    formula: "SpO₂ ≈ 110 − 25 · (R_AC/R_DC) / (B_AC/B_DC), clamped 85–100",
    reference: "Surrogate for IR — not clinical; de Haan-style RoR",
  },
];

const BP: Entry[] = [
  {
    name: "Blood Pressure (hybrid)",
    inputs: "Pulse-wave features (waveform amplitude, peak interval, augmentation proxy) + age + BMI",
    formula:
      "SBP ≈ 95 + 0.45·age + 0.6·(BMI−22) + 0.2·HR + waveAdj\nDBP ≈ 60 + 0.25·age + 0.35·(BMI−22) + 0.1·HR + waveAdj/2",
    reference: "Indicative composite, research-grade only",
  },
  {
    name: "Mean Arterial Pressure",
    inputs: "SBP, DBP",
    formula: "MAP = DBP + (SBP − DBP) / 3",
    reference: "Sesso et al., Hypertension 2000",
  },
  {
    name: "Cardiac Workload (Rate-Pressure Product)",
    inputs: "HR, SBP",
    formula: "RPP = (HR × SBP) / 100",
    reference: "Gobel et al., Circulation 1978",
  },
  {
    name: "Cardiac Output",
    inputs: "Stroke volume (estimated), HR",
    formula: "CO = SV × HR / 1000 (L/min)",
    reference: "Standard hemodynamic identity",
  },
];

const BODY: Entry[] = [
  {
    name: "BMI",
    inputs: "Weight (kg), Height (m)",
    formula: "BMI = kg / m²",
    reference: "Quetelet, 1832",
  },
  {
    name: "A Body Shape Index (ABSI)",
    inputs: "Waist (m), BMI, Height (m)",
    formula: "ABSI = waist / (BMI^(2/3) × √height)",
    reference: "Krakauer & Krakauer, PLoS ONE 2012",
  },
  {
    name: "Body Fat %",
    inputs: "BMI, age, gender",
    formula: "BF% = 1.20·BMI + 0.23·age − 10.8·sex − 5.4 (sex: 1=M, 0=F)",
    reference: "Deurenberg et al., Br J Nutr 1991",
  },
  {
    name: "Total Body Water / Body Water %",
    inputs: "Lean body mass",
    formula: "TBW = lean × 0.73",
    reference: "Watson formula, 1980",
  },
  {
    name: "Blood Volume",
    inputs: "Weight",
    formula: "BV ≈ 7% of body weight",
    reference: "Nadler et al., Surgery 1962",
  },
];

const ENERGY: Entry[] = [
  {
    name: "Basal Metabolic Rate (BMR)",
    inputs: "Weight, height, age, gender",
    formula:
      "Male:   10·kg + 6.25·cm − 5·age + 5\nFemale: 10·kg + 6.25·cm − 5·age − 161",
    reference: "Mifflin–St Jeor, Am J Clin Nutr 1990",
  },
  {
    name: "Total Daily Energy Expenditure",
    inputs: "BMR, activity level",
    formula:
      "TDEE = BMR × activity factor (1.2 sedentary → 1.55 active → 1.725 very active)",
    reference: "Harris-Benedict activity factors",
  },
  {
    name: "VO₂ Max (estimated)",
    inputs: "HR rest, max HR (220 − age)",
    formula: "VO₂ Max ≈ 15.3 × (HR_max / HR_rest)",
    reference: "Uth-Sørensen, Eur J Appl Physiol 2004",
  },
  {
    name: "Heart Rate Reserve / Target HR Zone",
    inputs: "HR rest, max HR",
    formula: "HRR = HR_max − HR_rest; Target zone = 50–85% of HR_max",
    reference: "ACSM Guidelines for Exercise Testing",
  },
];

const RISK: Entry[] = [
  {
    name: "Hypertension Risk (4-year)",
    inputs: "Age, gender, SBP, DBP, BMI, family history",
    formula:
      "Logistic risk: logit(p) = β·(age, SBP, DBP, BMI) + intercept; bands: <15% Low, 15–35% Moderate, >35% High",
    reference: "Parikh et al., Ann Intern Med 2008 (Framingham HTN model)",
  },
  {
    name: "Diabetes Risk (10-year)",
    inputs: "Age, BMI, waist, activity, diet, family history",
    formula:
      "Point system 0–26; bands: 1% (<7 pts) → 50% (≥21 pts)",
    reference: "Lindström & Tuomilehto, Diabetes Care 2003 (FINDRISC)",
  },
  {
    name: "Cardiovascular Risk (10-year)",
    inputs: "Age, gender, SBP, smoking, diabetes (cholesterol uses population mean)",
    formula:
      "Pooled Cohort Equation: p = 1 − S₁₀^exp(Σβ·x − mean)",
    reference: "Goff et al., ACC/AHA Guideline, Circulation 2014 (ASCVD)",
  },
  {
    name: "Cholesterol / Obesity Risk",
    inputs: "BMI, diet, exercise",
    formula: "Heuristic point sum; bands: <35 Low, 35–65 Moderate, ≥65 High",
    reference: "Indicative composite (no clinical equivalent without blood draw)",
  },
];

const SKIN: Entry[] = [
  {
    name: "Estimated Skin Age",
    inputs: "Face crop (224×224), face landmark quality, entered age as a plausibility anchor",
    formula:
      "Deep face-age model samples are median/MAD filtered and accepted only at Medium/High confidence. Final estimate is bounded near entered age; unreliable geometry falls back to entered-age anchor.",
    reference: "MIT-licensed Human library by Vladimir Mandic",
  },
  {
    name: "Stress Level",
    inputs: "HRV, sleep answer, diet answer, exercise answer",
    formula:
      "stress = 100 − HRV + sleep_penalty + diet_penalty + exercise_penalty (clamped 10–95). Inversely correlated with HRV.",
    reference: "Heuristic composite; HRV-stress link per Kim et al., Psychiatry Investig 2018",
  },
];

const SECTIONS: { title: string; entries: Entry[] }[] = [
  { title: "Core Vitals", entries: VITALS },
  { title: "Blood Pressure & Cardiovascular", entries: BP },
  { title: "Body Composition", entries: BODY },
  { title: "Energy & Fitness", entries: ENERGY },
  { title: "Risk Indicators", entries: RISK },
  { title: "Skin & Wellness", entries: SKIN },
];

function MethodologyPage() {
  const downloadPdf = async () => {
    const { generateMethodologyPdf } = await import("../lib/methodology-pdf");
    await generateMethodologyPdf(PIPELINE, SECTIONS);
  };

  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center animate-fade-up">
          <div className="text-sm uppercase tracking-wider text-muted-foreground font-medium">
            Reference Document
          </div>
          <h1 className="mt-2 text-3xl md:text-5xl font-bold tracking-tight">
            Methodology &{" "}
            <span className="text-gradient">Formulas</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            How every value in your VitalScan AI report is derived — the pipeline,
            the math, and the published references. Share this with clinicians or
            partners to explain the science.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={downloadPdf}
              className="rounded-full bg-gradient-brand px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-95 transition inline-flex items-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download as PDF
            </button>
            <Link to="/" className="rounded-full glass px-6 py-3 text-sm font-semibold hover:bg-white/5 transition">
              ← Back to home
            </Link>
          </div>
        </div>

        {/* Pipeline */}
        <section className="mt-14 animate-fade-up">
          <h2 className="text-2xl font-bold mb-6">Signal Pipeline</h2>
          <div className="glass p-6 md:p-8 space-y-4">
            {PIPELINE.map((p) => (
              <div key={p.step} className="flex gap-4">
                <div className="text-sm font-bold text-[var(--teal)] w-24 flex-shrink-0">
                  {p.step}
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {p.detail}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sections */}
        {SECTIONS.map((sec) => (
          <section key={sec.title} className="mt-12 animate-fade-up">
            <h2 className="text-2xl font-bold mb-6">{sec.title}</h2>
            <div className="space-y-4">
              {sec.entries.map((e) => (
                <div key={e.name} className="glass p-5 md:p-6">
                  <h3 className="text-lg font-bold text-foreground">{e.name}</h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div>
                      <dt className="inline font-semibold text-[var(--teal)]">Inputs: </dt>
                      <dd className="inline text-muted-foreground">{e.inputs}</dd>
                    </div>
                    <div>
                      <dt className="block font-semibold text-[var(--teal)] mb-1">Formula:</dt>
                      <dd className="text-muted-foreground font-mono text-xs whitespace-pre-line bg-black/5 rounded-md p-3">
                        {e.formula}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold text-[var(--teal)]">Reference: </dt>
                      <dd className="inline text-muted-foreground italic">{e.reference}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </section>
        ))}

        <p className="mt-14 text-center text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          <span className="font-semibold text-foreground">
            Indicative wellness tool — not a medical diagnosis.
          </span>{" "}
          This document describes how VitalScan AI computes its outputs. All values
          are AI estimates from a contactless scan and self-reported data. Always
          consult a qualified healthcare professional.
        </p>
      </div>
    </main>
  );
}
