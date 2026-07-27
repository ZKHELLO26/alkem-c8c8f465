// Sends the "face_scan" WhatsApp template via Interakt after a scan.
// Called from the results page once the PDF report has been uploaded to
// Supabase Storage and we have a fetchable URL for it.
import { createServerFn } from "@tanstack/react-start";

type SendInput = {
  name: string;
  countryCode: string; // "+91" or "91"
  mobile: string;      // digits only
  pdfUrl: string;
  fileName?: string;
};

export const sendWhatsappReport = createServerFn({ method: "POST" })
  .inputValidator((input: SendInput) => {
    if (!input || typeof input !== "object") throw new Error("Invalid payload");
    const { name, countryCode, mobile, pdfUrl } = input;
    if (!name || !countryCode || !mobile || !pdfUrl) throw new Error("Missing fields");
    if (!/^https?:\/\//i.test(pdfUrl)) throw new Error("pdfUrl must be http(s)");
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.INTERAKT_API_KEY;
    if (!apiKey) throw new Error("INTERAKT_API_KEY is not configured");

    const cc = data.countryCode.startsWith("+")
      ? data.countryCode
      : `+${data.countryCode.replace(/\D/g, "")}`;
    const phone = data.mobile.replace(/\D/g, "");
    const firstName = (data.name || "there").trim().split(/\s+/)[0];

    const body = {
      countryCode: cc,
      phoneNumber: phone,
      callbackData: "face_scan_report",
      type: "Template",
      template: {
        name: "face_scan",
        languageCode: "en",
        headerValues: [data.pdfUrl],
        fileName: data.fileName || "Wellness-Report.pdf",
        bodyValues: [firstName],
      },
    };

    const res = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`[interakt] ${res.status}: ${text}`);
      return { ok: false as const, status: res.status, error: text };
    }
    return { ok: true as const, status: res.status, response: text };
  });
