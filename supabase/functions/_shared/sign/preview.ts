// Gio Sign: what a template becomes once it's filled in with a record's
// values, as one PDF (2026-10-19), for senders who can't draw the template in
// their own browser (Gio Sales, through sign-gateway). Every document in the
// order it's signed: uploaded PDFs with their data fields written in where
// they were placed (the code sign-seal uses), written documents made by the
// renderer sign-dispatch uses. Values from the record are underlined in lilac
// and empty ones print as [Label], as in the ATS send sheet's Preview; signer
// fields are marked in their role's colour. ASCII only.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";
import { drawCheck, fitText, safe } from "./stamp.ts";
import { renderWritten } from "./written.ts";

const BUCKET = "sign-files";
const INK = rgb(13 / 255, 13 / 255, 9 / 255);
const LILAC = rgb(0.843, 0.773, 0.984);
const FIELD_WORD: Record<string, string> = {
  signature: "signs here",
  initials: "initials",
  date: "date signed",
  name: "full name",
  email: "email",
  text: "text",
  checkbox: "checkbox",
};

function rgbOf(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ""));
  const n = m ? parseInt(m[1], 16) : 0x9ca3af;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export interface PreviewDoc {
  name: string;
  pages: number;
}

/**
 * The filled template as one PDF. `values` are the record's values by key
 * (a formatted one as "key|format"); `labels` name each key for [Label].
 */
export async function previewTemplate(
  db: SupabaseClient,
  templateId: string,
  values: Record<string, string>,
  labels: Record<string, string>,
): Promise<{ bytes: Uint8Array; pages: number; documents: PreviewDoc[] }> {
  const [{ data: docs, error: dErr }, { data: written, error: wErr }, { data: roles }, { data: fields }] = await Promise.all([
    db.from("sign_documents").select("name, storage_path, page_count, position").eq("template_id", templateId).is("envelope_id", null).is("removed_at", null).order("position"),
    db.from("sign_written_docs").select("name, content, position").eq("template_id", templateId).is("envelope_id", null).is("removed_at", null).order("position"),
    db.from("sign_recipients").select("id, label, color").eq("template_id", templateId).is("envelope_id", null).is("removed_at", null),
    db.from("sign_fields").select("type, recipient_id, page, x, y, w, h, data_key, font_size, data_style, data_format").eq("template_id", templateId).is("envelope_id", null).is("removed_at", null),
  ]);
  if (dErr) throw dErr;
  if (wErr) throw wErr;

  // The same order the envelope gets: by position, an upload before a written document on a tie.
  type Item = { kind: "upload"; position: number; doc: any } | { kind: "written"; position: number; doc: any };
  const items: Item[] = [
    ...(docs ?? []).map((doc: any, i: number) => ({ kind: "upload" as const, position: doc.position ?? i, doc })),
    ...(written ?? []).map((doc: any) => ({ kind: "written" as const, position: doc.position, doc })),
  ].sort((a, b) => a.position - b.position || (a.kind === "upload" ? -1 : 1));

  const roleLabel: Record<string, string> = {};
  const roleColor: Record<string, string> = {};
  for (const r of roles ?? []) {
    roleLabel[r.id] = r.label || "Signer";
    roleColor[r.id] = r.color;
  }

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  out.setProducer("Gio Sign");
  out.setCreator("Gio Sign");
  const documents: PreviewDoc[] = [];
  let uploadPage = 0; // template fields count pages across uploaded documents only

  for (const item of items) {
    if (item.kind === "written") {
      const pdf = await renderWritten({ name: item.doc.name, content: item.doc.content, values, roles: roleLabel, highlight: labels });
      const src = await PDFDocument.load(pdf.bytes);
      for (const pg of await out.copyPages(src, src.getPageIndices())) out.addPage(pg);
      documents.push({ name: item.doc.name, pages: pdf.pageCount });
      continue;
    }
    const file = await db.storage.from(BUCKET).download(item.doc.storage_path);
    if (file.error || !file.data) throw new Error(`${item.doc.name} couldn't be read.`);
    const src = await PDFDocument.load(new Uint8Array(await file.data.arrayBuffer()), { updateMetadata: false });
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((pg, i) => {
      const page = out.addPage(pg);
      const gi = uploadPage + i;
      const box = page.getCropBox();
      for (const f of (fields ?? []).filter((x: any) => x.page === gi)) {
        const x = box.x + (Number(f.x) / 100) * box.width;
        const w = (Number(f.w) / 100) * box.width;
        const h = (Number(f.h) / 100) * box.height;
        const y = box.y + box.height - (Number(f.y) / 100) * box.height - h;
        if (f.type === "data") {
          const key = String(f.data_key ?? "");
          const v = (f.data_format ? values[`${key}|${f.data_format}`] : undefined) ?? values[key] ?? "";
          if (f.data_style === "tick") {
            if (v === "Yes") drawCheck(page, x, y, w, h);
            continue;
          }
          fitText(page, font, v || `[${labels[key] ?? key}]`, x, y, w, h, f.font_size == null ? null : Number(f.font_size));
          if (v) page.drawLine({ start: { x, y: y + 0.5 }, end: { x: x + w, y: y + 0.5 }, thickness: 1.5, color: LILAC });
          continue;
        }
        const c = rgbOf(roleColor[f.recipient_id] ?? "#9CA3AF");
        page.drawRectangle({ x, y, width: w, height: h, color: c, opacity: 0.28, borderColor: c, borderWidth: 0.75, borderOpacity: 0.9 });
        const label = safe(font, `${roleLabel[f.recipient_id] ?? "Signer"} ${FIELD_WORD[f.type] ?? f.type}`);
        const size = Math.max(5, Math.min(9, h * 0.45));
        let text = label;
        while (text.length > 1 && font.widthOfTextAtSize(text, size) > w - 4) text = text.slice(0, -2) + ".";
        page.drawText(text, { x: x + 2, y: y + (h - size * 0.72) / 2, size, font, color: INK });
      }
    });
    uploadPage += copied.length;
    documents.push({ name: item.doc.name, pages: copied.length });
  }

  if (!documents.length) throw new Error("This template has no documents.");
  out.setTitle(documents.map((d) => d.name).join(", ").slice(0, 200));
  const bytes = await out.save();
  return { bytes, pages: out.getPageCount(), documents };
}
