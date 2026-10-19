// Gio Sign: the finished PDF. Joins the envelope's documents, writes every
// filled field where it was placed, draws the adopted signatures, and appends
// the certificate of completion. Text stays real text (pdf-lib), nothing is
// rasterised. ASCII only.

import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";
import { layoutText, LINE_HEIGHT } from "./wrap.ts";

export interface StampDoc {
  name: string;
  bytes: Uint8Array;
  sha256: string | null;
  pages: number;
}
export interface StampField {
  type: string;
  page: number; // across all documents, from 0
  x: number; // % of the page, from the top-left
  y: number;
  w: number;
  h: number;
  value: string | null;
  recipient_id: string | null;
  /** Points; null prints at the automatic size (from the height, at most 11 pt). */
  font_size?: number | null;
  /** Data fields: "tick" prints a tick for Yes and nothing otherwise. */
  data_style?: string | null;
}
export interface StampPerson {
  id: string;
  position: number;
  role: string; // signer | approver | cc
  label: string | null;
  name: string;
  email: string;
  status: string;
  consent_at: string | null;
  verified_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  approved_at: string | null;
  signed_ip: string | null;
  signed_user_agent: string | null;
  signature?: { kind: string; full_name: string; image: Uint8Array | null; initials_image: Uint8Array | null } | null;
}
export interface StampEvent {
  created_at: string;
  label: string;
  actor_name: string | null;
  ip: string | null;
}
export interface StampEnvelope {
  public_id: string;
  title: string;
  sender_name: string;
  sender_email: string;
  sent_at: string | null;
  completed_at: string | null;
  brand: string;
}

const INK = rgb(13 / 255, 13 / 255, 9 / 255);
const MUTED = rgb(90 / 255, 96 / 255, 114 / 255);
const FAINT = rgb(107 / 255, 112 / 255, 128 / 255);
const LINE = rgb(231 / 255, 232 / 255, 238 / 255);
const PURPLE = rgb(111 / 255, 63 / 255, 245 / 255);
const GREEN = rgb(22 / 255, 112 / 255, 74 / 255);

const TZ = "America/Mexico_City";
export function when(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(d);
  return `${s} CST`;
}

