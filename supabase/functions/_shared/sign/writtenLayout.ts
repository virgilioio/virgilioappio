// Gio Sign: lays out a document written in Gio (2026-10-17). The input is the
// editor's own JSON (Lexical): paragraphs, headings, lists, quotes, page
// breaks, callouts ("gio-callout": icon, tone; added 2026-10-18), tables
// ("table" > "tablerow" > "tablecell" with headerState; 2026-10-18), small
// text for the whole document (content.gio.small; 2026-10-18), two columns
// ("gio-columns" > two "gio-column"s of blocks; 2026-10-18), data tags
// ("placeholder", with an optional print "format"),
// conditional sections ("gio-if"), signing blocks ("gio-sign") and signer
// fields inside the text ("gio-field": roleId, fieldType, required, label). The output is a list of pages of simple drawing
// operations plus where each signing block landed, so the server can draw the
// PDF with pdf-lib (written.ts) and add the blocks as fields. Pure, so the
// app's preview and the sent PDF can never disagree. ASCII only.

export type Style = "regular" | "bold" | "italic" | "boldItalic";
export type Ink = "ink" | "muted" | "rule" | "lilac" | "danger";

export interface TextOp {
  kind: "text";
  /** Points from the page's left edge. */
  x: number;
  /** Baseline, points from the page's top edge. */
  y: number;
  text: string;
  style: Style;
  size: number;
  color: Ink;
  underline?: boolean;
  strike?: boolean;
}
export interface LineOp {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: Ink;
}
/** A callout's tinted box (fill plus a 0.75pt edge, 4pt corners), drawn under its text. */
export interface BoxOp {
  kind: "box";
  x: number;
  y: number;
  w: number;
  h: number;
  tone: CalloutTone;
}
/** A callout's icon: Lucide strokes on a 24-unit grid, scaled to `size` points. */
export interface IconOp {
  kind: "icon";
  x: number;
  y: number;
  size: number;
  icon: Exclude<CalloutIcon, "none">;
  tone: CalloutTone;
}
/** A plain filled rectangle (a table's header row), drawn under its text. */
export interface RectOp {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  /** "#RRGGBB". */
  fill: string;
}
export type Op = TextOp | LineOp | BoxOp | IconOp | RectOp;

// ---- Callouts (Gio Docs' callout, in the ATS's own colours) -----------------
export type CalloutTone = "neutral" | "yellow" | "green" | "blue" | "red";
export type CalloutIcon = "idea" | "info" | "warning" | "check" | "none";
export const CALLOUT_TONES: Record<CalloutTone, { label: string; bg: string; ring: string; ink: string }> = {
  neutral: { label: "Neutral", bg: "#F4F3EF", ring: "#E3E1DA", ink: "#5A6072" },
  yellow: { label: "Yellow", bg: "#FDF6DD", ring: "#EFDFA2", ink: "#A16207" },
  green: { label: "Green", bg: "#E8F6EF", ring: "#BFE3D0", ink: "#0B7A52" },
  blue: { label: "Blue", bg: "#EAF2FD", ring: "#C8DBF5", ink: "#2563EB" },
  red: { label: "Red", bg: "#FCEDEB", ring: "#F1CBC6", ink: "#C2372B" },
};
const CIRCLE = "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0";
/** Lucide's Lightbulb, Info, TriangleAlert and CircleCheck (circles written as arcs). */
export const CALLOUT_ICONS: Record<Exclude<CalloutIcon, "none">, { label: string; paths: string[] }> = {
  idea: { label: "Idea", paths: ["M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5", "M9 18h6", "M10 22h4"] },
  info: { label: "Info", paths: [CIRCLE, "M12 16v-4", "M12 8h.01"] },
  warning: { label: "Warning", paths: ["m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3", "M12 9v4", "M12 17h.01"] },
  check: { label: "Check", paths: [CIRCLE, "m9 12 2 2 4-4"] },
};
export function calloutTone(v: unknown): CalloutTone {
  return typeof v === "string" && v in CALLOUT_TONES ? (v as CalloutTone) : "neutral";
}
export function calloutIcon(v: unknown): CalloutIcon {
  return v === "none" || (typeof v === "string" && v in CALLOUT_ICONS) ? (v as CalloutIcon) : "idea";
}
const CALLOUT_PAD = 10;
const CALLOUT_ICON = 12;
const CALLOUT_GAP = 8;

export interface WrittenPage {
  ops: Op[];
}
/** A signing block or a signer field in the text: where its field goes, in % of the page from the top-left. */
export interface WrittenBlock {
  role_id: string;
  kind: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Signer fields in the text only (sign_attach_render keeps them). */
  required?: boolean;
  label?: string;
}
export interface WrittenLayout {
  width: number;
  height: number;
  pages: WrittenPage[];
  blocks: WrittenBlock[];
}

