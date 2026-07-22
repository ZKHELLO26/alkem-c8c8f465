// Premium gradient PDF generator for the wellness report.
// Visual language mirrors the in-app UI: teal → mint → azure gradient,
// glassy white cards, status-glow value chips, vector icons per parameter.
//
// Uses jsPDF + Poppins (fetched from jsdelivr CDN at runtime).
import type { ScanResults, UserDetails } from "./scan-store";

export type PdfParam = {
  group: string;
  name: string;
  value: string;
  range: string;
  explain: string;
  status: "Low" | "Moderate" | "High" | "Normal" | "Info";
};

// Brand palette — Vibrant Wellness
const BRAND = {
  teal:     [38, 188, 170] as [number, number, number],
  mint:     [86, 220, 156] as [number, number, number],
  azure:    [70, 130, 230] as [number, number, number],
  violet:   [138, 100, 230] as [number, number, number],
  coral:    [240, 122, 96] as [number, number, number],
  sunshine: [245, 200, 90] as [number, number, number],
  blush:    [240, 200, 215] as [number, number, number],
  indigo:   [99, 102, 241] as [number, number, number],
  gold:     [201, 162, 74] as [number, number, number],
  ink:      [22, 30, 46] as [number, number, number],
  inkSoft:  [80, 95, 115] as [number, number, number],
  inkMute:  [130, 145, 165] as [number, number, number],
  panel:    [252, 253, 255] as [number, number, number],
  panelEdge:[225, 232, 242] as [number, number, number],
};

// One accent per group — mirrors GROUP_ACCENT in results.tsx
const GROUP_GRAD: Record<string, [[number, number, number], [number, number, number]]> = {
  "Core Vitals":     [BRAND.teal,     BRAND.azure],
  "Body Metrics":    [BRAND.mint,     BRAND.teal],
  "Skin & Wellness": [BRAND.violet,   BRAND.azure],
  "Cardiovascular":  [BRAND.azure,    BRAND.violet],
  "Risk Indicators": [BRAND.coral,    BRAND.sunshine],
};

// Status gradient stops (2-stop each for richer fill)
const STATUS_GRAD: Record<string, [[number, number, number], [number, number, number]]> = {
  Normal:   [[35, 175, 110], [79, 232, 157]],
  Low:      [[35, 175, 110], [79, 232, 157]],
  Moderate: [[230, 145, 30], [245, 200, 95]],
  High:     [[220, 60, 60],  [240, 110, 130]],
  Info:     [[77, 143, 224], [120, 180, 240]],
};
const STATUS_SOLID: Record<string, [number, number, number]> = {
  Normal: [43, 175, 110], Low: [43, 175, 110],
  Moderate: [216, 154, 46], High: [220, 70, 60], Info: [77, 143, 224],
};



const DISCLAIMER_SHORT =
  "Indicative wellness tool — not a medical diagnosis.";
const DISCLAIMER_FULL =
  "This report is an indicative wellness tool, not a medical diagnosis. It is designed for awareness and educational purposes only. The values shown are AI-derived estimates from a contactless face scan and self-reported inputs. They should not be used to make clinical decisions, start, stop, or modify any medication, or replace consultation with a qualified healthcare professional. Always consult your doctor before acting on any health information.";

// ─────────────── color helpers ───────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
}
function tint(c: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.round(c[0] + (255 - c[0]) * amount),
    Math.round(c[1] + (255 - c[1]) * amount),
    Math.round(c[2] + (255 - c[2]) * amount),
  ];
}

// (icons removed per design — clean typographic layout)


// ─────────────── Poppins font loader ───────────────
async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

let cachedFonts: { regular: string; semibold: string; bold: string } | null = null;
async function loadPoppins() {
  if (cachedFonts) return cachedFonts;
  const base = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins";
  const [regular, semibold, bold] = await Promise.all([
    fetchAsBase64(`${base}/Poppins-Regular.ttf`),
    fetchAsBase64(`${base}/Poppins-SemiBold.ttf`),
    fetchAsBase64(`${base}/Poppins-Bold.ttf`),
  ]);
  cachedFonts = { regular, semibold, bold };
  return cachedFonts;
}

function registerPoppins(doc: any, fonts: { regular: string; semibold: string; bold: string }) {
  doc.addFileToVFS("Poppins-Regular.ttf", fonts.regular);
  doc.addFont("Poppins-Regular.ttf", "Poppins", "normal");
  doc.addFileToVFS("Poppins-SemiBold.ttf", fonts.semibold);
  doc.addFont("Poppins-SemiBold.ttf", "Poppins", "600");
  doc.addFileToVFS("Poppins-Bold.ttf", fonts.bold);
  doc.addFont("Poppins-Bold.ttf", "Poppins", "bold");
}




