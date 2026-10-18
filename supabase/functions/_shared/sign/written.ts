// Gio Sign: draws a document written in Gio as a PDF (2026-10-17). Layout is
// writtenLayout.ts (shared with the app); this file only measures text with
// the PDF's own fonts and draws the result. Text stays real text. ASCII only.

import { LineCapStyle, PDFDocument, PDFFont, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";
import { CALLOUT_ICONS, CALLOUT_TONES, layoutWritten, type Style, type WrittenBlock } from "./writtenLayout.ts";

export interface WrittenPdf {
  bytes: Uint8Array;
  pageCount: number;
  pageSizes: { w: number; h: number }[];
  blocks: WrittenBlock[];
}

export interface WrittenInput {
  name: string;
  // deno-lint-ignore no-explicit-any
  content: Record<string, any>;
  values: Record<string, string | null | undefined>;
  roles?: Record<string, string>;
  /** Template preview with no record: tags print as [Label]. */
  tags?: Record<string, string> | null;
  /** Send-sheet preview: values underlined in lilac, empty ones as [Label] (labels by key). */
  highlight?: Record<string, string> | null;
  /** With highlight: empty values' [Label] in red (the template editor's preview). */
  emptyRed?: boolean;
}

const COLORS = {
  ink: rgb(0.051, 0.051, 0.035),
  muted: rgb(0.42, 0.44, 0.5),
  rule: rgb(0.8, 0.8, 0.78),
  lilac: rgb(0.843, 0.773, 0.984),
  danger: rgb(0.761, 0.216, 0.169),
};

function hex(h: string) {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** A rectangle with 4pt corners as an SVG path, in page coordinates from the top-left. */
function roundRect(x: number, y: number, w: number, h: number, r = 4) {
  return "M" + (x + r) + " " + y + "h" + (w - 2 * r) + "a" + r + " " + r + " 0 0 1 " + r + " " + r + "v" + (h - 2 * r) +
    "a" + r + " " + r + " 0 0 1 -" + r + " " + r + "h-" + (w - 2 * r) + "a" + r + " " + r + " 0 0 1 -" + r + " -" + r +
    "v-" + (h - 2 * r) + "a" + r + " " + r + " 0 0 1 " + r + " -" + r + "z";
}

// Characters the standard fonts can't print, mapped to ones they can.
const FALLBACK: Record<string, string> = {
  "\u2192": "->",
  "\u2190": "<-",
  "\u2264": "<=",
  "\u2265": ">=",
  "\u00a0": " ",
  "\u202f": " ",
  "\u2009": " ",
  "\u2212": "-",
  "\u2713": "x",
  "\u2714": "x",
  "\u0141": "L",
  "\u0142": "l",
  "\u0110": "D",
  "\u0111": "d",
  "\u0126": "H",
  "\u0127": "h",
  "\u0131": "i",
};

export async function renderWritten(input: WrittenInput): Promise<WrittenPdf> {
  const pdf = await PDFDocument.create();
  const fonts: Record<Style, PDFFont> = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const ok = new Map<string, boolean>();
  const printable = (ch: string) => {
    let v = ok.get(ch);
    if (v === undefined) {
      try {
        fonts.regular.encodeText(ch);
        v = true;
      } catch {
        v = false;
      }
      ok.set(ch, v);
    }
    return v;
  };
  const sanitize = (text: string) => {
    let out = "";
    for (const ch of text) {
      if (ch === "\n" || printable(ch)) out += ch;
      else if (FALLBACK[ch] !== undefined) out += FALLBACK[ch];
      else {
        // A letter with an accent the font lacks prints without the accent.
        const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        out += base && base !== ch && [...base].every(printable) ? base : "?";
      }
    }
    return out;
  };

  const layout = layoutWritten(input.content, {
    values: input.values,
    roles: input.roles,
    tags: input.tags ?? null,
    highlight: input.highlight ?? null,
    emptyInk: input.emptyRed ? "danger" : "muted",
    sanitize,
    measure: (text, style, size) => fonts[style].widthOfTextAtSize(text, size),
  });

  for (const p of layout.pages) {
    const page = pdf.addPage([layout.width, layout.height]);
    for (const op of p.ops) {
      if (op.kind === "text") {
        if (!op.text) continue;
        page.drawText(op.text, { x: op.x, y: layout.height - op.y, size: op.size, font: fonts[op.style], color: COLORS[op.color] });
      } else if (op.kind === "box") {
        const t = CALLOUT_TONES[op.tone];
        page.drawSvgPath(roundRect(op.x, op.y, op.w, op.h), { x: 0, y: layout.height, color: hex(t.bg), borderColor: hex(t.ring), borderWidth: 0.75 });
      } else if (op.kind === "icon") {
        const ink = hex(CALLOUT_TONES[op.tone].ink);
        const scale = op.size / 24;
        for (const d of CALLOUT_ICONS[op.icon].paths) {
          page.drawSvgPath(d, { x: op.x, y: layout.height - op.y, scale, borderColor: ink, borderWidth: 2, borderLineCap: LineCapStyle.Round });
        }
      } else {
        page.drawLine({
          start: { x: op.x1, y: layout.height - op.y1 },
          end: { x: op.x2, y: layout.height - op.y2 },
          thickness: op.width,
          color: COLORS[op.color],
        });
      }
    }
  }
  pdf.setTitle(sanitize(input.name));
  pdf.setProducer("Gio Sign");
  pdf.setCreator("Gio Sign");
  const bytes = await pdf.save();
  return {
    bytes,
    pageCount: layout.pages.length,
    pageSizes: layout.pages.map(() => ({ w: layout.width, h: layout.height })),
    blocks: layout.blocks,
  };
}