export interface LayoutOptions {
  /** Values by tag key, already formatted for print. */
  values: Record<string, string | null | undefined>;
  /** Width of text in points. */
  measure: (text: string, style: Style, size: number) => number;
  /** Signing role labels by template role id. */
  roles?: Record<string, string>;
  /** Replaces characters the font can't print (default: none). */
  sanitize?: (text: string) => string;
  /** Template preview with no record: tags print as [Label], every section shows. */
  tags?: Record<string, string> | null;
  /**
   * The send sheet's preview (2026-10-17): each value gets a lilac underline
   * and an empty one prints as [Label] in muted, labels by key. Never used
   * for the PDF that is sent.
   */
  highlight?: Record<string, string> | null;
  /** With highlight: the colour of an empty value's [Label] (the template editor uses danger). */
  emptyInk?: Ink;
  maxPages?: number;
}

export const PAGE_W = 612;
export const PAGE_H = 792;
const MARGIN_X = 72;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const BODY = 11;
/** Small text (Gio Docs' page setting): body 9.5pt, headings in the same ratio. */
export const SMALL_SCALE = 9.5 / 11;
const LEAD = 1.4;
const PARA_AFTER = 6;
const LIST_INDENT = 22;
const BULLET = "\u2022";
const MIDDOT = "\u00b7";

const HEADING: Record<string, { size: number; before: number; after: number }> = {
  h1: { size: 20, before: 8, after: 8 },
  h2: { size: 15, before: 8, after: 6 },
  h3: { size: 12.5, before: 6, after: 4 },
  h4: { size: 11, before: 6, after: 4 },
  h5: { size: 11, before: 6, after: 4 },
  h6: { size: 11, before: 6, after: 4 },
};

/** Field size of a signing block, in points. */
export const BLOCK_SIZE: Record<string, { w: number; h: number; label: string }> = {
  signature: { w: 216, h: 40, label: "Signature" },
  initials: { w: 72, h: 32, label: "Initials" },
  date: { w: 144, h: 22, label: "Date signed" },
  name: { w: 216, h: 22, label: "Full name" },
};
/** Width of a signer field inside the text, in points (checkbox: a square the size of the text). */
const INLINE_FIELD_W: Record<string, number> = { initials: 48, date: 96, name: 150, text: 150 };
const BLOCK_LABEL = 8.5;
const BLOCK_AFTER = 14;
const BLOCK_GAP = 28;

// Lexical text format bits.
const IS_BOLD = 1;
const IS_ITALIC = 2;
const IS_STRIKE = 4;
const IS_UNDERLINE = 8;

// deno-lint-ignore no-explicit-any
type Node = Record<string, any>;

// ---- Conditions -------------------------------------------------------------
const YES = new Set(["yes", "true", "1", "on", "y"]);

/** Whether a conditional section prints, from the value it depends on. */
export function conditionHolds(op: string | null | undefined, raw: string | null | undefined, expected?: string | null): boolean {
  const v = String(raw ?? "").trim();
  const low = v.toLowerCase();
  switch (op) {
    case "yes":
      return YES.has(low);
    case "no":
      return !YES.has(low);
    case "empty":
      return v === "";
    case "equals":
      return low === String(expected ?? "").trim().toLowerCase();
    case "not_equals":
      return low !== String(expected ?? "").trim().toLowerCase();
    case "gt0": {
      // Money and numbers print with their currency and separators: read the figure.
      const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
      return Number.isFinite(n) && n > 0;
    }
    case "filled":
    default:
      return v !== "";
  }
}

// ---- Inline text --------------------------------------------------------------
interface Piece {
  text: string;
  style: Style;
  size: number;
  w: number;
  underline: boolean;
  strike: boolean;
  color: Ink;
  /** A filled-in value in a highlighted preview. */
  mark?: boolean;
  /** A signer field inside the text: drawn as a line (or a square) and kept as a field. */
  field?: { roleId: string; kind: string; required: boolean; label: string };
}
/** A word (pieces with no space between them), a space, or a hard line break. */
type Unit = { t: "word"; pieces: Piece[]; w: number } | { t: "space"; w: number } | { t: "break" };

interface Line {
  units: Unit[];
  w: number;
  /** Ends because the paragraph or a hard break ends it (never justified). */
  hard: boolean;
}

function styleOf(format: number, base: Style): Style {
  const bold = (format & IS_BOLD) !== 0 || base === "bold" || base === "boldItalic";
  const italic = (format & IS_ITALIC) !== 0 || base === "italic" || base === "boldItalic";
  return bold && italic ? "boldItalic" : bold ? "bold" : italic ? "italic" : "regular";
}

class Inline {
  units: Unit[] = [];
  private word: Piece[] | null = null;
  constructor(private o: LayoutOptions, private size: number, private base: Style, private color: Ink) {}

  private endWord() {
    if (this.word && this.word.length) {
      this.units.push({ t: "word", pieces: this.word, w: this.word.reduce((s, p) => s + p.w, 0) });
    }
    this.word = null;
  }

