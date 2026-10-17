// Gio Sign: how a value fits the box it was placed in (2026-10-17). Shared by
// the sealed PDF (stamp.ts) and the app's previews (FilledPreview, the signing
// page), so what people see before signing is what gets printed.
//
// The text keeps its own line breaks and wraps at word boundaries. It starts
// at the chosen size (or the box's automatic size) and shrinks in half points
// down to 6 pt until every line fits the box; if it still doesn't, the last
// line that fits ends with an ellipsis. A value that fits on one line lays out
// exactly as before (one line, centred in the box). Pure, ASCII only.

export const LINE_HEIGHT = 1.2;
export const MIN_SIZE = 6;
const ELLIPSIS = String.fromCharCode(8230);

export interface TextLayout {
  /** Points. */
  size: number;
  lines: string[];
  /** The text didn't fit even at the smallest size and was cut. */
  cut: boolean;
}

/** Width of `text` at `size` points, in points. */
export type Measure = (text: string, size: number) => number;

/** The size a box prints at when no size was chosen: from its height, at most 11 pt. */
export function autoSize(boxH: number): number {
  return Math.min(11, Math.max(MIN_SIZE, boxH * 0.62));
}

function breakWord(word: string, size: number, w: number, measure: Measure): string[] {
  const out: string[] = [];
  let cur = "";
  for (const ch of word) {
    if (cur && measure(cur + ch, size) > w) {
      out.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Greedy word wrap of each paragraph at one size. */
export function wrapAt(text: string, size: number, w: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(" ").filter((x) => x.length > 0);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let cur = "";
    for (const word of words) {
      const next = cur ? cur + " " + word : word;
      if (measure(next, size) <= w) {
        cur = next;
        continue;
      }
      if (cur) lines.push(cur);
      if (measure(word, size) <= w) {
        cur = word;
      } else {
        const parts = breakWord(word, size, w, measure);
        cur = parts.pop() ?? "";
        lines.push(...parts);
      }
    }
    lines.push(cur);
  }
  // Blank lines at the end print nothing; leave them out.
  while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Lays `raw` out inside a w x h box (points). */
export function layoutText(raw: string, w: number, h: number, measure: Measure, chosen?: number | null): TextLayout {
  const text = String(raw ?? "").replace(/\r\n?/g, "\n").replace(/\t/g, " ").replace(/[ ]+\n/g, "\n").trim();
  const start = chosen && chosen >= MIN_SIZE ? chosen : autoSize(h);
  let size = start;
  for (;;) {
    const lines = wrapAt(text, size, w, measure);
    const fitsHeight = lines.length === 1 || lines.length * size * LINE_HEIGHT <= h + 0.01;
    const fitsWidth = lines.length > 1 || measure(lines[0], size) <= w;
    if (fitsHeight && fitsWidth) return { size, lines, cut: false };
    if (size - 0.5 < MIN_SIZE) break;
    size -= 0.5;
  }
  // Smallest size and still too much: keep the lines that fit, end with an ellipsis.
  size = MIN_SIZE;
  const all = wrapAt(text, size, w, measure);
  const room = Math.max(1, Math.floor((h + 0.01) / (size * LINE_HEIGHT)));
  const lines = all.slice(0, room);
  let last = lines[lines.length - 1] ?? "";
  if (all.length > room || measure(last, size) > w) {
    while (last.length > 0 && measure(last + ELLIPSIS, size) > w) last = last.slice(0, -1);
    lines[lines.length - 1] = last.replace(/\s+$/, "") + ELLIPSIS;
  }
  return { size, lines, cut: true };
}
