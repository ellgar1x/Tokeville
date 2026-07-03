"use client";

import { memo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

/** Flatten a React children tree into its raw text. */
function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in node) {
    return nodeText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

// Map a fenced-code language to a file extension + mime for downloads.
const EXT: Record<string, { ext: string; mime: string }> = {
  html: { ext: "html", mime: "text/html" },
  xml: { ext: "xml", mime: "application/xml" },
  svg: { ext: "svg", mime: "image/svg+xml" },
  javascript: { ext: "js", mime: "text/javascript" },
  js: { ext: "js", mime: "text/javascript" },
  jsx: { ext: "jsx", mime: "text/javascript" },
  typescript: { ext: "ts", mime: "text/typescript" },
  ts: { ext: "ts", mime: "text/typescript" },
  tsx: { ext: "tsx", mime: "text/typescript" },
  python: { ext: "py", mime: "text/x-python" },
  py: { ext: "py", mime: "text/x-python" },
  css: { ext: "css", mime: "text/css" },
  json: { ext: "json", mime: "application/json" },
  markdown: { ext: "md", mime: "text/markdown" },
  md: { ext: "md", mime: "text/markdown" },
  txt: { ext: "txt", mime: "text/plain" },
  text: { ext: "txt", mime: "text/plain" },
  plaintext: { ext: "txt", mime: "text/plain" },
  tsv: { ext: "tsv", mime: "text/tab-separated-values" },
  bash: { ext: "sh", mime: "text/x-shellscript" },
  sh: { ext: "sh", mime: "text/x-shellscript" },
  shell: { ext: "sh", mime: "text/x-shellscript" },
  sql: { ext: "sql", mime: "application/sql" },
  yaml: { ext: "yaml", mime: "text/yaml" },
  yml: { ext: "yml", mime: "text/yaml" },
  java: { ext: "java", mime: "text/x-java" },
  c: { ext: "c", mime: "text/x-c" },
  cpp: { ext: "cpp", mime: "text/x-c++" },
  go: { ext: "go", mime: "text/x-go" },
  rust: { ext: "rs", mime: "text/x-rust" },
  rs: { ext: "rs", mime: "text/x-rust" },
  ruby: { ext: "rb", mime: "text/x-ruby" },
  php: { ext: "php", mime: "text/x-php" },
};

/** Turn a title into a safe filename base, e.g. "Q4 Report!" -> "q4-report". */
function slug(title: string | undefined, fallback: string): string {
  const s = (title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return s || fallback;
}

/** Lightweight CSV parse (preview + fallback). Handles quoted fields with commas. */
function parseCsv(text: string): string[][] {
  return text.trim().split(/\r?\n/).map((line) => {
    const cells: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; }
        else q = !q;
      } else if (c === "," && !q) { cells.push(cur); cur = ""; }
      else cur += c;
    }
    cells.push(cur);
    return cells;
  });
}

function saveBlob(data: BlobPart, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function TinyButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-subtle transition-colors hover:text-foreground cursor-pointer"
    >
      {children}
    </button>
  );
}

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  return (
    <TinyButton
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(getText());
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? "Copied" : "Copy"}
    </TinyButton>
  );
}