  text(raw: string, format = 0, mark = false, color?: Ink) {
    const clean = (this.o.sanitize ?? ((s: string) => s))(String(raw ?? "").replace(/\r\n?/g, "\n").replace(/\t/g, " "));
    const style = styleOf(format, this.base);
    const underline = (format & IS_UNDERLINE) !== 0;
    const strike = (format & IS_STRIKE) !== 0;
    const parts = clean.split(/(\n| +)/);
    for (const part of parts) {
      if (part === "") continue;
      if (part === "\n") {
        this.endWord();
        this.units.push({ t: "break" });
      } else if (part[0] === " ") {
        this.endWord();
        this.units.push({ t: "space", w: this.o.measure(" ", style, this.size) });
      } else {
        if (!this.word) this.word = [];
        this.word.push({ text: part, style, size: this.size, w: this.o.measure(part, style, this.size), underline, strike, color: color ?? this.color, mark: mark || undefined });
      }
    }
  }

  lineBreak() {
    this.endWord();
    this.units.push({ t: "break" });
  }

  /** A signer field: its own word, a fixed width wide. */
  field(f: NonNullable<Piece["field"]>) {
    this.endWord();
    const w = f.kind === "checkbox" ? this.size * 0.9 : INLINE_FIELD_W[f.kind] ?? INLINE_FIELD_W.text;
    const piece: Piece = { text: "", style: this.base, size: this.size, w, underline: false, strike: false, color: "rule", field: f };
    this.units.push({ t: "word", pieces: [piece], w });
  }

  done(): Unit[] {
    this.endWord();
    return this.units;
  }
}

/** Print formats a value can take (sign_format); anything else prints the default wording. */
const FORMATS = new Set(["money_code", "money_symbol", "money_words", "date_long", "date_numeric", "date_dmy", "number", "number_words"]);

function tagText(o: LayoutOptions, key: string, format?: unknown): string {
  if (o.tags) return "[" + (o.tags[key] ?? key) + "]";
  // A value in its format travels as "key|format" (sign_send freezes them).
  const f = typeof format === "string" && FORMATS.has(format) ? format : null;
  const v = (f ? o.values[key + "|" + f] : null) ?? o.values[key];
  return v == null ? "" : String(v);
}

const FIELD_KINDS = new Set(["initials", "date", "name", "text", "checkbox"]);

function collectInline(o: LayoutOptions, nodes: Node[] | undefined, into: Inline) {
  for (const n of nodes ?? []) {
    switch (n?.type) {
      case "text":
        into.text(n.text ?? "", Number(n.format) || 0);
        break;
      case "linebreak":
        into.lineBreak();
        break;
      case "tab":
        into.text(" ", Number(n.format) || 0);
        break;
      case "placeholder": {
        // "format" on a tag is its print format, not text formatting.
        const key = String(n.placeholderKey ?? "");
        const text = tagText(o, key, n.format);
        if (o.highlight && !o.tags) {
          if (text.trim()) into.text(text, 0, true);
          else into.text("[" + (o.highlight[key] ?? key) + "]", 0, false, o.emptyInk ?? "muted");
        } else into.text(text, 0);
        break;
      }
      case "gio-field": {
        const kind = String(n.fieldType ?? "");
        if (!FIELD_KINDS.has(kind) || !n.roleId) break;
        into.field({ roleId: String(n.roleId), kind, required: n.required !== false, label: String(n.label ?? "").slice(0, 80) });
        break;
      }
      default:
        // Links, marks and anything else inline: their text.
        if (Array.isArray(n?.children)) collectInline(o, n.children, into);
        else if (typeof n?.text === "string") into.text(n.text, Number(n.format) || 0);
    }
  }
}

function breakLong(word: Unit & { t: "word" }, maxW: number, measure: LayoutOptions["measure"]): Unit[] {
  const out: Unit[] = [];
  let cur: Piece[] = [];
  let curW = 0;
  const flush = () => {
    if (cur.length) out.push({ t: "word", pieces: cur, w: curW });
    cur = [];
    curW = 0;
  };
  for (const p of word.pieces) {
    let chunk = "";
    for (const ch of p.text) {
      const next = chunk + ch;
      if (curW + measure(next, p.style, p.size) > maxW && (chunk || cur.length)) {
        if (chunk) {
          const w = measure(chunk, p.style, p.size);
          cur.push({ ...p, text: chunk, w });
          curW += w;
        }
        flush();
        chunk = ch;
      } else {
        chunk = next;
      }
    }
    if (chunk) {
      const w = measure(chunk, p.style, p.size);
      cur.push({ ...p, text: chunk, w });
      curW += w;
    }
  }
  flush();
  return out;
}

