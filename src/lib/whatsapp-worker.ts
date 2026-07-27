import { jsPDF } from "jspdf";
import type { Json } from "@/integrations/supabase/types";

const BUCKET = "whatsapp-reports";
const SIGNED_URL_TTL_SEC = 60 * 60 * 24;

type ReportDetails = {
  name?: string;
  countryCode?: string;
  mobile?: string;
  age?: number;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  doctorName?: string;
  employeeName?: string;
};

type ReportPayload = {
  details?: ReportDetails;
  results?: Record<string, unknown>;
  answers?: Record<string, unknown>;
};

type QueueRow = {
  id: string;
  scan_id: string;
  name: string | null;
  country_code: string | null;
  mobile: string | null;
  report_payload: Json | null;
};

type AdminClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  storage: {
    from: (bucket: string) => {
      upload: (path: string, bytes: Uint8Array, options: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      createSignedUrl: (path: string, ttl: number) => Promise<{ data: { signedUrl?: string } | null; error: { message: string } | null }>;
    };
  };
};

const RESULT_LABELS: Array<[string, string, string]> = [
  ["wellnessScore", "Wellness Score", "/100"], ["heartRate", "Heart Rate", "bpm"],
  ["respiration", "Respiration", "breaths/min"], ["hrv", "HRV", "ms"], ["stress", "Stress", "/100"],
  ["spo2Low", "SpO2 Low", "%"], ["spo2High", "SpO2 High", "%"],
  ["bpSysLow", "Systolic BP Low", "mmHg"], ["bpSysHigh", "Systolic BP High", "mmHg"],
  ["bpDiaLow", "Diastolic BP Low", "mmHg"], ["bpDiaHigh", "Diastolic BP High", "mmHg"],
  ["bmi", "BMI", ""], ["absi", "ABSI", ""], ["idealWeight", "Ideal Weight", "kg"],
  ["vo2Max", "VO2 Max", "ml/kg/min"], ["cardiacWorkload", "Cardiac Workload", ""],
  ["hrr", "Heart Rate Reserve", "bpm"], ["sdnn", "SDNN", "ms"], ["rmssd", "RMSSD", "ms"],
  ["pnn50", "pNN50", "%"], ["cardiacOutput", "Cardiac Output", "L/min"], ["map", "Mean Arterial Pressure", "mmHg"],
  ["hrMax", "Maximum Heart Rate", "bpm"], ["targetHrLow", "Target HR Low", "bpm"],
  ["targetHrHigh", "Target HR High", "bpm"], ["heartUtilized", "Heart Utilized", "%"],
  ["bloodVolume", "Blood Volume", "L"], ["totalBodyWater", "Total Body Water", "L"],
  ["bodyWaterPct", "Body Water", "%"], ["bodyFatPct", "Body Fat", "%"],
  ["hypertensionRisk", "Hypertension Risk", ""], ["diabetesRisk", "HbA1c Risk", ""],
  ["dyslipidemiaRisk", "Cholesterol Risk", ""], ["obesityRisk", "Obesity Risk", ""],
  ["cardioRisk", "Cardiovascular Risk", ""], ["skinAge", "Estimated Skin Age", "years"],
  ["skinAgeConfidence", "Skin Age Confidence", ""], ["bmr", "BMR", "kcal/day"], ["tdee", "TDEE", "kcal/day"],
];

function asPayload(value: Json | null): ReportPayload {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value as ReportPayload;
}

function pdfBytes(row: QueueRow): { bytes: Uint8Array; filename: string } {
  const payload = asPayload(row.report_payload);
  const details = payload.details ?? {};
  const results = payload.results ?? {};
  const answers = payload.answers ?? {};
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 42;
  let y = 52;

  const pageHeader = () => {
    doc.setFillColor(20, 126, 126);
    doc.rect(0, 0, width, 12, "F");
    doc.setTextColor(20, 38, 52);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("AI Face Scan Wellness Report", margin, 52);
    y = 78;
  };
  const ensure = (needed: number) => {
    if (y + needed <= height - 48) return;
    doc.addPage();
    pageHeader();
  };
  const line = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    ensure(22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 103, 116);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 38, 52);
    doc.text(String(value), width - margin, y, { align: "right" });
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 7, width - margin, y + 7);
    y += 22;
  };
  const section = (title: string) => {
    ensure(34);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 126, 126);
    doc.text(title, margin, y);
    y += 20;
  };

  pageHeader();
  line("Name", details.name ?? row.name ?? "Participant");
  line("Doctor", details.doctorName);
  line("Employee", details.employeeName);
  line("Age / Sex", [details.age, details.sex].filter(Boolean).join(" / "));
  line("Height / Weight", details.heightCm && details.weightKg ? `${details.heightCm} cm / ${details.weightKg} kg` : undefined);
  section("Wellness Parameters");
  for (const [key, label, unit] of RESULT_LABELS) {
    const value = results[key];
    line(label, value === undefined || value === null ? undefined : `${String(value)}${unit ? ` ${unit}` : ""}`);
  }
  section("Lifestyle Responses");
  line("Exercise", answers.exercise);
  line("Family History", answers.familyHistory);
  line("Fried Food", answers.friedFood);
  line("Sleep", answers.sleep);
  ensure(85);
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 38, 52);
  doc.text("Disclaimer", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 103, 116);
  const disclaimer = "This report is an indicative wellness tool, not a medical diagnosis. Values are AI-derived estimates and should not replace consultation with a qualified healthcare professional.";
  doc.text(doc.splitTextToSize(disclaimer, width - margin * 2), margin, y);

  const safeName = (details.name ?? row.name ?? "user").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40);
  return {
    bytes: new Uint8Array(doc.output("arraybuffer")),
    filename: `VitalScan-Report-${safeName}.pdf`,
  };
}

