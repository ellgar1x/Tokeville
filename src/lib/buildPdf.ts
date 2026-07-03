/**
 * Client-side PDF generation for the chat "document" artifact, styled to match
 * the .docx output (gold headings/rules, real tables, bullets, quotes, inline
 * bold/italic). Uses pdf-lib; loaded via dynamic import so it's code-split.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type DocItem =
  | { h1: string } | { h2: string } | { h3: string }
  | { p: string } | { ul: unknown[] } | { ol: unknown[] }
  | { quote: string } | { table: { headers?: unknown[]; rows?: unknown[][] } };
export interface DocSpec { title?: string; subtitle?: string; body?: DocItem[] }

interface Run { text: string; bold?: boolean; italics?: boolean }
interface Word { text: string; bold?: boolean; italics?: boolean; space: boolean }

/** Split **bold** / *italic* markers into styled runs. */
function inlineRuns(text: string): Run[] {
  const out: Run[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    if (m[1] != null) out.push({ text: m[1], bold: true });
    else if (m[2] != null) out.push({ text: m[2], italics: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text }];
}

// US Letter, 1-inch margins.
const PAGE_W = 612, PAGE_H = 792, MARGIN = 72;
const CONTENT_W = PAGE_W - MARGIN * 2;
const GOLD = rgb(0.722, 0.525, 0.043);
const INK = rgb(0.102, 0.102, 0.102);
const MUTED = rgb(0.42, 0.42, 0.42);
const WHITE = rgb(1, 1, 1);
const RULE = rgb(0.85, 0.85, 0.85);
const ZEBRA = rgb(0.969, 0.953, 0.909); // #F7F3E8
const HEADER_FILL = GOLD;

export async function buildDocumentPdf(doc: DocSpec): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts = {
    reg: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    ital: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItal: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const fontFor = (b?: boolean, i?: boolean) =>
    b && i ? fonts.boldItal : b ? fonts.bold : i ? fonts.ital : fonts.reg;

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; };
  const ensure = (h: number) => { if (y - h < MARGIN) newPage(); };

  // Break styled runs into words (keeping spaces) for greedy wrapping.
  const toWords = (runs: Run[]): Word[] => {
    const words: Word[] = [];
    for (const r of runs) {
      for (const part of r.text.split(/(\s+)/)) {
        if (part.length) words.push({ text: part, bold: r.bold, italics: r.italics, space: /^\s+$/.test(part) });
      }
    }
    return words;
  };

  // Wrap words into lines that fit maxW at the given size.
  const wrap = (words: Word[], size: number, maxW: number): Word[][] => {
    const lines: Word[][] = [];
    let line: Word[] = [];
    let w = 0;
    for (const word of words) {
      const ww = fontFor(word.bold, word.italics).widthOfTextAtSize(word.text, size);
      if (word.space) {
        if (line.length === 0) continue; // no leading spaces
        line.push(word); w += ww;
      } else {
        if (w + ww > maxW && line.length) {
          // drop trailing space
          while (line.length && line[line.length - 1].space) { w -= fontFor(line[line.length - 1].bold, line[line.length - 1].italics).widthOfTextAtSize(line[line.length - 1].text, size); line.pop(); }
          lines.push(line); line = []; w = 0;
        }
        line.push(word); w += ww;
      }
    }
    if (line.length) lines.push(line);
    return lines.length ? lines : [[]];
  };

  // Draw wrapped, styled text starting at (x, current y). Advances y.
  const drawParagraph = (
    text: string, opts: { size: number; color: ReturnType<typeof rgb>; x?: number; maxW?: number; lineGap?: number; gapAfter?: number; forceBold?: boolean; forceItal?: boolean },
  ) => {
    const x = opts.x ?? MARGIN;
    const maxW = opts.maxW ?? CONTENT_W;
    const lineH = opts.size * 1.4;
    const runs = (opts.forceBold || opts.forceItal)
      ? [{ text, bold: opts.forceBold, italics: opts.forceItal }]
      : inlineRuns(text);
    const lines = wrap(toWords(runs), opts.size, maxW);
    for (const line of lines) {
      ensure(lineH);
      let cx = x;
      for (const word of line) {
        const f = fontFor(word.bold, word.italics);
        page.drawText(word.text, { x: cx, y: y - opts.size, size: opts.size, font: f, color: opts.color });
        cx += f.widthOfTextAtSize(word.text, opts.size);
      }
      y -= lineH;
    }
    if (opts.gapAfter) y -= opts.gapAfter;
  };

  const drawTable = (headers: string[], rows: string[][]) => {
    const cols = Math.max(headers.length, ...rows.map((r) => r.length), 1);
    const colW = CONTENT_W / cols;
    const size = 10, pad = 5;

    const drawRow = (cells: string[], isHeader: boolean, zebra: boolean) => {
      const lineSets = cells.map((c) => wrap(toWords(inlineRuns(c)), size, colW - pad * 2));
      const rowH = Math.max(...lineSets.map((ls) => ls.length)) * (size * 1.35) + pad * 2;
      ensure(rowH);
      const top = y;
      // Fills
      if (isHeader) page.drawRectangle({ x: MARGIN, y: top - rowH, width: CONTENT_W, height: rowH, color: HEADER_FILL });
      else if (zebra) page.drawRectangle({ x: MARGIN, y: top - rowH, width: CONTENT_W, height: rowH, color: ZEBRA });
      // Cell text + vertical grid
      for (let c = 0; c < cols; c++) {
        const cx = MARGIN + c * colW;
        let ty = top - pad - size;
        for (const line of lineSets[c] ?? [[]]) {
          let lx = cx + pad;
          for (const word of line) {
            const f = isHeader ? fonts.bold : fontFor(word.bold, word.italics);
            page.drawText(word.text, { x: lx, y: ty, size, font: f, color: isHeader ? WHITE : INK });
            lx += f.widthOfTextAtSize(word.text, size);
          }
          ty -= size * 1.35;
        }
        if (c > 0) page.drawLine({ start: { x: cx, y: top }, end: { x: cx, y: top - rowH }, thickness: 0.5, color: RULE });
      }
      // Horizontal border under the row
      page.drawLine({ start: { x: MARGIN, y: top - rowH }, end: { x: MARGIN + CONTENT_W, y: top - rowH }, thickness: 0.5, color: RULE });
      y = top - rowH;
    };

    // Outer top border
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.5, color: RULE });
    if (headers.length) drawRow(headers, true, false);
    rows.forEach((r, i) => drawRow(r, false, i % 2 === 1));
    y -= 10;
  };

  // ── Title block ─────────────────────────────────────────────
  if (doc.title) {
    ensure(34);
    drawParagraph(doc.title, { size: 22, color: INK, forceBold: true, gapAfter: doc.subtitle ? 2 : 12 });
  }
  if (doc.subtitle) {
    drawParagraph(doc.subtitle, { size: 12, color: MUTED, forceItal: true, gapAfter: 6 });
    ensure(10);
    page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: MARGIN + CONTENT_W, y: y + 2 }, thickness: 1.2, color: GOLD });
    y -= 12;
  }

  for (const item of doc.body ?? []) {
    if ("h1" in item) { y -= 8; drawParagraph(String(item.h1), { size: 16, color: GOLD, forceBold: true, gapAfter: 5 }); }
    else if ("h2" in item) { y -= 6; drawParagraph(String(item.h2), { size: 13.5, color: INK, forceBold: true, gapAfter: 4 }); }
    else if ("h3" in item) { y -= 4; drawParagraph(String(item.h3), { size: 12, color: MUTED, forceBold: true, gapAfter: 3 }); }
    else if ("p" in item) drawParagraph(String(item.p), { size: 11, color: INK, gapAfter: 8 });
    else if ("ul" in item) {
      for (const li of item.ul) {
        ensure(15);
        page.drawText("•", { x: MARGIN + 6, y: y - 11, size: 11, font: fonts.bold, color: GOLD });
        drawParagraph(String(li), { size: 11, color: INK, x: MARGIN + 20, maxW: CONTENT_W - 20, gapAfter: 3 });
      }
      y -= 5;
    }
    else if ("ol" in item) {
      item.ol.forEach((li, i) => {
        ensure(15);
        page.drawText(`${i + 1}.`, { x: MARGIN + 4, y: y - 11, size: 11, font: fonts.bold, color: GOLD });
        drawParagraph(String(li), { size: 11, color: INK, x: MARGIN + 22, maxW: CONTENT_W - 22, gapAfter: 3 });
      });
      y -= 5;
    }
    else if ("quote" in item) {
      const startY = y;
      drawParagraph(String(item.quote), { size: 11, color: MUTED, forceItal: true, x: MARGIN + 16, maxW: CONTENT_W - 16, gapAfter: 8 });
      // Gold left bar spanning the quote height (only if it stayed on one page).
      if (y < startY) page.drawRectangle({ x: MARGIN, y: y + 8, width: 3, height: startY - (y + 8), color: GOLD });
    }
    else if ("table" in item) {
      const headers = (item.table.headers ?? []).map(String);
      const rows = (item.table.rows ?? []).map((r) => (Array.isArray(r) ? r.map(String) : [String(r)]));
      y -= 2;
      drawTable(headers, rows);
    }
  }

  // Footer brand + page numbers on every page.
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText("Tokeville", { x: MARGIN, y: 40, size: 8, font: fonts.reg, color: rgb(0.6, 0.6, 0.6) });
    const label = `${i + 1} / ${pages.length}`;
    const w = fonts.reg.widthOfTextAtSize(label, 8);
    p.drawText(label, { x: PAGE_W - MARGIN - w, y: 40, size: 8, font: fonts.reg, color: rgb(0.6, 0.6, 0.6) });
  });

  return pdf.save();
}