/** Greedy wrap at word boundaries; a word wider than the line is cut. */
export function wrapUnits(units: Unit[], maxW: number, measure: LayoutOptions["measure"]): Line[] {
  const lines: Line[] = [];
  let cur: Unit[] = [];
  let w = 0;
  let pendingSpace = 0;
  const push = (hard: boolean) => {
    lines.push({ units: cur, w, hard });
    cur = [];
    w = 0;
    pendingSpace = 0;
  };
  for (const u of units) {
    if (u.t === "break") {
      push(true);
      continue;
    }
    if (u.t === "space") {
      if (cur.length) pendingSpace += u.w;
      continue;
    }
    if (u.w > maxW) {
      if (cur.length) push(false);
      const parts = breakLong(u, maxW, measure);
      parts.forEach((part, k) => {
        cur = [part];
        w = (part as { w: number }).w;
        if (k < parts.length - 1) push(false);
      });
      pendingSpace = 0;
      continue;
    }
    if (cur.length && w + pendingSpace + u.w > maxW + 0.01) {
      push(false);
    }
    if (cur.length && pendingSpace) {
      cur.push({ t: "space", w: pendingSpace });
      w += pendingSpace;
    }
    pendingSpace = 0;
    cur.push(u);
    w += u.w;
  }
  push(true);
  return lines;
}

// ---- Pages --------------------------------------------------------------------
class Flow {
  pages: WrittenPage[] = [];
  page!: WrittenPage;
  y = MARGIN_TOP;
  blocks: WrittenBlock[] = [];
  /**
   * `bottom`: where the page's text ends. A column is measured on a page that
   * never ends (Infinity), then placed.
   */
  constructor(private maxPages: number, readonly bottom = PAGE_H - MARGIN_BOTTOM) {
    this.newPage();
  }
  get atTop() {
    return this.y <= MARGIN_TOP + 0.01;
  }
  newPage() {
    if (this.pages.length >= this.maxPages) {
      throw new Error("The document is longer than " + this.maxPages + " pages.");
    }
    this.page = { ops: [] };
    this.pages.push(this.page);
    this.y = MARGIN_TOP;
  }
  /** Starts a new page unless `h` more points fit (or nothing is on this page yet). */
  ensure(h: number) {
    if (this.y + h > this.bottom + 0.01 && !this.atTop) this.newPage();
  }
  space(h: number) {
    if (!this.atTop) this.y += h;
  }
}

type Align = "left" | "center" | "right" | "justify";

function alignOf(format: unknown): Align {
  if (format === "center" || format === 2) return "center";
  if (format === "right" || format === "end" || format === 3) return "right";
  if (format === "justify" || format === 4) return "justify";
  return "left";
}

/** Draws one line with its top at `top` (no page check, no advance). */
function drawLine(flow: Flow, line: Line, left: number, width: number, size: number, align: Align, top: number) {
  const baseline = top + (size * LEAD - size) / 2 + size * 0.8;
  const spaces = line.units.filter((u) => u.t === "space").length;
  const slack = Math.max(0, width - line.w);
  let x = left;
  let extra = 0;
  if (align === "center") x += slack / 2;
  else if (align === "right") x += slack;
  else if (align === "justify" && !line.hard && spaces > 0) extra = slack / spaces;
  for (const u of line.units) {
    if (u.t === "space") {
      x += u.w + extra;
      continue;
    }
    if (u.t !== "word") continue;
    for (const p of u.pieces) {
      if (p.field) {
        inlineField(flow, p, x, baseline);
        x += p.w;
        continue;
      }
      flow.page.ops.push({ kind: "text", x, y: baseline, text: p.text, style: p.style, size: p.size, color: p.color, underline: p.underline || undefined, strike: p.strike || undefined });
      if (p.mark) flow.page.ops.push({ kind: "line", x1: x, y1: baseline + size * 0.22, x2: x + p.w, y2: baseline + size * 0.22, width: Math.max(1.2, size / 8), color: "lilac" });
      if (p.underline) flow.page.ops.push({ kind: "line", x1: x, y1: baseline + size * 0.12, x2: x + p.w, y2: baseline + size * 0.12, width: Math.max(0.5, size / 18), color: p.color });
      if (p.strike) flow.page.ops.push({ kind: "line", x1: x, y1: baseline - size * 0.28, x2: x + p.w, y2: baseline - size * 0.28, width: Math.max(0.5, size / 18), color: p.color });
      x += p.w;
    }
  }
}

function drawLines(flow: Flow, lines: Line[], left: number, width: number, size: number, align: Align, gutter?: (y: number, lead: number) => void, marker?: { text: string; style: Style; w: number }) {
  const lead = size * LEAD;
  lines.forEach((line, i) => {
    flow.ensure(lead);
    const top = flow.y;
    if (i === 0 && marker) {
      const baseline = top + (lead - size) / 2 + size * 0.8;
      flow.page.ops.push({ kind: "text", x: left - marker.w - 6, y: baseline, text: marker.text, style: marker.style, size, color: "ink" });
    }
    drawLine(flow, line, left, width, size, align, top);
    if (gutter) gutter(top, lead);
    flow.y += lead;
  });
}