/** Presentation card — turns a ```slides JSON block into a real .pptx download. */
interface Slide { title?: string; subtitle?: string; bullets?: unknown[]; notes?: string }
function SlidesCard({ raw }: { raw: string }) {
  const [building, setBuilding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  let slides: Slide[] | null = null;
  try {
    const parsed = JSON.parse(raw);
    slides = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.slides) ? parsed.slides : null;
  } catch {
    slides = null;
  }

  async function build() {
    if (!slides) return;
    setErr(null);
    setBuilding(true);
    try {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      const BG = "0A0A0B", GOLD = "E8B85F", INK = "F6F4EE", MUTED = "A2A2AB";
      const W = 13.33;

      slides.forEach((s, i) => {
        const slide = pptx.addSlide();
        slide.background = { color: BG };
        const isTitle = i === 0;

        if (isTitle) {
          // Cover slide — centered title, gold rule, subtitle.
          slide.addText(String(s.title ?? "Presentation"), {
            x: 0.8, y: 2.4, w: W - 1.6, h: 1.6, fontSize: 44, bold: true, color: GOLD, fontFace: "Arial", align: "center",
          });
          slide.addShape(pptx.ShapeType.line, { x: W / 2 - 1.2, y: 4.15, w: 2.4, h: 0, line: { color: GOLD, width: 2 } });
          if (s.subtitle) slide.addText(String(s.subtitle), {
            x: 1.2, y: 4.4, w: W - 2.4, h: 0.9, fontSize: 18, color: MUTED, align: "center", fontFace: "Arial",
          });
        } else {
          // Content slide — accent bar, title, divider, bullets.
          slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.62, w: 0.09, h: 0.62, fill: { color: GOLD } });
          slide.addText(String(s.title ?? `Slide ${i + 1}`), {
            x: 0.85, y: 0.5, w: W - 1.6, h: 0.9, fontSize: 28, bold: true, color: GOLD, fontFace: "Arial",
          });
          if (s.subtitle) slide.addText(String(s.subtitle), {
            x: 0.85, y: 1.32, w: W - 1.6, h: 0.5, fontSize: 15, italic: true, color: MUTED, fontFace: "Arial",
          });
          slide.addShape(pptx.ShapeType.line, { x: 0.85, y: s.subtitle ? 1.85 : 1.5, w: W - 1.7, h: 0, line: { color: "3A3A3D", width: 1 } });
          const bullets = Array.isArray(s.bullets) ? s.bullets : [];
          if (bullets.length) {
            slide.addText(
              bullets.map((b) => ({ text: String(b), options: { bullet: { code: "2022", indent: 18 }, fontSize: 18, color: INK, paraSpaceAfter: 14 } })),
              { x: 1.0, y: s.subtitle ? 2.15 : 1.8, w: W - 2.0, h: 5.0, valign: "top", fontFace: "Arial", lineSpacingMultiple: 1.1 },
            );
          }
          // Footer: brand + slide number.
          slide.addText("Tokeville", { x: 0.85, y: 7.0, w: 3, h: 0.3, fontSize: 10, color: "5A5A5D", fontFace: "Arial" });
          slide.addText(String(i + 1), { x: W - 1.3, y: 7.0, w: 0.7, h: 0.3, fontSize: 10, color: "5A5A5D", align: "right", fontFace: "Arial" });
        }
        if (s.notes) slide.addNotes(String(s.notes));
      });
      const fname = `${slug(slides[0]?.title, "presentation")}.pptx`;
      const blob = (await pptx.write({ outputType: "blob" })) as Blob;
      saveBlob(blob, "application/vnd.openxmlformats-officedocument.presentationml.presentation", fname);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not build the deck");
    } finally {
      setBuilding(false);
    }
  }

  if (!slides) {
    // Fall back to showing the raw block if it isn't valid slide JSON.
    return <pre className="scroll-thin my-3 overflow-x-auto rounded-xl border border-border-strong bg-[#0d1117] px-4 py-3 text-[13px]">{raw}</pre>;
  }

  return (
    <div className="my-3 rounded-xl border border-gold/25 bg-gold-soft p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold">
          <SlidesIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Presentation ready</p>
          <p className="text-xs text-subtle">{slides.length} slide{slides.length === 1 ? "" : "s"} · PowerPoint (.pptx)</p>
        </div>
        <button
          onClick={build}
          disabled={building}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-3 text-xs font-semibold text-[#0a0a0b] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:opacity-50 cursor-pointer"
        >
          <DownloadIcon /> {building ? "Building…" : "Download .pptx"}
        </button>
      </div>
      {/* Slide outline preview */}
      <ol className="mt-3 space-y-1.5">
        {slides.slice(0, 8).map((s, i) => (
          <li key={i} className="flex gap-2 text-xs">
            <span className="tnum shrink-0 font-mono text-subtle">{i + 1}.</span>
            <span className="font-medium">{String(s.title ?? `Slide ${i + 1}`)}</span>
          </li>
        ))}
        {slides.length > 8 && <li className="text-xs text-subtle">+ {slides.length - 8} more</li>}
      </ol>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}

/* ── Word document card: a ```document JSON block → real .docx ─────────────── */
type DocItem =
  | { h1: string } | { h2: string } | { h3: string }
  | { p: string } | { ul: unknown[] } | { ol: unknown[] }
  | { quote: string } | { table: { headers?: unknown[]; rows?: unknown[][] } };
interface DocSpec { title?: string; subtitle?: string; body?: DocItem[] }

/** Split a string with **bold** / *italic* markers into docx TextRun options. */
function inlineRuns(text: string): Array<{ text: string; bold?: boolean; italics?: boolean }> {
  const out: Array<{ text: string; bold?: boolean; italics?: boolean }> = [];
  // Match **bold** or *italic*; everything else is a plain run.
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

function DocumentCard({ raw }: { raw: string }) {
  const [busy, setBusy] = useState<null | "docx" | "pdf">(null);
  const [err, setErr] = useState<string | null>(null);

  let doc: DocSpec | null = null;
  try {
    const parsed = JSON.parse(raw);
    doc = parsed && Array.isArray(parsed.body) ? parsed : null;
  } catch { doc = null; }

  async function buildPdf() {
    if (!doc) return;
    setErr(null);
    setBusy("pdf");
    try {
      const { buildDocumentPdf } = await import("@/lib/buildPdf");
      const bytes = await buildDocumentPdf(doc);
      saveBlob(bytes as BlobPart, "application/pdf", `${slug(doc.title, "document")}.pdf`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not build the PDF");
    } finally {
      setBusy(null);
    }
  }

  async function buildDocx() {
    if (!doc) return;
    setErr(null);
    setBusy("docx");
    try {
      const docx = await import("docx");
      const {
        Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType,
        Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, LevelFormat,
      } = docx;

      const GOLD = "B8860B"; // deep gold for headings/accents
      const INK = "1A1A1A";
      const MUTED = "6B6B6B";
      const runs = (t: string, extra: object = {}) =>
        inlineRuns(t).map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italics, font: "Calibri", ...extra }));

      const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];

      // Title block
      if (doc.title) {
        children.push(new Paragraph({
          spacing: { after: doc.subtitle ? 60 : 240 },
          children: [new TextRun({ text: doc.title, bold: true, size: 40, color: INK, font: "Calibri" })],
        }));
      }
      if (doc.subtitle) {
        children.push(new Paragraph({
          spacing: { after: 240 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 8 } },
          children: [new TextRun({ text: doc.subtitle, italics: true, size: 24, color: MUTED, font: "Calibri" })],
        }));
      }

      for (const item of doc.body ?? []) {
        if ("h1" in item) {
          children.push(new Paragraph({
            heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 },
            children: [new TextRun({ text: String(item.h1), bold: true, size: 30, color: GOLD, font: "Calibri" })],
          }));
        } else if ("h2" in item) {
          children.push(new Paragraph({
            heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 },
            children: [new TextRun({ text: String(item.h2), bold: true, size: 26, color: INK, font: "Calibri" })],
          }));
        } else if ("h3" in item) {
          children.push(new Paragraph({
            heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 },
            children: [new TextRun({ text: String(item.h3), bold: true, size: 23, color: MUTED, font: "Calibri" })],
          }));
        } else if ("p" in item) {
          children.push(new Paragraph({
            spacing: { after: 160, line: 276 }, alignment: AlignmentType.JUSTIFIED,
            children: runs(String(item.p), { size: 22, color: INK }),
          }));
        } else if ("ul" in item) {
          for (const li of item.ul) children.push(new Paragraph({
            bullet: { level: 0 }, spacing: { after: 60, line: 276 },
            children: runs(String(li), { size: 22, color: INK }),
          }));
        } else if ("ol" in item) {
          item.ol.forEach((li) => children.push(new Paragraph({
            numbering: { reference: "ol-num", level: 0 }, spacing: { after: 60, line: 276 },
            children: runs(String(li), { size: 22, color: INK }),
          })));
        } else if ("quote" in item) {
          children.push(new Paragraph({
            spacing: { before: 120, after: 160 }, indent: { left: 360 },
            border: { left: { style: BorderStyle.SINGLE, size: 18, color: GOLD, space: 12 } },
            children: runs(String(item.quote), { italics: true, size: 22, color: MUTED }),
          }));
        } else if ("table" in item) {
          const headers = (item.table.headers ?? []).map(String);
          const rows = (item.table.rows ?? []).map((r) => (Array.isArray(r) ? r.map(String) : [String(r)]));
          const cols = Math.max(headers.length, ...rows.map((r) => r.length), 1);
          const border = { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" };
          const borders = { top: border, bottom: border, left: border, right: border };
          const tableRows: InstanceType<typeof TableRow>[] = [];
          if (headers.length) {
            tableRows.push(new TableRow({
              tableHeader: true,
              children: Array.from({ length: cols }, (_, c) => new TableCell({
                shading: { type: ShadingType.CLEAR, fill: GOLD, color: "auto" },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({ children: [new TextRun({ text: headers[c] ?? "", bold: true, size: 21, color: "FFFFFF", font: "Calibri" })] })],
              })),
            }));
          }
          rows.forEach((r, ri) => tableRows.push(new TableRow({
            children: Array.from({ length: cols }, (_, c) => new TableCell({
              shading: ri % 2 ? { type: ShadingType.CLEAR, fill: "F7F3E8", color: "auto" } : undefined,
              margins: { top: 50, bottom: 50, left: 100, right: 100 },
              children: [new Paragraph({ children: runs(r[c] ?? "", { size: 21, color: INK }) })],
            })),
          })));
          children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows: tableRows }));
          children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
        }
      }

      const document = new Document({
        creator: "Tokeville",
        styles: { default: { document: { run: { font: "Calibri", size: 22, color: INK } } } },
        numbering: {
          config: [{
            reference: "ol-num",
            levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
          }],
        },
        sections: [{
          properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
          children,
        }],
      });
      const blob = await Packer.toBlob(document);
      saveBlob(blob, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", `${slug(doc.title, "document")}.docx`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not build the document");
    } finally {
      setBusy(null);
    }
  }

  if (!doc) return <pre className="scroll-thin my-3 overflow-x-auto rounded-xl border border-border-strong bg-[#0d1117] px-4 py-3 text-[13px]">{raw}</pre>;

  const headings = (doc.body ?? []).filter((b) => "h1" in b || "h2" in b) as Array<{ h1?: string; h2?: string }>;
  return (
    <div className="my-3 rounded-xl border border-gold/25 bg-gold-soft p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold"><DocIcon /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{doc.title || "Document ready"}</p>
          <p className="text-xs text-subtle">Document · Word or PDF</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={buildPdf} disabled={busy !== null} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-strong bg-background/60 px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-gold/40 disabled:opacity-50 cursor-pointer">
            {busy === "pdf" ? "…" : ".pdf"}
          </button>
          <button onClick={buildDocx} disabled={busy !== null} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-3 text-xs font-semibold text-[#0a0a0b] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:opacity-50 cursor-pointer">
            <DownloadIcon /> {busy === "docx" ? "Building…" : "Download .docx"}
          </button>
        </div>
      </div>
      {headings.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {headings.slice(0, 8).map((h, i) => (
            <li key={i} className="truncate text-xs font-medium">{String(h.h1 ?? h.h2)}</li>
          ))}
        </ol>
      )}
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}

