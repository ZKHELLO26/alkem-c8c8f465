// Methodology PDF — same visual language as the report.
// Lists pipeline + per-parameter formulae + references.

const BRAND = {
  teal: [0, 212, 180] as [number, number, number],
  mint: [79, 232, 157] as [number, number, number],
  azure: [77, 143, 224] as [number, number, number],
  indigo: [99, 102, 241] as [number, number, number],
  ink: [22, 30, 46] as [number, number, number],
  inkSoft: [80, 95, 115] as [number, number, number],
  inkMute: [130, 145, 165] as [number, number, number],
  panel: [248, 251, 253] as [number, number, number],
  panelEdge: [220, 230, 240] as [number, number, number],
};

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpRgb(
  a: [number, number, number], b: [number, number, number], t: number,
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

export type PipelineStep = { step: string; detail: string };
export type MethodEntry = {
  name: string;
  inputs: string;
  formula: string;
  reference: string;
};
export type MethodSection = { title: string; entries: MethodEntry[] };

export async function generateMethodologyPdf(
  pipeline: PipelineStep[],
  sections: MethodSection[],
) {
  const { default: jsPDF } = await import("jspdf");
  const fonts = await loadPoppins().catch(() => null);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  if (fonts) {
    doc.addFileToVFS("Poppins-Regular.ttf", fonts.regular);
    doc.addFont("Poppins-Regular.ttf", "Poppins", "normal");
    doc.addFileToVFS("Poppins-SemiBold.ttf", fonts.semibold);
    doc.addFont("Poppins-SemiBold.ttf", "Poppins", "600");
    doc.addFileToVFS("Poppins-Bold.ttf", fonts.bold);
    doc.addFont("Poppins-Bold.ttf", "Poppins", "bold");
  }
  const FONT = fonts ? "Poppins" : "helvetica";
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 38;

  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setF = (w: "normal" | "600" | "bold", s: number) => {
    doc.setFont(FONT, w);
    doc.setFontSize(s);
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

  const drawPageBg = () => {
    setFill(tint(BRAND.teal, 0.96));
    doc.rect(0, 0, W, H, "F");
  };

  const addFooter = () => {
    horizontalGradient(M, H - 38, W - M * 2, 1.2, [BRAND.teal, BRAND.mint, BRAND.azure]);
    setF("normal", 9);
    setText(BRAND.inkSoft);
    doc.text("Indicative wellness tool — not a medical diagnosis.", W / 2, H - 24, { align: "center" });
  };

  let y = 0;

  // ── Cover ──
  drawPageBg();
  horizontalGradient(0, 0, W, 90, [BRAND.azure, BRAND.indigo]);
  horizontalGradient(0, 90, W, 3, [BRAND.teal, BRAND.mint]);
  setF("bold", 24);
  setText([255, 255, 255]);
  doc.text("Methodology & Formulas", M, 50);
  setF("normal", 11);
  doc.text("VitalScan AI — full reference for clinicians & partners", M, 72);

  y = 120;
  setF("bold", 16);
  setText(BRAND.ink);
  doc.text("Signal Pipeline", M, y);
  horizontalGradient(M, y + 6, 60, 3, [BRAND.teal, BRAND.mint, BRAND.azure]);
  y += 22;

  setFill(BRAND.panel);
  setDraw(BRAND.panelEdge);
  doc.setLineWidth(0.5);
  const pipeStartY = y;
  let yy = y + 14;
  for (const p of pipeline) {
    setF("bold", 10.5);
    setText(BRAND.azure);
    doc.text(p.step, M + 14, yy);
    setF("normal", 10.5);
    setText(BRAND.ink);
    const lines = doc.splitTextToSize(p.detail, W - M * 2 - 110);
    doc.text(lines, M + 90, yy, { lineHeightFactor: 1.4 });
    yy += Math.max(16, lines.length * 13) + 4;
  }
  // backfill panel rect over content
  setFill(BRAND.panel);
  setDraw(BRAND.panelEdge);
  doc.roundedRect(M, pipeStartY, W - M * 2, yy - pipeStartY + 6, 12, 12, "FD");
  horizontalGradient(M, pipeStartY, W - M * 2, 3, [BRAND.teal, BRAND.mint, BRAND.azure]);
  // re-draw text on top of the panel
  yy = pipeStartY + 14;
  for (const p of pipeline) {
    setF("bold", 10.5);
    setText(BRAND.azure);
    doc.text(p.step, M + 14, yy);
    setF("normal", 10.5);
    setText(BRAND.ink);
    const lines = doc.splitTextToSize(p.detail, W - M * 2 - 110);
    doc.text(lines, M + 90, yy, { lineHeightFactor: 1.4 });
    yy += Math.max(16, lines.length * 13) + 4;
  }
  y = yy + 18;
  addFooter();

  const ensureSpace = (need: number) => {
    if (y + need > H - 55) {
      doc.addPage();
      drawPageBg();
      y = M;
      addFooter();
    }
  };

  for (const sec of sections) {
    ensureSpace(40);
    setF("bold", 16);
    setText(BRAND.ink);
    doc.text(sec.title, M, y + 14);
    horizontalGradient(M, y + 20, 60, 3, [BRAND.teal, BRAND.mint, BRAND.azure]);
    y += 36;

    for (const e of sec.entries) {
      // measure card height
      const lblW = W - M * 2 - 28;
      const formulaLines = doc.splitTextToSize(e.formula, lblW);
      const inputsLines = doc.splitTextToSize(`Inputs: ${e.inputs}`, lblW);
      const refLines = doc.splitTextToSize(`Reference: ${e.reference}`, lblW);
      const cardH =
        18 + // padding top
        18 + // name
        10 + // gap
        inputsLines.length * 13 + 8 +
        14 + // formula label
        formulaLines.length * 13 + 8 +
        refLines.length * 13 +
        14;
      ensureSpace(cardH + 10);

      doc.setFillColor(255, 255, 255);
      setDraw(BRAND.panelEdge);
      doc.setLineWidth(0.5);
      doc.roundedRect(M, y, W - M * 2, cardH, 10, 10, "FD");
      setFill(BRAND.teal);
      doc.roundedRect(M, y, 4, cardH, 2, 2, "F");

      let cy = y + 22;
      setF("bold", 13);
      setText(BRAND.ink);
      doc.text(e.name, M + 14, cy);
      cy += 20;

      setF("normal", 10);
      setText(BRAND.inkSoft);
      doc.text(inputsLines, M + 14, cy, { lineHeightFactor: 1.4 });
      cy += inputsLines.length * 13 + 8;

      setF("600", 10);
      setText(BRAND.azure);
      doc.text("Formula:", M + 14, cy);
      cy += 12;

      // formula box
      setFill(tint(BRAND.azure, 0.95));
      doc.roundedRect(M + 14, cy - 8, W - M * 2 - 28, formulaLines.length * 13 + 6, 6, 6, "F");
      setF("normal", 10);
      setText(BRAND.ink);
      doc.text(formulaLines, M + 20, cy + 4, { lineHeightFactor: 1.4 });
      cy += formulaLines.length * 13 + 8;

      setF("normal", 9.5);
      setText(BRAND.inkMute);
      doc.text(refLines, M + 14, cy, { lineHeightFactor: 1.4 });

      y += cardH + 10;
    }
    y += 8;
  }

  // page numbers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    setF("normal", 8.5);
    setText(BRAND.inkMute);
    doc.text("VitalScan AI — Methodology", M, H - 10);
    doc.text(`Page ${i} of ${total}`, W - M, H - 10, { align: "right" });
  }

  doc.save("VitalScan-Methodology.pdf");
}