/** Draws a signer field in the text (a line to write on, or a square) and keeps where it is. */
function inlineField(flow: Flow, p: Piece, x: number, baseline: number) {
  const f = p.field!;
  const size = p.size;
  const ops = flow.page.ops;
  let top: number;
  let h: number;
  if (f.kind === "checkbox") {
    const s = p.w;
    top = baseline - s * 0.92;
    h = s;
    const r = x + s;
    const b = top + s;
    ops.push({ kind: "line", x1: x, y1: top, x2: r, y2: top, width: 0.75, color: "ink" });
    ops.push({ kind: "line", x1: r, y1: top, x2: r, y2: b, width: 0.75, color: "ink" });
    ops.push({ kind: "line", x1: r, y1: b, x2: x, y2: b, width: 0.75, color: "ink" });
    ops.push({ kind: "line", x1: x, y1: b, x2: x, y2: top, width: 0.75, color: "ink" });
  } else {
    h = size * 1.3;
    top = baseline + size * 0.22 - h;
    ops.push({ kind: "line", x1: x, y1: baseline + size * 0.22, x2: x + p.w, y2: baseline + size * 0.22, width: 0.6, color: "muted" });
  }
  flow.blocks.push({
    role_id: f.roleId,
    kind: f.kind,
    page: flow.pages.length - 1,
    x: round3((x / PAGE_W) * 100),
    y: round3((top / PAGE_H) * 100),
    w: round3((p.w / PAGE_W) * 100),
    h: round3((h / PAGE_H) * 100),
    required: f.required,
    ...(f.label ? { label: f.label } : {}),
  });
}

interface Ctx {
  o: LayoutOptions;
  flow: Flow;
  left: number;
  width: number;
  italic: boolean;
  color: Ink;
  quoteBar: number | null;
  /** Body text size: BODY, or smaller with Small text. */
  body: number;
  scale: number;
}

/** A paragraph's lines, where they go, and how they align, without drawing them. */
function layoutParagraph(c: Ctx, n: Node, size: number, base: Style) {
  const inline = new Inline(c.o, size, c.italic ? (base === "bold" ? "boldItalic" : "italic") : base, c.color);
  collectInline(c.o, n.children, inline);
  const units = inline.done();
  const indent = Math.max(0, Math.min(6, Number(n.indent) || 0)) * 24;
  const left = c.left + indent;
  const width = Math.max(40, c.width - indent);
  return { lines: wrapUnits(units, width, c.o.measure), left, width, align: alignOf(n.format) };
}

function paragraph(c: Ctx, n: Node, size: number, base: Style, marker?: { text: string; style: Style; w: number }) {
  const { lines, left, width, align } = layoutParagraph(c, n, size, base);
  const bar = c.quoteBar;
  drawLines(c.flow, lines, left, width, size, align, bar == null ? undefined : (top, lead) => {
    c.flow.page.ops.push({ kind: "line", x1: bar, y1: top, x2: bar, y2: top + lead, width: 2, color: "rule" });
  }, marker);
}

function listItems(c: Ctx, list: Node, depth: number) {
  const numbered = list.listType === "number";
  let n = Number(list.start) || 1;
  for (const item of (list.children ?? []) as Node[]) {
    if (item?.type !== "listitem") continue;
    const kids = (item.children ?? []) as Node[];
    const nested = kids.filter((k) => k?.type === "list");
    const inline = kids.filter((k) => k?.type !== "list");
    const inner: Ctx = { ...c, left: c.left + LIST_INDENT, width: c.width - LIST_INDENT };
    if (inline.length || !nested.length) {
      const text = numbered ? n + "." : list.listType === "check" ? (item.checked ? "[x]" : "[ ]") : BULLET;
      const marker = { text, style: "regular" as Style, w: c.o.measure(text, "regular", c.body) };
      paragraph(inner, { children: inline, format: item.format, indent: 0 }, c.body, "regular", marker);
      c.flow.y += 2;
      n++;
    }
    for (const sub of nested) listItems(inner, sub, depth + 1);
  }
}