/* ── Spreadsheet card: a ```sheet JSON block or ```csv block → real .xlsx/.csv ─ */
function SheetCard({ raw, isCsv }: { raw: string; isCsv: boolean }) {
  const [busy, setBusy] = useState<null | "xlsx" | "csv">(null);
  const [err, setErr] = useState<string | null>(null);

  // Normalise both inputs to a name + array-of-arrays (header row first).
  let name = "Sheet1";
  let aoa: string[][] | null = null;
  if (isCsv) {
    aoa = raw.trim() ? parseCsv(raw) : null;
  } else {
    try {
      const p = JSON.parse(raw);
      const cols = Array.isArray(p?.columns) ? p.columns.map(String) : null;
      const rows = Array.isArray(p?.rows) ? p.rows.map((r: unknown[]) => (Array.isArray(r) ? r.map(String) : [String(r)])) : [];
      if (cols) { aoa = [cols, ...rows]; name = String(p.name ?? "Sheet1"); }
    } catch { aoa = null; }
  }

  async function download(kind: "xlsx" | "csv") {
    if (!aoa) return;
    setErr(null);
    setBusy(kind);
    try {
      if (kind === "csv") {
        // Quote fields containing comma/quote/newline per RFC 4180.
        const csv = isCsv ? raw : aoa.map((row) =>
          row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","),
        ).join("\r\n");
        saveBlob(csv, "text/csv", `${slug(name, "data")}.csv`);
        return;
      }

      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "Tokeville";
      const ws = wb.addWorksheet(name.slice(0, 31) || "Sheet1", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      const [header, ...body] = aoa;

      // Detect a currency/number column from a cell like "$1,200.50" or "1,200".
      const parseNum = (v: string): { num: number; currency: boolean } | null => {
        const t = v.trim();
        const currency = /^-?\$/.test(t);
        const cleaned = t.replace(/[$,\s]/g, "");
        if (cleaned === "" || !/^-?\d*\.?\d+%?$/.test(cleaned)) return null;
        const n = Number(cleaned.replace("%", ""));
        return Number.isFinite(n) ? { num: /%$/.test(cleaned) ? n / 100 : n, currency } : null;
      };

      // Header row — gold fill, white bold, centered.
      const headerRow = ws.addRow(header);
      headerRow.height = 22;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Calibri" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB8860B" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { bottom: { style: "thin", color: { argb: "FF8C6508" } } };
      });

      // Data rows — number/currency detection, thin borders, zebra striping.
      body.forEach((r, ri) => {
        const cells = header.map((_, ci) => {
          const parsed = parseNum(r[ci] ?? "");
          return parsed ? parsed.num : (r[ci] ?? "");
        });
        const row = ws.addRow(cells);
        row.eachCell((cell, ci) => {
          const parsed = parseNum(r[ci - 1] ?? "");
          cell.font = { size: 11, name: "Calibri", color: { argb: "FF1A1A1A" } };
          cell.alignment = { vertical: "middle", horizontal: parsed ? "right" : "left" };
          if (parsed?.currency) cell.numFmt = '$#,##0.00';
          else if (parsed && /%/.test(r[ci - 1] ?? "")) cell.numFmt = "0.0%";
          else if (parsed && Number.isInteger(parsed.num)) cell.numFmt = "#,##0";
          if (ri % 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F3E8" } };
          cell.border = { bottom: { style: "hair", color: { argb: "FFE0E0E0" } } };
        });
      });

      // Auto-fit column widths from content length (clamped).
      ws.columns.forEach((col, i) => {
        let max = String(header[i] ?? "").length;
        for (const r of body) max = Math.max(max, String(r[i] ?? "").length);
        col.width = Math.min(Math.max(max + 3, 10), 48);
      });
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };

      const buf = await wb.xlsx.writeBuffer();
      saveBlob(buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${slug(name, "data")}.xlsx`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not build the spreadsheet");
    } finally {
      setBusy(null);
    }
  }

  if (!aoa || aoa.length === 0) return <pre className="scroll-thin my-3 overflow-x-auto rounded-xl border border-border-strong bg-[#0d1117] px-4 py-3 text-[13px]">{raw}</pre>;

  const [header, ...rows] = aoa;
  return (
    <div className="my-3 rounded-xl border border-gold/25 bg-gold-soft p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold"><SheetIcon /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Spreadsheet ready</p>
          <p className="text-xs text-subtle">{rows.length} row{rows.length === 1 ? "" : "s"} · {header.length} column{header.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={() => download("csv")} disabled={busy !== null} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-strong bg-background/60 px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-gold/40 disabled:opacity-50 cursor-pointer">
            {busy === "csv" ? "…" : ".csv"}
          </button>
          <button onClick={() => download("xlsx")} disabled={busy !== null} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-3 text-xs font-semibold text-[#0a0a0b] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:opacity-50 cursor-pointer">
            <DownloadIcon /> {busy === "xlsx" ? "Building…" : "Download .xlsx"}
          </button>
        </div>
      </div>
      {/* Small preview of the first rows */}
      <div className="scroll-thin mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>{header.map((h, i) => <th key={i} className="border-b border-gold/20 px-2 py-1 text-left font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((r, ri) => (
              <tr key={ri}>{header.map((_, ci) => <td key={ci} className="border-b border-border/60 px-2 py-1 text-muted">{r[ci] ?? ""}</td>)}</tr>
            ))}
          </tbody>
        </table>
        {rows.length > 5 && <p className="mt-1.5 text-xs text-subtle">+ {rows.length - 5} more row{rows.length - 5 === 1 ? "" : "s"}</p>}
      </div>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}

/** A fenced code block: header (language + copy + download [+ preview]) over the highlighted code. */
function PreBlock({ children }: { children?: ReactNode }) {
  const codeEl = Array.isArray(children) ? children[0] : children;
  const className =
    (codeEl && typeof codeEl === "object" && "props" in codeEl
      ? (codeEl as { props: { className?: string } }).props.className
      : "") ?? "";
  const lang = (/language-([\w-]+)/.exec(className)?.[1] ?? "").toLowerCase();
  const raw = nodeText(children);

  // Rich file types get dedicated "file ready" download cards.
  if (lang === "slides") return <SlidesCard raw={raw} />;
  if (lang === "document" || lang === "docx" || lang === "pdf") return <DocumentCard raw={raw} />;
  if (lang === "sheet" || lang === "xlsx") return <SheetCard raw={raw} isCsv={false} />;
  if (lang === "csv") return <SheetCard raw={raw} isCsv={true} />;

  const meta = EXT[lang];
  const isHtml = lang === "html";

  function download() {
    const { ext, mime } = meta ?? { ext: "txt", mime: "text/plain" };
    saveBlob(raw, mime, `tokeville-file.${ext}`);
  }
  function preview() {
    const url = URL.createObjectURL(new Blob([raw], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border-strong bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-border-strong px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-subtle">{lang || "code"}</span>
        <div className="flex items-center gap-0.5">
          {isHtml && <TinyButton onClick={preview}>Preview ↗</TinyButton>}
          <TinyButton onClick={download}>Download</TinyButton>
          <CopyButton getText={() => raw} />
        </div>
      </div>
      <pre className="scroll-thin overflow-x-auto px-4 py-3 text-[13px] leading-relaxed">{children}</pre>
    </div>
  );
}

export const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: PreBlock,
          code({ className, children, ...props }) {
            if (className?.includes("language-") || className?.includes("hljs")) {
              return <code className={className} {...props}>{children}</code>;
            }
            return <code className="md-inline-code" {...props}>{children}</code>;
          },
          a({ children, ...props }) {
            return <a target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2v8m0 0 3-3m-3 3L5 7M3 13h10" />
    </svg>
  );
}
function SlidesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
      <path d="M10 13.5V17M7 17h6" strokeLinecap="round" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 2.5h6l4 4v11a0 0 0 0 1 0 0H5a0 0 0 0 1 0 0V2.5Z" />
      <path d="M11 2.5v4h4M7.5 10.5h5M7.5 13.5h5" />
    </svg>
  );
}
function SheetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="3" width="15" height="14" rx="1.5" />
      <path d="M2.5 8h15M2.5 12.5h15M8 3v14" />
    </svg>
  );
}
