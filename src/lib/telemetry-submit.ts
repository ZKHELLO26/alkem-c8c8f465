// Client-side helper that collects everything in the scan store and records
// it through a narrowly scoped RPC in the connected external Supabase.
// Fire-and-forget; never blocks the UI.
import { supabase } from "@/integrations/supabase/client";
import { consentTextHash } from "./consent-text";

import {
  loadAnswers,
  loadDetails,
  loadResults,
  loadRppg,
  loadFaceMetrics,
  loadConsent,
  loadOrCreateUserId,
  loadScanId,
  loadSignalsBlob,
  loadExpression,
  clearTelemetryArtifacts,
} from "./scan-store";

export const APP_VERSION = "2026.06";

async function blobToB64(blob: Blob | null): Promise<string | undefined> {
  if (!blob) return undefined;
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function gzipJson(obj: unknown): Promise<Blob | null> {
  try {
    const json = JSON.stringify(obj);
    if (typeof CompressionStream === "undefined") {
      return new Blob([json], { type: "application/json" });
    }
    const stream = new Blob([json])
      .stream()
      .pipeThrough(new CompressionStream("gzip"));
    return await new Response(stream).blob();
  } catch {
    return null;
  }
}

let submittedFor: string | null = null;

export async function submitScanTelemetry(): Promise<void> {
  const consent = loadConsent();
  if (!consent?.consented) return;

  const details = loadDetails();
  const answers = loadAnswers();
  const results = loadResults();
  if (!details || !answers || !results) return;

  const scanId = loadScanId();
  if (!scanId) return;
  if (submittedFor === scanId) return;
  submittedFor = scanId;

  const userId = loadOrCreateUserId();
  const rppg = loadRppg();
  const faceMetrics = loadFaceMetrics();
  const signalsRaw = loadSignalsBlob();
  const expression = loadExpression();

  const signalsBlob = signalsRaw ? await gzipJson(signalsRaw) : null;
  const signalsGzB64 = await blobToB64(signalsBlob);

  try {
    const payload = {
        scanId,
        userId,
        consent: {
          consented: true,
          communications: !!consent.communications,
          consentVersion: consent.version,
          consentedAt: consent.at,
          consentTextHash: await consentTextHash(),
        },

        appVersion: APP_VERSION,
        user: {
          name: details.name,
          email: details.email || undefined,
          countryCode: details.countryCode,
          mobile: details.mobile,
        },
        profile: {
          age: details.age,
          sex: details.sex || undefined,
          heightCm: details.heightCm,
          weightKg: details.weightKg,
          waistIn: details.waistIn,
        },
        fieldForce: details.employeeCode
          ? {
              employeeCode: details.employeeCode,
              employeeName: details.employeeName,
              employeeHq: details.employeeHq,
              employeeRegion: details.employeeRegion,
              doctorCode: details.doctorCode,
              doctorName: details.doctorName,
              doctorSpeciality: details.doctorSpeciality,
              doctorCity: details.doctorCity,
              orgCode: details.orgCode,
            }
          : undefined,
        lifestyle: answers as unknown as Record<string, unknown>,
        results: results as unknown as Record<string, unknown>,
        // Future-proof: capture the full input payload as-is so any new
        // input field added to the app (e.g. location) is automatically
        // stored without a DB migration.
        rawInputs: {
          details: details as unknown as Record<string, unknown>,
          answers: answers as unknown as Record<string, unknown>,
          faceMetrics: (faceMetrics ?? null) as unknown as Record<string, unknown> | null,
        },
        expression: expression
          ? (expression as unknown as Record<string, unknown>)
          : undefined,
        quality: {
          durationS: rppg?.durationSec,
          fps: rppg ? Math.round((rppg.samples / Math.max(1, rppg.durationSec)) * 10) / 10 : undefined,
          confidence: rppg?.confidence,
          sourceMode: results.sourceMode,
          // motion/lighting reuse face metrics smoothness as a coarse proxy
          motionScore: undefined,
          lightingScore: faceMetrics?.skinSmoothness,
        },
        signalsGzB64,
      };

    const { error } = await supabase.rpc("record_public_scan", {
      p_payload: payload,
    });
    if (error) throw error;
    // Clean up the blob refs to free memory
    clearTelemetryArtifacts();
  } catch (e) {
    console.warn("[telemetry] submit failed (non-blocking):", e);
    submittedFor = null; // allow retry on next mount
  }
}