function signRow(c: Ctx, row: Node[]) {
  const sizes = row.map((b) => BLOCK_SIZE[String(b.kind ?? "signature")] ?? BLOCK_SIZE.signature);
  const tallest = Math.max(...sizes.map((s) => s.h));
  const total = tallest + 4 + BLOCK_LABEL * 1.6 + BLOCK_AFTER;
  c.flow.space(6);
  c.flow.ensure(total);
  let x = c.left;
  const top = c.flow.y;
  row.forEach((b, i) => {
    const s = sizes[i];
    const fieldTop = top + (tallest - s.h);
    const lineY = top + tallest + 1;
    c.flow.page.ops.push({ kind: "line", x1: x, y1: lineY, x2: x + s.w, y2: lineY, width: 0.75, color: "ink" });
    const role = c.o.roles?.[String(b.roleId)] ?? "Signer";
    const label = (c.o.sanitize ?? ((t: string) => t))(role + " " + MIDDOT + " " + s.label);
    c.flow.page.ops.push({ kind: "text", x, y: lineY + 3 + BLOCK_LABEL, text: label, style: "regular", size: BLOCK_LABEL, color: "muted" });
    c.flow.blocks.push({
      role_id: String(b.roleId),
      kind: String(b.kind ?? "signature"),
      page: c.flow.pages.length - 1,
      x: round3((x / PAGE_W) * 100),
      y: round3((fieldTop / PAGE_H) * 100),
      w: round3((s.w / PAGE_W) * 100),
      h: round3((s.h / PAGE_H) * 100),
    });
    x += s.w + BLOCK_GAP;
  });
  c.flow.y = top + total;
}

/**
 * A callout: its text inside a tinted box with the icon beside the first
 * line. A callout that runs over a page break continues on the next page in
 * a box of its own. The box goes under the text, so it's added last at the
 * place in each page's list where the callout began.
 */
function callout(c: Ctx, n: Node) {
  const flow = c.flow;
  const icon = calloutIcon(n.icon);
  const tone = calloutTone(n.tone);
  const lead = c.body * LEAD;
  flow.space(4);
  flow.ensure(CALLOUT_PAD * 2 + lead);
  const first = flow.pages.length - 1;
  const at = flow.page.ops.length;
  const top = flow.y;
  const shift = icon === "none" ? 0 : CALLOUT_ICON + CALLOUT_GAP;
  const inner: Ctx = { ...c, left: c.left + CALLOUT_PAD + shift, width: c.width - CALLOUT_PAD * 2 - shift };
  flow.y += CALLOUT_PAD;
  if (icon !== "none") {
    const size = CALLOUT_ICON * c.scale;
    flow.page.ops.push({ kind: "icon", x: c.left + CALLOUT_PAD, y: flow.y + (lead - size) / 2, size, icon, tone });
  }
  paragraph(inner, n, c.body, "regular");
  flow.y += CALLOUT_PAD;
  const last = flow.pages.length - 1;
  for (let i = first; i <= last; i++) {
    const y1 = i === first ? top : MARGIN_TOP - CALLOUT_PAD;
    const y2 = i === last ? flow.y : PAGE_H - MARGIN_BOTTOM + CALLOUT_PAD;
    flow.pages[i].ops.splice(i === first ? at : 0, 0, { kind: "box", x: c.left, y: y1, w: c.width, h: y2 - y1, tone });
  }
  flow.y += PARA_AFTER + 2;
}

const CELL_PAD_X = 6;
const CELL_PAD_Y = 4;
const CELL_GAP = 2;
const HEADER_FILL = "#F4F3EF";

type CellLine = { line: Line; left: number; width: number; align: Align; gap: number };
type LaidRow = { header: boolean; cells: CellLine[][] };

/**
 * A table: equal columns across the text width, hairline borders, the header
 * row bold on grey. A row that doesn't fit moves to the next page; one taller
 * than a page carries on there. When a table runs onto a new page its header
 * row is drawn again first. Cells hold paragraphs (anything else prints its
 * text); signer fields inside cells are kept as fields.
 */
