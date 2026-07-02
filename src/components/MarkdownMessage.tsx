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
      slides.forEach((s, i) => {
        const slide = pptx.addSlide();
        slide.background = { color: "0A0A0B" };
        slide.addText(String(s.title ?? `Slide ${i + 1}`), {
          x: 0.6, y: 0.5, w: 12, h: 1, fontSize: 30, bold: true, color: "E8B85F", fontFace: "Arial",
        });
        if (s.subtitle) {
          slide.addText(String(s.subtitle), { x: 0.6, y: 1.5, w: 12, h: 0.6, fontSize: 16, color: "A2A2AB" });
        }
        const bullets = Array.isArray(s.bullets) ? s.bullets : [];
        if (bullets.length) {
          slide.addText(
            bullets.map((b) => ({ text: String(b), options: { bullet: true, fontSize: 18, color: "F6F4EE", paraSpaceAfter: 8 } })),
            { x: 0.9, y: s.subtitle ? 2.3 : 1.8, w: 11.4, h: 4.5, valign: "top" },
          );
        }
        if (s.notes) slide.addNotes(String(s.notes));
      });
      await pptx.writeFile({ fileName: "tokeville-presentation.pptx" });
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
  | { p: string } | { ul: unknown[] } | { ol: unknown[] };
interface DocSpec { title?: string; body?: DocItem[] }

function DocumentCard({ raw }: { raw: string }) {
  const [building, setBuilding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  let doc: DocSpec | null = null;
  try {
    const parsed = JSON.parse(raw);
    doc = parsed && Array.isArray(parsed.body) ? parsed : null;
  } catch { doc = null; }

  async function build() {
    if (!doc) return;
    setErr(null);
    setBuilding(true);
    try {
      const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");
      const paras: InstanceType<typeof Paragraph>[] = [];
      if (doc.title) paras.push(new Paragraph({ text: doc.title, heading: HeadingLevel.TITLE }));
      for (const item of doc.body ?? []) {
        if ("h1" in item) paras.push(new Paragraph({ text: String(item.h1), heading: HeadingLevel.HEADING_1 }));
        else if ("h2" in item) paras.push(new Paragraph({ text: String(item.h2), heading: HeadingLevel.HEADING_2 }));
        else if ("h3" in item) paras.push(new Paragraph({ text: String(item.h3), heading: HeadingLevel.HEADING_3 }));
        else if ("p" in item) paras.push(new Paragraph({ children: [new TextRun(String(item.p))] }));
        else if ("ul" in item) for (const li of item.ul) paras.push(new Paragraph({ text: String(li), bullet: { level: 0 } }));
        else if ("ol" in item) item.ol.forEach((li, i) => paras.push(new Paragraph({ text: `${i + 1}. ${String(li)}` })));
      }
      const document = new Document({ sections: [{ children: paras }] });
      const blob = await Packer.toBlob(document);
      saveBlob(blob, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", `${slug(doc.title, "document")}.docx`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not build the document");
    } finally {
      setBuilding(false);
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
          <p className="text-xs text-subtle">Word document (.docx)</p>
        </div>
        <button onClick={build} disabled={building} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-3 text-xs font-semibold text-[#0a0a0b] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:opacity-50 cursor-pointer">
          <DownloadIcon /> {building ? "Building…" : "Download .docx"}
        </button>
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
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      if (kind === "csv") {
        const csv = isCsv ? raw : XLSX.utils.sheet_to_csv(ws);
        saveBlob(csv, "text/csv", `${slug(name, "data")}.csv`);
      } else {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31) || "Sheet1");
        const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
        saveBlob(out, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${slug(name, "data")}.xlsx`);
      }
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
  if (lang === "document" || lang === "docx") return <DocumentCard raw={raw} />;
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
