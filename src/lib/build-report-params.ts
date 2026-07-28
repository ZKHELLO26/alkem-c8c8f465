// Shared param builder for the PDF report. Mirrors the on-screen
// buildParams() in src/routes/results.tsx but without any React/icon deps
// so it can be imported from browser or server (Cloudflare Worker) code.
import type { ScanResults } from "./scan-store";

export type Status = "Low" | "Moderate" | "High" | "Normal" | "Info";

export type RawParam = {
  id: string;
  group: string;
  name: string;
  value: string;
  range: string;
  explain: string;
  status: Status;
};

function rangeStatus(value: number, lo: number, hi: number): Status {
  if (value >= lo && value <= hi) return "Normal";
  const span = hi - lo;
  const offBy = value < lo ? lo - value : value - hi;
  return offBy > span * 0.5 ? "High" : "Moderate";
}

export function buildRawParams(r: ScanResults, age: number): RawParam[] {
  const avgSys = Math.round((r.bpSysLow + r.bpSysHigh) / 2);
  const avgDia = Math.round((r.bpDiaLow + r.bpDiaHigh) / 2);
  const avgSpo2 = Math.round((r.spo2Low + r.spo2High) / 2);
  const bpStatus: Status =
    avgSys >= 140 || avgDia >= 90 ? "High"
      : avgSys < 100 || avgDia < 65 ? "Moderate"
      : avgSys >= 120 || avgDia >= 80 ? "Moderate"
      : "Normal";
  const spo2Status: Status = avgSpo2 < 90 ? "High" : avgSpo2 < 95 ? "Moderate" : "Normal";
  const stressLabel: Status = r.stress > 65 ? "High" : r.stress > 40 ? "Moderate" : "Low";

  return [
    { id: "hr", group: "Core Vitals", name: "Heart Rate", value: `${r.heartRate} bpm`, status: rangeStatus(r.heartRate, 60, 100), range: "60–100 bpm", explain: "Resting heart rate between 60–100 bpm is normal. Lower rates indicate better cardiovascular fitness. Elevated rates may signal stress, dehydration, or health concerns." },
    { id: "bp", group: "Core Vitals", name: "Blood Pressure", value: `${avgSys >= 140 ? "140+" : avgSys}/${avgDia >= 90 ? "90+" : avgDia} mmHg`, status: bpStatus, range: "Normal: < 120/80 mmHg", explain: `Systolic (${avgSys >= 140 ? "140+" : avgSys} mmHg) measures arterial pressure during heartbeats. Diastolic (${avgDia >= 90 ? "90+" : avgDia} mmHg) measures pressure between beats. Sustained high BP increases risk of heart disease and stroke.` },
    { id: "spo2", group: "Core Vitals", name: "Oxygen Saturation (SpO₂)", value: `${avgSpo2}%`, status: spo2Status, range: "Normal: 95–100%", explain: "Estimated from red and blue channel pulsation captured by the camera. Healthy levels stay between 95–100%. Lower readings can indicate respiratory or circulation issues." },
    { id: "resp", group: "Core Vitals", name: "Respiration Rate", value: `${r.respiration} br/min`, status: rangeStatus(r.respiration, 12, 20), range: "Normal: 12–20 br/min", explain: "Breaths per minute at rest. Normal is 12–20. Abnormal rates may suggest stress, respiratory infection, or other underlying conditions." },
    { id: "hrv", group: "Core Vitals", name: "Heart Rate Variability (HRV)", value: `${r.hrv} ms`, status: rangeStatus(r.hrv, 20, 70), range: "Normal: 20–70 ms", explain: "HRV measures beat-to-beat time variation. Higher HRV means better stress adaptability and recovery. Low HRV may indicate fatigue or elevated stress." },
    { id: "bmi", group: "Body Metrics", name: "Body Mass Index (BMI)", value: `${r.bmi}`, status: rangeStatus(r.bmi, 18.5, 24.9), range: "Normal: 18.5–24.9", explain: "BMI estimates body fat from height and weight. 18.5–24.9 is normal, 25–29.9 overweight, 30+ obese. It doesn't account for muscle mass." },
    { id: "absi", group: "Body Metrics", name: "A Body Shape Index (ABSI)", value: `${r.absi}`, status: r.absi > 0.09 ? "High" : r.absi > 0.083 ? "Moderate" : "Normal", range: "Normal: 0.07–0.08", explain: "ABSI factors in waist circumference, BMI, and height for a more accurate health risk picture. Higher values indicate more abdominal fat and increased cardiovascular risk." },
    { id: "iw", group: "Body Metrics", name: "Ideal Weight", value: `${r.idealWeight} kg`, status: "Info", range: "Based on BMI 22", explain: "Calculated as the weight for a BMI of 22 at your height — the healthiest reference point. Actual ideal may vary by body type." },
    { id: "bfat", group: "Body Metrics", name: "Body Fat %", value: `${r.bodyFatPct}%`, status: rangeStatus(r.bodyFatPct, 10, 25), range: "Normal: 10–25%", explain: "Estimated body fat percentage based on BMI and age. Excess body fat raises risk for metabolic and cardiovascular disease." },
    { id: "tbw", group: "Body Metrics", name: "Total Body Water", value: `${r.totalBodyWater} L`, status: "Info", range: "Varies by lean mass", explain: "Estimated total water content in the body, derived from lean body mass. Proper hydration supports every metabolic function." },
    { id: "bwp", group: "Body Metrics", name: "Body Water %", value: `${r.bodyWaterPct}%`, status: rangeStatus(r.bodyWaterPct, 45, 65), range: "Normal: 45–65%", explain: "Percentage of body weight that is water. Adequate hydration is critical for circulation, temperature regulation, and joint health." },
    { id: "bvol", group: "Body Metrics", name: "Blood Volume", value: `${r.bloodVolume} L`, status: "Info", range: "~7% of body weight", explain: "Estimated total blood volume based on body weight. Blood volume affects oxygen delivery, blood pressure regulation, and exercise capacity." },
    { id: "vo2", group: "Cardiovascular", name: "VO₂ Max", value: `${r.vo2Max} ml/kg/min`, status: rangeStatus(r.vo2Max, 30, 50), range: "Normal: 30–50 ml/kg/min", explain: "Maximum oxygen your body uses during exercise. Higher = better cardiovascular fitness. Regular aerobic exercise improves VO₂ Max significantly." },
    { id: "cw", group: "Cardiovascular", name: "Cardiac Workload", value: `${r.cardiacWorkload}`, status: rangeStatus(r.cardiacWorkload, 70, 110), range: "Normal: 70–110", explain: "Estimates how hard your heart works at rest using heart rate × blood pressure. Values above 110 suggest cardiovascular strain. Exercise and stress management can help lower it." },
    { id: "hrr", group: "Cardiovascular", name: "Heart Rate Reserve", value: `${r.hrr} bpm`, status: rangeStatus(r.hrr, 80, 140), range: `Normal: 80–140 bpm (Max HR: ${220 - age})`, explain: "Difference between your max heart rate and resting rate. A larger reserve means greater exercise capacity and better cardiovascular fitness." },
    { id: "co", group: "Cardiovascular", name: "Cardiac Output", value: `${r.cardiacOutput} L/min`, status: rangeStatus(r.cardiacOutput, 4, 8), range: "Normal: 4–8 L/min", explain: "Volume of blood pumped by the heart per minute. It determines how effectively oxygen and nutrients reach your tissues during rest and exercise." },
    { id: "map", group: "Cardiovascular", name: "Mean Arterial Pressure", value: `${r.map} mmHg`, status: rangeStatus(r.map, 70, 105), range: "Normal: 70–105 mmHg", explain: "Average blood pressure during a single cardiac cycle. MAP reflects the perfusion pressure driving blood to your organs." },
    { id: "hrmax", group: "Cardiovascular", name: "Heart Rate Max", value: `${r.hrMax} bpm`, status: "Info", range: "220 − age", explain: "Theoretical maximum heart rate based on age. Used to calculate exercise intensity zones, target heart rate, and cardiovascular reserve." },
    { id: "thrr", group: "Cardiovascular", name: "Target HR Range", value: `${r.targetHrLow}–${r.targetHrHigh} bpm`, status: "Info", range: "50–85% of HR Max", explain: "The heart rate zone for optimal cardiovascular exercise benefits. Training within this range maximizes fat burn and aerobic conditioning." },
    { id: "hu", group: "Cardiovascular", name: "Heart Utilized %", value: `${r.heartUtilized}%`, status: rangeStatus(r.heartUtilized, 30, 50), range: "Normal: 30–50% at rest", explain: "Percentage of maximum heart rate being used at rest. Lower values indicate a more efficient heart with greater reserve for physical demands." },
    { id: "sdnn", group: "Cardiovascular", name: "SDNN", value: `${r.sdnn} ms`, status: rangeStatus(r.sdnn, 20, 80), range: "Normal: 20–80 ms", explain: "Standard deviation of beat-to-beat intervals — reflects overall autonomic variability. Higher values indicate a healthier, more adaptable nervous system." },
    { id: "rmssd", group: "Cardiovascular", name: "RMSSD", value: `${r.rmssd} ms`, status: rangeStatus(r.rmssd, 15, 60), range: "Normal: 15–60 ms", explain: "Reflects parasympathetic (rest & digest) activity. Low values suggest reduced recovery capacity. Improves with sleep, hydration, and aerobic training." },
    { id: "pnn50", group: "Cardiovascular", name: "pNN50", value: `${r.pnn50}%`, status: rangeStatus(r.pnn50, 5, 40), range: "Normal: 5–40%", explain: "Percentage of consecutive beat intervals differing by more than 50 ms. Higher values indicate stronger vagal tone and better cardiac resilience." },
    { id: "bmr", group: "Cardiovascular", name: "Basal Metabolic Rate (BMR)", value: `${r.bmr} kcal/day`, status: "Info", range: "Calories burned at rest", explain: "BMR is the energy your body needs to perform basic life-sustaining functions at complete rest — breathing, circulation, cell production. Calculated from your gender, age, height, and weight." },
    { id: "tdee", group: "Cardiovascular", name: "Total Daily Energy Expenditure (TDEE)", value: `${r.tdee} kcal/day`, status: "Info", range: "BMR × activity factor", explain: "TDEE estimates the total calories you burn per day including movement and exercise, based on the activity level inferred from your questionnaire. Use it as a baseline for weight maintenance, loss, or gain." },
    { id: "htn", group: "Risk Indicators", name: "Hypertension Risk", value: r.hypertensionRisk, status: r.hypertensionRisk as Status, range: "Low is best", explain: "High blood pressure damages arteries over time, increasing risk of heart attack, stroke, and kidney disease. Often symptomless — regular monitoring is key." },
    { id: "diab", group: "Risk Indicators", name: "HbA1c Risk", value: r.diabetesRisk, status: r.diabetesRisk as Status, range: "Low is best", explain: "HbA1c reflects average blood sugar over 2–3 months. Elevated levels indicate insulin resistance and increased diabetes risk. Diet, exercise, and weight management help control it." },
    { id: "lip", group: "Risk Indicators", name: "Cholesterol Risk", value: r.dyslipidemiaRisk, status: r.dyslipidemiaRisk as Status, range: "Low is best", explain: "Excess LDL cholesterol builds plaques in arteries, raising heart attack and stroke risk. A balanced diet and regular exercise help maintain healthy levels." },
    { id: "obe", group: "Risk Indicators", name: "Obesity Risk", value: r.obesityRisk, status: r.obesityRisk as Status, range: "Low is best", explain: "Excess body fat increases risk of heart disease, diabetes, and joint issues. Even 5–10% weight loss can meaningfully reduce health risks." },
    { id: "cv", group: "Risk Indicators", name: "Cardiovascular Risk", value: r.cardioRisk, status: r.cardioRisk as Status, range: "Low is best", explain: "Combined estimate from BP, BMI, and lifestyle factors. Higher risk means greater chance of heart events. Exercise and balanced diet are the best defenses." },
    { id: "skin", group: "Skin & Wellness", name: "Estimated Skin Age", value: `${r.skinAge} yrs`, status: r.skinAgeConfidence === "High" ? "Normal" : r.skinAgeConfidence === "Medium" ? "Moderate" : "Info", range: `AI skin analysis · confidence: ${r.skinAgeConfidence}`, explain: "Estimated from visible facial skin cues (fine lines, texture, tone) by an AI vision model, independent of the age you entered. This is a wellness estimate only." },
    { id: "stress", group: "Skin & Wellness", name: "Stress Level", value: stressLabel, status: stressLabel, range: "Low is best", explain: "Derived from HRV analysis, sleep quality, dietary habits, and physical activity levels. Lower HRV correlates with higher stress. Poor sleep and sedentary lifestyle further elevate stress. Chronic stress weakens immunity, disrupts hormonal balance, and increases cardiovascular risk." },
  ];
}