function table(c: Ctx, n: Node) {
  const flow = c.flow;
  const lead = c.body * LEAD;
  const rows = ((n.children ?? []) as Node[]).filter((r) => r?.type === "tablerow");
  const cellsOf = (r: Node) => ((r.children ?? []) as Node[]).filter((k) => k?.type === "tablecell");
  const cols = Math.max(1, ...rows.map((r) => cellsOf(r).length));
  if (!rows.length) return;
  const colW = c.width / cols;

  const lay = (r: Node): LaidRow => {
    const cells = cellsOf(r);
    const header = cells.length > 0 && cells.every((k) => (Number(k.headerState) || 0) !== 0);
    return {
      header,
      cells: Array.from({ length: cols }, (_, ci) => {
        const cell = cells[ci];
        if (!cell) return [];
        const inner: Ctx = { ...c, left: c.left + ci * colW + CELL_PAD_X, width: colW - CELL_PAD_X * 2, italic: false, color: "ink", quoteBar: null };
        const out: CellLine[] = [];
        const paras = ((cell.children ?? []) as Node[]).filter(Boolean);
        paras.forEach((p, pi) => {
          const kids = p.type === "paragraph" || Array.isArray(p.children) ? p : { children: [p] };
          const l = layoutParagraph(inner, kids, c.body, (Number(cell.headerState) || 0) !== 0 ? "bold" : "regular");
          l.lines.forEach((line, li) => out.push({ line, left: l.left, width: l.width, align: l.align, gap: pi > 0 && li === 0 ? CELL_GAP : 0 }));
        });
        return out;
      }),
    };
  };

  // Draws a row from `from` (lines already drawn per cell) on this page; returns where each cell got to.
  const drawRow = (row: LaidRow, from: number[]): number[] => {
    const top = flow.y;
    const at = flow.page.ops.length;
    const room = flow.bottom - top - CELL_PAD_Y * 2;
    const next = from.slice();
    let used = 0;
    row.cells.forEach((cell, ci) => {
      let y = top + CELL_PAD_Y;
      while (next[ci] < cell.length) {
        const it = cell[next[ci]];
        if (y - top - CELL_PAD_Y + it.gap + lead > room + 0.01 && y > top + CELL_PAD_Y) break;
        y += it.gap;
        drawLine(flow, it.line, it.left, it.width, c.body, it.align, y);
        y += lead;
        next[ci]++;
      }
      used = Math.max(used, y - top - CELL_PAD_Y);
    });
    const h = Math.max(used, lead) + CELL_PAD_Y * 2;
    const under: Op[] = [];
    if (row.header) under.push({ kind: "rect", x: c.left, y: top, w: c.width, h, fill: HEADER_FILL });
    flow.page.ops.splice(at, 0, ...under);
    const right = c.left + c.width;
    const bottom = top + h;
    flow.page.ops.push({ kind: "line", x1: c.left, y1: top, x2: right, y2: top, width: 0.75, color: "rule" });
    flow.page.ops.push({ kind: "line", x1: c.left, y1: bottom, x2: right, y2: bottom, width: 0.75, color: "rule" });
    for (let i = 0; i <= cols; i++) {
      const x = c.left + i * colW;
      flow.page.ops.push({ kind: "line", x1: x, y1: top, x2: x, y2: bottom, width: 0.75, color: "rule" });
    }
    flow.y = bottom;
    return next;
  };
  const rowHeight = (row: LaidRow) =>
    Math.max(lead, ...row.cells.map((cell) => cell.reduce((s, it) => s + it.gap + lead, 0))) + CELL_PAD_Y * 2;

  const laid = rows.map(lay);
  const head = laid[0].header ? laid[0] : null;
  const headH = head ? rowHeight(head) : 0;
  flow.space(4);
  laid.forEach((row, ri) => {
    let from = row.cells.map(() => 0);
    let first = true;
    while (first || row.cells.some((cell, ci) => from[ci] < cell.length)) {
      const page = flow.pages.length;
      // The whole row if it fits a page, else at least a line of it; the header row keeps the next row with it.
      const want = rowHeight(row) + (row === head && laid[1] ? rowHeight(laid[1]) : 0);
      flow.ensure(Math.min(rowHeight(row), lead + CELL_PAD_Y * 2));
      if (want <= PAGE_H - MARGIN_TOP - MARGIN_BOTTOM) flow.ensure(want);
      else if (rowHeight(row) <= PAGE_H - MARGIN_TOP - MARGIN_BOTTOM) flow.ensure(rowHeight(row));
      // On a new page, the header row again (unless this is the header row, or it can't fit with a line of this row).
      if (head && ri > 0 && (flow.pages.length !== page || !first) && flow.atTop && headH + lead + CELL_PAD_Y * 2 < PAGE_H - MARGIN_TOP - MARGIN_BOTTOM) {
        drawRow(head, head.cells.map(() => 0));
      }
      from = drawRow(row, from);
      first = false;
      if (row.cells.some((cell, ci) => from[ci] < cell.length)) flow.newPage();
    }
  });
  flow.y += PARA_AFTER + 2;
}

const COLUMN_GAP = 24;
const TEXT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;

/** Moves drawing operations down by `dy` points (a column measured on its own page, placed). */
function shiftOp(op: Op, dy: number): Op {
  if (op.kind === "line") return { ...op, y1: op.y1 + dy, y2: op.y2 + dy };
  return { ...op, y: op.y + dy };
}

/**
 * Two columns: each column's blocks laid out at half the width, side by
 * side. The pair stays together: it moves to the next page when it doesn't
 * fit below what's already there, and when a column is taller than a whole
 * page the two print one after the other at full width instead. Signature
 * blocks and signer fields keep their places in the column.
 */
