// Gio Sign: draws a document written in Gio as a PDF (2026-10-17). Layout is
// writtenLayout.ts (shared with the app); this file only measures text with
// the PDF's own fonts and draws the result. Text stays real text. ASCII only.

import { PDFDocument, PDFFont, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";
import { layoutWritten, type Style, type WrittenBlock } from "./writtenLayout.ts";

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