/** Keeps only what the standard font can draw; anything else becomes "?". */
export function safe(font: PDFFont, text: string, keepLines = false) {
  let out = "";
  const src = keepLines
    ? String(text ?? "").replace(/\r\n?/g, "\n").replace(/\t/g, " ")
    : String(text ?? "").replace(/[\r\n\t]+/g, " ");
  for (const ch of src) {
    if (ch === "\n") {
      out += ch;
      continue;
    }
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

/**
 * Writes a value inside its box: one line centred as before, or wrapped over
 * as many lines as fit, from the top (layout shared with the app's previews).
 */
export function fitText(page: PDFPage, font: PDFFont, raw: string, x: number, y: number, w: number, h: number, chosen?: number | null) {
  const text = safe(font, raw, true);
  const { size, lines } = layoutText(text, w - 2, h, (s, z) => font.widthOfTextAtSize(s, z), chosen);
  if (lines.length === 1) {
    page.drawText(lines[0], { x: x + 1, y: y + (h - size * 0.72) / 2, size, font, color: INK });
    return;
  }
  const lead = size * LINE_HEIGHT;
  lines.forEach((line, i) => {
    if (line) page.drawText(line, { x: x + 1, y: y + h - (lead - size) / 2 - size * 0.8 - i * lead, size, font, color: INK });
  });
}

export function drawCheck(page: PDFPage, x: number, y: number, w: number, h: number) {
  const s = Math.min(w, h) * 0.8;
  const cx = x + w / 2 - s / 2;
  const cy = y + h / 2 - s / 2;
  page.drawLine({ start: { x: cx + s * 0.1, y: cy + s * 0.5 }, end: { x: cx + s * 0.4, y: cy + s * 0.18 }, thickness: Math.max(1, s * 0.12), color: INK });
  page.drawLine({ start: { x: cx + s * 0.4, y: cy + s * 0.18 }, end: { x: cx + s * 0.92, y: cy + s * 0.85 }, thickness: Math.max(1, s * 0.12), color: INK });
}

function drawImageIn(page: PDFPage, img: PDFImage, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / img.width, h / img.height);
  const iw = img.width * scale;
  const ih = img.height * scale;
  page.drawImage(img, { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih });
}

/** The documents with every field written in, then the certificate of completion. */
export async function stampEnvelope(
  env: StampEnvelope,
  docs: StampDoc[],
  fields: StampField[],
  people: StampPerson[],
  events: StampEvent[],
  logoPng: Uint8Array | null,
): Promise<{ pdf: Uint8Array; certificate: Uint8Array }> {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  out.setTitle(env.title);
  out.setAuthor(env.sender_name);
  out.setCreator("Gio Sign");
  out.setProducer("Gio Sign");
  out.setSubject(`Envelope ${env.public_id}`);

  const images = new Map<string, { sig: PDFImage | null; ini: PDFImage | null }>();
  for (const p of people) {
    if (!p.signature) continue;
    images.set(p.id, {
      sig: p.signature.image ? await out.embedPng(p.signature.image) : null,
      ini: p.signature.initials_image ? await out.embedPng(p.signature.initials_image) : null,
    });
  }

  const pages: PDFPage[] = [];
  for (const d of docs) {
    const src = await PDFDocument.load(d.bytes, { ignoreEncryption: false, updateMetadata: false });
    const copied = await out.copyPages(src, src.getPageIndices());
    for (const pg of copied) pages.push(out.addPage(pg));
  }

  for (const f of fields) {
    const page = pages[f.page];
    if (!page || !f.value) continue;
    const box = page.getCropBox();
    const x = box.x + (f.x / 100) * box.width;
    const w = (f.w / 100) * box.width;
    const h = (f.h / 100) * box.height;
    const y = box.y + box.height - (f.y / 100) * box.height - h;
    if (f.type === "signature" || f.type === "initials") {
      const im = f.recipient_id ? images.get(f.recipient_id) : undefined;
      const img = f.type === "initials" ? im?.ini ?? im?.sig : im?.sig;
      if (img) {
        const label = f.type === "signature" ? 6 : 0;
        drawImageIn(page, img, x, y + label, w, h - label);
        if (label) page.drawText(safe(font, `Gio Sign ${String.fromCharCode(183)} ${env.public_id}`), { x: x + 1, y: y, size: 5.5, font, color: PURPLE });
      }
    } else if (f.type === "checkbox") {
      if (f.value === "true") drawCheck(page, x, y, w, h);
    } else if (f.type === "data" && f.data_style === "tick") {
      if (f.value === "Yes") drawCheck(page, x, y, w, h);
    } else {
      fitText(page, font, f.value, x, y, w, h, f.font_size == null ? null : Number(f.font_size));
    }
  }

  // The certificate, built once and appended to both files.
  const cert = await PDFDocument.create();
  cert.setTitle(`Certificate of completion ${String.fromCharCode(183)} ${env.title}`);
  cert.setCreator("Gio Sign");
  cert.setProducer("Gio Sign");
  await drawCertificate(cert, env, docs, people, events, logoPng);
  const certBytes = await cert.save();

  const certSrc = await PDFDocument.load(certBytes);
  for (const pg of await out.copyPages(certSrc, certSrc.getPageIndices())) out.addPage(pg);
  void bold;
  return { pdf: await out.save({ useObjectStreams: false }), certificate: certBytes };
}

/* ------------------------------------------------------------ certificate */

async function drawCertificate(
  doc: PDFDocument,
  env: StampEnvelope,
  docs: StampDoc[],
  people: StampPerson[],
  events: StampEvent[],
  logoPng: Uint8Array | null,
) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = logoPng ? await doc.embedPng(logoPng).catch(() => null) : null;
  const W = 612;
  const H = 792;
  const M = 48;
  let page = doc.addPage([W, H]);
  let y = H - M;
  let pageNo = 1;

  const footer = () => {
    page.drawLine({ start: { x: M, y: 40 }, end: { x: W - M, y: 40 }, thickness: 0.5, color: LINE });
    page.drawText(safe(font, `Envelope ${env.public_id}`), { x: M, y: 28, size: 7.5, font, color: FAINT });
    const t = `Certificate of completion ${String.fromCharCode(183)} page ${pageNo}`;
    page.drawText(t, { x: W - M - font.widthOfTextAtSize(t, 7.5), y: 28, size: 7.5, font, color: FAINT });
  };
  const need = (h: number) => {
    if (y - h < 56) {
      footer();
      page = doc.addPage([W, H]);
      pageNo++;
      y = H - M;
    }
  };
  const text = (s: string, o: { x?: number; size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; w?: number } = {}) => {
    const size = o.size ?? 9;
    const f = o.f ?? font;
    let t = safe(f, s);
    const maxW = o.w ?? W - M - (o.x ?? M);
    while (t.length > 1 && f.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -2) + String.fromCharCode(8230);
    page.drawText(t, { x: o.x ?? M, y, size, font: f, color: o.color ?? INK });
  };
  const section = (title: string) => {
    need(40);
    y -= 14;
    text(title.toUpperCase(), { size: 7.5, f: bold, color: FAINT });
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LINE });
    y -= 14;
  };
  const row = (label: string, value: string) => {
    need(14);
    text(label, { size: 8.5, color: FAINT, w: 120 });
    text(value, { x: M + 130, size: 8.5 });
    y -= 13;
  };

  // Masthead
  if (logo) {
    const s = 26 / logo.height;
    page.drawImage(logo, { x: M, y: y - 26, width: logo.width * s, height: 26 });
  } else {
    text("Gio Sign", { size: 14, f: bold });
  }
  y -= 58;
  text("Certificate of completion", { size: 22, f: bold });
  y -= 20;
  text(env.title, { size: 11, color: MUTED });
  y -= 22;
  page.drawRectangle({ x: M, y: y - 6, width: 74, height: 16, color: rgb(227 / 255, 243 / 255, 234 / 255) });
  text("COMPLETED", { x: M + 9, size: 7.5, f: bold, color: GREEN });
  y -= 22;

  section("Envelope");
  row("Envelope ID", env.public_id);
  row("Sent by", `${env.sender_name} <${env.sender_email}>`);
  row("On behalf of", env.brand);
  row("Sent", when(env.sent_at));
  row("Completed", when(env.completed_at));
  row("Signing method", "Electronic signature, email one-time code");

  section("Documents");
  for (const d of docs) {
    need(26);
    text(d.name, { size: 9, f: bold });
    text(`${d.pages} page${d.pages === 1 ? "" : "s"}`, { x: W - M - 60, size: 8.5, color: MUTED, w: 60 });
    y -= 12;
    text(`SHA-256 of the original: ${d.sha256 ?? "not recorded"}`, { size: 7, color: FAINT });
    y -= 15;
  }

  section("People");
  const roleName = (r: string) => (r === "approver" ? "Approver" : r === "cc" ? "Receives a copy" : "Signer");
  for (const p of [...people].sort((a, b) => a.position - b.position)) {
    const done = p.signed_at ?? p.approved_at;
    need(p.role === "cc" ? 40 : 96);
    text(p.name, { size: 10, f: bold, w: 300 });
    text(roleName(p.role) + (p.label ? ` ${String.fromCharCode(183)} ${p.label}` : ""), { x: W - M - 160, size: 8.5, color: MUTED, w: 160 });
    y -= 12;
    text(p.email, { size: 8.5, color: MUTED });
    y -= 14;
    if (p.role !== "cc") {
      const sigImg = p.signature?.image ? await doc.embedPng(p.signature.image).catch(() => null) : null;
      const top = y;
      if (sigImg) {
        page.drawRectangle({ x: M, y: top - 44, width: 150, height: 48, borderColor: LINE, borderWidth: 0.5 });
        drawImageIn(page, sigImg, M + 6, top - 40, 138, 40);
      }
      const colX = M + 166;
      const line = (l: string, v: string) => {
        text(l, { x: colX, size: 7.5, color: FAINT, w: 90 });
        text(v || String.fromCharCode(8212), { x: colX + 92, size: 7.5, w: W - M - colX - 92 });
        y -= 10.5;
      };
      line(p.role === "approver" ? "Approved" : "Signed", when(done));
      line("Consented", when(p.consent_at));
      line("Code verified", when(p.verified_at));
      line("First opened", when(p.viewed_at));
      line("IP address", p.signed_ip ?? "");
      line("Browser", (p.signed_user_agent ?? "").slice(0, 120));
      if (p.signature) line("Signature", p.signature.kind === "type" ? "Typed" : p.signature.kind === "draw" ? "Drawn" : "Uploaded image");
      y = Math.min(y, top - 50);
    }
    y -= 10;
  }

  section("History");
  for (const e of events) {
    need(12);
    text(when(e.created_at), { size: 7.5, color: FAINT, w: 140 });
    text(e.label, { x: M + 140, size: 7.5, w: 250 });
    text(e.ip ?? "", { x: W - M - 110, size: 7.5, color: FAINT, w: 110 });
    y -= 11;
  }

  need(44);
  y -= 10;
  const note = [
    "This file is sealed by Gio Sign with a digital signature and an RFC 3161 timestamp.",
    "Any change to it after sealing breaks the seal; a PDF reader's signature panel shows whether it is intact.",
    `Times are Mexico City time (${TZ}).`,
  ];
  for (const n of note) {
    text(n, { size: 7.5, color: MUTED });
    y -= 10.5;
  }
  footer();
}