function columns(c: Ctx, n: Node) {
  const flow = c.flow;
  const cols = ((n.children ?? []) as Node[]).filter((k) => k?.type === "gio-column").slice(0, 2);
  if (!cols.length) return;
  const colW = (c.width - COLUMN_GAP) / 2;
  // Each column on a page of its own that never ends, starting at the top margin.
  const laid = cols.map((col, i) => {
    const sub = new Flow(50, Infinity);
    blocksOf({ ...c, flow: sub, left: c.left + i * (colW + COLUMN_GAP), width: colW }, col.children);
    // A page break inside a column (the editor keeps them out) makes it a column that can't sit beside the other.
    return { ops: sub.page.ops, blocks: sub.blocks, h: sub.pages.length > 1 ? Infinity : sub.y - MARGIN_TOP };
  });
  const h = Math.max(...laid.map((l) => l.h));
  if (h > TEXT_H) {
    // Taller than a page: one after the other, at full width.
    for (const col of cols) blocksOf(c, col.children);
    return;
  }
  flow.space(4);
  flow.ensure(h);
  const dy = flow.y - MARGIN_TOP;
  const page = flow.pages.length - 1;
  for (const l of laid) {
    for (const op of l.ops) flow.page.ops.push(shiftOp(op, dy));
    for (const b of l.blocks) flow.blocks.push({ ...b, page, y: round3(b.y + (dy / PAGE_H) * 100) });
  }
  flow.y += h;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function blocksOf(c: Ctx, nodes: Node[] | undefined) {
  const list = (nodes ?? []) as Node[];
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    switch (n?.type) {
      case "heading": {
        const h = HEADING[String(n.tag)] ?? HEADING.h2;
        c.flow.space(h.before);
        c.flow.ensure(h.size * c.scale * LEAD * 2);
        paragraph(c, n, h.size * c.scale, "bold");
        c.flow.y += h.after;
        break;
      }
      case "quote": {
        const inner: Ctx = { ...c, left: c.left + 18, width: c.width - 18, italic: true, color: "muted", quoteBar: c.left + 4 };
        paragraph(inner, n, c.body, "regular");
        c.flow.y += PARA_AFTER;
        break;
      }
      case "gio-callout":
        callout(c, n);
        break;
      case "table":
        table(c, n);
        break;
      case "gio-columns":
        columns(c, n);
        break;
      case "list":
        listItems(c, n, 0);
        c.flow.y += PARA_AFTER - 2;
        break;
      case "horizontalrule":
        c.flow.ensure(18);
        c.flow.page.ops.push({ kind: "line", x1: c.left, y1: c.flow.y + 8, x2: c.left + c.width, y2: c.flow.y + 8, width: 0.75, color: "rule" });
        c.flow.y += 18;
        break;
      case "gio-page-break":
        if (!c.flow.atTop) c.flow.newPage();
        break;
      case "gio-if": {
        const show = c.o.tags ? true : conditionHolds(n.op, c.o.values[String(n.key ?? "")], n.value);
        if (show) blocksOf(c, n.children);
        break;
      }
      case "gio-sign": {
        // Consecutive blocks share a row while they fit.
        const row: Node[] = [n];
        let w = (BLOCK_SIZE[String(n.kind)] ?? BLOCK_SIZE.signature).w;
        while (i + 1 < list.length && list[i + 1]?.type === "gio-sign") {
          const next = BLOCK_SIZE[String(list[i + 1].kind)] ?? BLOCK_SIZE.signature;
          if (w + BLOCK_GAP + next.w > c.width) break;
          w += BLOCK_GAP + next.w;
          row.push(list[++i]);
        }
        signRow(c, row);
        break;
      }
      case "paragraph":
      default:
        if (Array.isArray(n?.children) && n.children.some((k: Node) => ["paragraph", "heading", "list", "quote", "gio-if", "gio-sign"].includes(k?.type))) {
          blocksOf(c, n.children);
          break;
        }
        paragraph(c, n ?? {}, c.body, "regular");
        c.flow.y += PARA_AFTER;
    }
  }
}

/** Lays a written document out on US Letter pages. */
export function layoutWritten(content: Node, o: LayoutOptions): WrittenLayout {
  const flow = new Flow(o.maxPages ?? 200);
  const scale = content?.gio?.small === true ? SMALL_SCALE : 1;
  const c: Ctx = { o, flow, left: MARGIN_X, width: CONTENT_W, italic: false, color: "ink", quoteBar: null, body: BODY * scale, scale };
  blocksOf(c, content?.root?.children);
  const total = flow.pages.length;
  flow.pages.forEach((p, i) => {
    const text = "Page " + (i + 1) + " of " + total;
    const size = 8;
    p.ops.push({ kind: "text", x: (PAGE_W - o.measure(text, "regular", size)) / 2, y: PAGE_H - 36, text, style: "regular", size, color: "muted" });
  });
  return { width: PAGE_W, height: PAGE_H, pages: flow.pages, blocks: flow.blocks };
}

/** Every tag key and condition key a written document uses (for coverage). */
export function writtenKeys(content: Node): { tags: string[]; conditions: string[] } {
  const tags = new Set<string>();
  const conditions = new Set<string>();
  const walk = (n: Node | undefined) => {
    if (!n) return;
    if (n.type === "placeholder" && n.placeholderKey) tags.add(String(n.placeholderKey));
    if (n.type === "gio-if" && n.key) conditions.add(String(n.key));
    for (const k of (n.children ?? []) as Node[]) walk(k);
  };
  walk(content?.root);
  return { tags: [...tags], conditions: [...conditions] };
}