async function finish(
  admin: AdminClient,
  row: QueueRow,
  ok: boolean,
  path?: string,
  error?: string,
  providerMessageId?: string,
) {
  const { error: rpcError } = await admin.rpc("complete_report_job", {
    p_id: row.id,
    p_ok: ok,
    p_pdf_path: path ?? null,
    p_error: error ?? null,
    p_provider_message_id: providerMessageId ?? null,
  });
  if (rpcError) console.error(`[whatsapp] could not finalize ${row.scan_id}: ${rpcError.message}`);
}

async function deliver(admin: AdminClient, row: QueueRow): Promise<boolean> {
  const apiKey = process.env.INTERAKT_API_KEY;
  if (!apiKey) {
    await finish(admin, row, false, undefined, "INTERAKT_API_KEY is not configured");
    return false;
  }

  let generated: ReturnType<typeof pdfBytes>;
  try {
    generated = pdfBytes(row);
  } catch (error) {
    await finish(admin, row, false, undefined, `pdf_failed: ${String(error)}`);
    return false;
  }

  const safeName = (row.name ?? "user").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40);
  const path = `${new Date().toISOString().slice(0, 10)}/${safeName}-${row.scan_id}.pdf`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, generated.bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadError) {
    await finish(admin, row, false, undefined, `upload_failed: ${uploadError.message}`);
    return false;
  }

  const { data: signed, error: signedError } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (signedError || !signed?.signedUrl) {
    await finish(admin, row, false, path, `sign_failed: ${signedError?.message ?? "unknown"}`);
    return false;
  }

  const countryCode = (row.country_code ?? "+91").startsWith("+")
    ? row.country_code ?? "+91"
    : `+${(row.country_code ?? "91").replace(/\D/g, "")}`;
  const firstName = (row.name ?? "there").trim().split(/\s+/)[0] || "there";
  try {
    const response = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${apiKey}` },
      body: JSON.stringify({
        countryCode,
        phoneNumber: (row.mobile ?? "").replace(/\D/g, ""),
        callbackData: `face_scan_report:${row.scan_id}`,
        type: "Template",
        template: {
          name: "face_scan",
          languageCode: "en",
          headerValues: [signed.signedUrl],
          fileName: generated.filename,
          bodyValues: [firstName],
        },
      }),
    });
    const responseText = await response.text();
    if (!response.ok) {
      await finish(admin, row, false, path, `interakt_${response.status}: ${responseText.slice(0, 500)}`);
      return false;
    }
    let providerMessageId: string | undefined;
    try {
      const parsed = JSON.parse(responseText) as { id?: string; result?: { id?: string } };
      providerMessageId = parsed.id ?? parsed.result?.id;
    } catch {
      providerMessageId = undefined;
    }
    await finish(admin, row, true, path, undefined, providerMessageId);
    return true;
  } catch (error) {
    await finish(admin, row, false, path, `network: ${String(error)}`);
    return false;
  }
}

export async function processReportQueue(limit = 5): Promise<{ claimed: number; sent: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as AdminClient;
  const { data, error } = await admin.rpc("claim_report_jobs", { p_limit: limit });
  if (error) throw new Error(`Queue claim failed: ${error.message}`);
  const rows = Array.isArray(data) ? data as QueueRow[] : [];
  const outcomes = await Promise.all(rows.map((row) => deliver(admin, row)));
  return { claimed: rows.length, sent: outcomes.filter(Boolean).length };
}