export async function generateReportPdf(
  d: UserDetails,
  r: ScanResults,
  params: PdfParam[],
  wellnessLabel: string,
) {
  const { default: jsPDF } = await import("jspdf");
  const fonts = await loadPoppins().catch(() => null);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  if (fonts) {
    registerPoppins(doc, fonts);
    doc.setFont("Poppins", "normal");
  }
  const FONT = fonts ? "Poppins" : "helvetica";
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 38;
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // helpers
  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setF = (weight: "normal" | "600" | "bold", size: number) => {
    doc.setFont(FONT, weight);
    doc.setFontSize(size);
  };

  const horizontalGradient = (
    x: number, y: number, w: number, h: number,
    stops: [number, number, number][],
  ) => {
    const steps = 140;
    const stepW = w / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const segT = t * (stops.length - 1);
      const idx = Math.min(stops.length - 2, Math.floor(segT));
      const localT = segT - idx;
      const col = lerpRgb(stops[idx], stops[idx + 1], localT);
      setFill(col);
      doc.rect(x + i * stepW, y, stepW + 0.5, h, "F");
    }
  };

  // Rounded clipped gradient — prevents square corners peeking behind rounded chips/pills.
  const roundedGradient = (
    x: number, y: number, w: number, h: number, r: number,
    stops: [number, number, number][],
  ) => {
    (doc as any).saveGraphicsState();
    (doc as any).roundedRect(x, y, w, h, r, r, null);
    (doc as any).clip();
    (doc as any).discardPath();
    horizontalGradient(x, y, w, h, stops);
    (doc as any).restoreGraphicsState();
  };

  const glowRect = (
    x: number, y: number, w: number, h: number, radius: number,
    color: [number, number, number],
  ) => {
    for (let i = 5; i >= 1; i--) {
      const t = 0.93 - i * 0.07;
      setFill(tint(color, t));
      doc.roundedRect(x - i, y - i, w + i * 2, h + i * 2, radius + i, radius + i, "F");
    }
  };

  const addFooter = () => {
    horizontalGradient(M, H - 38, W - M * 2, 1.2, [BRAND.teal, BRAND.mint, BRAND.azure]);
    setF("normal", 9);
    setText(BRAND.inkSoft);
    doc.text(DISCLAIMER_SHORT, W / 2, H - 24, { align: "center" });
  };

  const addPageNumbers = () => {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      setF("normal", 8.5);
      setText(BRAND.inkMute);
      doc.text("VitalScan AI — Wellness Report", M, H - 10);
      doc.text(`Page ${i} of ${total}`, W - M, H - 10, { align: "right" });
    }
  };

  const drawPageBg = () => {
    setFill(tint(BRAND.teal, 0.96));
    doc.rect(0, 0, W, H, "F");
  };

  // ════════════════════════════════════════════════════════
  //  PAGE 1 — Cover with compact wellness chip + details
  // ════════════════════════════════════════════════════════
  drawPageBg();

  // Top banner — azure→indigo for dark-text contrast
  const bannerH = 110;
  horizontalGradient(0, 0, W, bannerH, [BRAND.azure, BRAND.indigo]);
  // subtle teal accent strip
  horizontalGradient(0, bannerH, W, 3, [BRAND.teal, BRAND.mint]);

  // Logo bubble
  doc.setFillColor(255, 255, 255);
  doc.circle(M + 24, 50, 22, "F");
  setF("bold", 13);
  setText(BRAND.azure);
  doc.text("VS", M + 24, 54, { align: "center" });

  // Title block (left)
  setF("bold", 26);
  setText([255, 255, 255]);
  doc.text("Wellness Report", M + 60, 48);
  setF("normal", 10.5);
  setText([235, 240, 250]);
  doc.text("AI-derived insight, designed for awareness.", M + 60, 66);
  setF("normal", 9.5);
  doc.text(`AI Face Vital Scan • Generated ${today}`, M + 60, 82);


  // Compact wellness chip (top-right) — width sized to fit longest label
  const chipW = 200, chipH = 70;
  const chipX = W - M - chipW;
  const chipY = 22;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(chipX, chipY, chipW, chipH, 12, 12, "F");
  // mini score ring
  const ringR = 22;
  const ringCx = chipX + 28;
  const ringCy = chipY + chipH / 2;
  doc.setDrawColor(230, 235, 240);
  doc.setLineWidth(5);
  doc.circle(ringCx, ringCy, ringR, "S");
  const sweep = (r.wellnessScore / 100) * Math.PI * 2;
  const segs = Math.max(8, Math.round(sweep * 18));
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const a0 = -Math.PI / 2 + t0 * sweep;
    const a1 = -Math.PI / 2 + t1 * sweep;
    const col = lerpRgb(BRAND.teal, BRAND.azure, t0);
    setDraw(col);
    doc.setLineWidth(5);
    doc.line(
      ringCx + Math.cos(a0) * ringR, ringCy + Math.sin(a0) * ringR,
      ringCx + Math.cos(a1) * ringR, ringCy + Math.sin(a1) * ringR,
    );
  }
  setF("bold", 18);
  setText(BRAND.ink);
  doc.text(`${r.wellnessScore}`, ringCx, ringCy + 5, { align: "center" });
  // label area
  const labelX = chipX + 60;
  const labelMaxW = chipW - 60 - 12;
  setF("normal", 8.5);
  setText(BRAND.inkMute);
  doc.text("WELLNESS SCORE", labelX, chipY + 22);
  // Auto-shrink label font so long values like "Needs Attention" fit
  let labelSize = 14;
  setF("bold", labelSize);
  while (doc.getTextWidth(wellnessLabel) > labelMaxW && labelSize > 9) {
    labelSize -= 0.5;
    setF("bold", labelSize);
  }
  setText(BRAND.ink);
  doc.text(wellnessLabel, labelX, chipY + 40);
  setF("normal", 8);
  setText(BRAND.inkSoft);
  doc.text("of 100", labelX, chipY + 54);

  // ─── Your Details panel ───
  let y = bannerH + 22;
  const detailRows: [string, string][] = [];
  if (d.name) detailRows.push(["Name", d.name]);
  if (d.email) detailRows.push(["Email", d.email]);
  if (d.mobile) detailRows.push(["Mobile", `${d.countryCode} ${d.mobile}`]);
  if (d.age) detailRows.push(["Age", `${d.age} yrs`]);
  if (d.sex) detailRows.push(["Gender", d.sex === "M" ? "Male" : "Female"]);
  if (d.heightCm) detailRows.push(["Height", `${d.heightCm} cm`]);
  if (d.weightKg) detailRows.push(["Weight", `${d.weightKg} kg`]);
  if (d.waistIn) detailRows.push(["Waist", `${d.waistIn} in`]);

  const detailPanelH = 32 + Math.ceil(detailRows.length / 2) * 22 + 14;
  setFill(BRAND.panel);
  setDraw(BRAND.panelEdge);
  doc.setLineWidth(0.5);
  doc.roundedRect(M, y, W - M * 2, detailPanelH, 12, 12, "FD");
  roundedGradient(M, y, W - M * 2, 3, 12, [BRAND.teal, BRAND.mint, BRAND.azure]);

  setF("bold", 13);
  setText(BRAND.ink);
  doc.text("Your Details", M + 16, y + 22);

  setF("normal", 10.5);
  const colW = (W - M * 2 - 32) / 2;
  detailRows.forEach((row, i) => {
    const col = i % 2;
    const rowIdx = Math.floor(i / 2);
    const x = M + 16 + col * colW;
    const ry = y + 44 + rowIdx * 22;
    setF("normal", 10);
    setText(BRAND.inkMute);
    doc.text(row[0], x, ry);
    setF("600", 11);
    setText(BRAND.ink);
    doc.text(row[1], x + 70, ry);
  });

  y += detailPanelH + 18;

  // ─── Mood Snapshot panel (cover page) ───
  if (r.expression) {
    const e = r.expression;
    const moodPanelH = 156;
    if (y + moodPanelH > H - 55) {
      doc.addPage();
      drawPageBg();
      y = M;
      addFooter();
    }

    // soft violet glow + panel
    const violetGrad: [number, number, number][] = [BRAND.violet, BRAND.azure];
    setFill(tint(BRAND.violet, 0.92));
    setDraw(tint(BRAND.violet, 0.55));
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, W - M * 2, moodPanelH, 14, 14, "FD");
    roundedGradient(M, y, W - M * 2, 3, 14, violetGrad);

    setF("bold", 13);
    setText(BRAND.ink);
    doc.text("Mood Snapshot", M + 16, y + 22);
    setF("normal", 10);
    setText(BRAND.inkSoft);
    doc.text(e.moodLabel, M + 16, y + 38);

    // copy
    setF("normal", 10);
    setText(BRAND.inkSoft);
    const copyLines = doc.splitTextToSize(e.moodCopy, W - M * 2 - 32);
    doc.text(copyLines.slice(0, 2), M + 16, y + 54, { lineHeightFactor: 1.4 });

    // 4 vibrant tiles
    const tileY = y + 78;
    const tileH = 44;
    const tileGap = 10;
    const tileW = (W - M * 2 - 32 - tileGap * 3) / 4;
    const tiles: {
      label: string;
      hint: string;
      v: number;
      grad: [[number, number, number], [number, number, number]];
    }[] = [
      { label: "SMILE",     hint: "Mouth curvature", v: e.smileScore, grad: [BRAND.sunshine, BRAND.coral] },
      { label: "ALERTNESS", hint: "Eye openness & focus", v: e.alertness, grad: [BRAND.azure, BRAND.violet] },
      { label: "CALMNESS",  hint: "Relaxed brow & jaw",  v: e.calmness,  grad: [BRAND.mint, BRAND.teal] },
      { label: "STABILITY", hint: "Steady expression",   v: e.stability, grad: [BRAND.violet, BRAND.azure] },
    ];
    tiles.forEach((t, i) => {
      const tx = M + 16 + i * (tileW + tileGap);
      roundedGradient(tx, tileY, tileW, tileH, 10, t.grad);
      setDraw(t.grad[1]);
      doc.setLineWidth(0.5);
      doc.roundedRect(tx, tileY, tileW, tileH, 10, 10, "S");
      setF("bold", 18);
      setText([255, 255, 255]);
      doc.text(`${t.v}`, tx + tileW / 2, tileY + 22, { align: "center" });
      setF("bold", 7.5);
      doc.text(t.label, tx + tileW / 2, tileY + 36, { align: "center" });
      // hint under the tile
      setF("normal", 7.5);
      setText(BRAND.inkMute);
      doc.text(t.hint, tx + tileW / 2, tileY + tileH + 10, { align: "center" });
    });

    y += moodPanelH + 16;
  }

  addFooter();

  // ════════════════════════════════════════════════════════
  //  Parameter cards — flow continuously, no forced page breaks
  // ════════════════════════════════════════════════════════
  const paramH = 130;

  const ensureSpace = (need: number) => {
    if (y + need > H - 55) {
      doc.addPage();
      drawPageBg();
      y = M;
      addFooter();
    }
  };

  // Centered card geometry — narrower than page width, horizontally centered.
  const cardW = W - M * 2 - 40;
  const cardX = (W - cardW) / 2;

  const drawGroupHeading = (label: string) => {
    ensureSpace(56);
    setF("bold", 19);
    setText(BRAND.ink);
    doc.text(label, W / 2, y + 18, { align: "center" });
    const ulW = 90;
    const gAccent = GROUP_GRAD[label] ?? [BRAND.teal, BRAND.azure];
    horizontalGradient(W / 2 - ulW / 2, y + 26, ulW, 3.5, gAccent);
    y += 46;
  };


  // Build groups in display order
  const groupOrder: string[] = [];
  params.forEach((p) => {
    if (!groupOrder.includes(p.group)) groupOrder.push(p.group);
  });

  for (const g of groupOrder) {
    drawGroupHeading(g);
    const list = params.filter((p) => p.group === g);
    for (const p of list) {
      ensureSpace(paramH + 12);
      const solid = STATUS_SOLID[p.status] ?? STATUS_SOLID.Info;
      const grad = STATUS_GRAD[p.status] ?? STATUS_GRAD.Info;

      // glow
      glowRect(cardX, y, cardW, paramH, 12, solid);
      // card body
      doc.setFillColor(255, 255, 255);
      setDraw(BRAND.panelEdge);
      doc.setLineWidth(0.5);
      doc.roundedRect(cardX, y, cardW, paramH, 12, 12, "FD");

      // left status bar
      setFill(grad[0]);
      doc.roundedRect(cardX, y, 5, paramH, 2, 2, "F");

      // Name (no icon) — auto-shrink + wrap to 2 lines so long titles like
      // "Total Daily Energy Expenditure" never overflow into the value chip.
      const leftX = cardX + 20;
      const leftW = cardW * 0.6 - 20;
      let nameSize = 15;
      setF("600", nameSize);
      let nameLines = doc.splitTextToSize(p.name, leftW - 8);
      while (nameLines.length > 2 && nameSize > 11) {
        nameSize -= 0.5;
        setF("600", nameSize);
        nameLines = doc.splitTextToSize(p.name, leftW - 8);
      }
      setText(BRAND.ink);
      const nameLH = nameSize * 1.15;
      nameLines.slice(0, 2).forEach((ln: string, i: number) => {
        doc.text(ln, leftX, y + 22 + i * nameLH);
      });
      const afterNameY = y + 22 + Math.min(nameLines.length, 2) * nameLH - 4;
      // Hairline beneath name for editorial polish
      setDraw(BRAND.panelEdge);
      doc.setLineWidth(0.5);
      doc.line(leftX, afterNameY + 4, leftX + leftW - 8, afterNameY + 4);

      // Explanation
      setF("normal", 11);
      setText(BRAND.inkSoft);
      const explainLines = doc.splitTextToSize(p.explain, leftW);
      doc.text(explainLines.slice(0, 4), leftX, afterNameY + 22, { lineHeightFactor: 1.4 });

      // Right: gradient value chip
      const rightX = cardX + cardW * 0.6 + 8;
      const rightW = cardW * 0.4 - 16;
      const chipY2 = y + 10;
      const chipH2 = paramH - 20;

      const lightA = tint(grad[0], 0.88);
      const lightB = tint(grad[1], 0.88);
      roundedGradient(rightX, chipY2, rightW, chipH2, 10, [lightA, lightB]);
      setDraw(tint(solid, 0.55));
      doc.setLineWidth(1);
      doc.roundedRect(rightX, chipY2, rightW, chipH2, 10, 10, "S");

      // Auto-shrink value so units like "br/min" never overflow the chip
      let vSize = 24;
      setF("bold", vSize);
      const valMaxW = rightW - 16;
      while (doc.getTextWidth(p.value) > valMaxW && vSize > 12) {
        vSize -= 1;
        setF("bold", vSize);
      }
      setText(solid);
      doc.text(p.value, rightX + rightW / 2, chipY2 + 38, { align: "center" });

      setF("normal", 9.5);
      setText(BRAND.inkSoft);
      const rangeLines = doc.splitTextToSize(p.range, rightW - 16);
      doc.text(rangeLines, rightX + rightW / 2, chipY2 + 58, {
        align: "center",
        lineHeightFactor: 1.3,
      });

      // status pill
      const pillW = 92, pillH = 22;
      const pillX = rightX + rightW / 2 - pillW / 2;
      const pillY = chipY2 + chipH2 - pillH - 10;
      roundedGradient(pillX, pillY, pillW, pillH, 11, grad);
      setDraw(grad[1]);
      doc.setLineWidth(0.5);
      doc.roundedRect(pillX, pillY, pillW, pillH, 11, 11, "S");
      setF("bold", 10);
      setText([255, 255, 255]);
      doc.text(
        p.status.toUpperCase(),
        pillX + pillW / 2,
        pillY + pillH / 2 + 3.5,
        { align: "center" },
      );

      y += paramH + 12;
    }
  }

  // ────────── Final prominent disclaimer block (dynamic height) ──────────
  setF("normal", 11.5);
  const discInnerW = cardW - 52 - 18;
  const dLines = doc.splitTextToSize(DISCLAIMER_FULL, discInnerW);
  const lineH = 11.5 * 1.45;
  const boxH = 36 + dLines.length * lineH + 22;
  ensureSpace(boxH + 24);
  y += 8;
  glowRect(cardX, y, cardW, boxH, 12, BRAND.gold);
  setFill(tint(BRAND.azure, 0.94));
  setDraw(tint(BRAND.azure, 0.55));
  doc.setLineWidth(1);
  doc.roundedRect(cardX, y, cardW, boxH, 12, 12, "FD");
  roundedGradient(cardX, y, cardW, 4, 12, [BRAND.gold, tint(BRAND.gold, 0.4)]);
  setF("bold", 16);
  setText(BRAND.gold);
  doc.text("DISCLAIMER", cardX + 22, y + 30);
  setF("normal", 11.5);
  setText(BRAND.ink);
  doc.text(dLines, cardX + 22, y + 50, { lineHeightFactor: 1.45 });
  y += boxH + 12;


  addPageNumbers();

  const filename = `VitalScan-Report-${(d.name || "user").replace(/\s+/g, "_")}-${today.replace(/[ ,]+/g, "-")}.pdf`;
  doc.save(filename);
}
