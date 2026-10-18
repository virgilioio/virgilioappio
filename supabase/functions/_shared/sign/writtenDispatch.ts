// Gio Sign: makes the PDFs of documents written in Gio before an envelope
// goes out (2026-10-17). sign_claim_due holds an envelope until every written
// copy on it has its PDF; this renders them in order with the values frozen
// at send time, stores each next to the envelope and attaches it
// (sign_attach_render moves later pages down and turns signing blocks into
// fields). A failure is kept on the row (sign_render_failed) and retried on the
// next minute, up to MAX_ATTEMPTS; the sender hears about the last one.
// ASCII only.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { renderWritten } from "./written.ts";
import { bell } from "./notify.ts";

const BUCKET = "sign-files";
export const MAX_ATTEMPTS = 5;

async function sha256(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Pending {
  id: string;
  tenant_id: string;
  envelope_id: string;
  position: number;
  name: string;
  // deno-lint-ignore no-explicit-any
  content: Record<string, any>;
  render_attempts: number;
}

/** Renders written copies on envelopes still waiting to go out. */
export async function renderPending(supabase: SupabaseClient, limit = 20) {
  const { data: rows, error } = await supabase
    .from("sign_written_docs")
    .select("id, tenant_id, envelope_id, position, name, content, render_attempts, sign_envelopes!inner(status, deleted_at)")
    .not("envelope_id", "is", null)
    .is("rendered_document_id", null)
    .is("removed_at", null)
    .lt("render_attempts", MAX_ATTEMPTS)
    .in("sign_envelopes.status", ["queued", "scheduled"])
    .is("sign_envelopes.deleted_at", null)
    .order("envelope_id")
    .order("position")
    .limit(limit);
  if (error) throw error;

  const byEnvelope = new Map<string, Pending[]>();
  for (const r of (rows ?? []) as unknown as Pending[]) {
    const list = byEnvelope.get(r.envelope_id) ?? [];
    list.push(r);
    byEnvelope.set(r.envelope_id, list);
  }

  let rendered = 0;
  let failed = 0;
  for (const [envelopeId, docs] of byEnvelope) {
    const { data: e } = await supabase.from("sign_envelopes").select("*").eq("id", envelopeId).maybeSingle();
    if (!e) continue;
    const { data: people } = await supabase
      .from("sign_recipients")
      .select("template_role_id, label")
      .eq("envelope_id", envelopeId)
      .is("removed_at", null);
    const roles: Record<string, string> = {};
    for (const p of people ?? []) if (p.template_role_id) roles[p.template_role_id] = p.label ?? "Signer";
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries((e.data_snapshot ?? {}) as Record<string, unknown>)) {
      if (v != null) values[k] = String(v);
    }

    // In order: a later document's pages depend on the earlier ones.
    for (const w of docs) {
      try {
        const pdf = await renderWritten({ name: w.name, content: w.content, values, roles });
        const path = `${w.tenant_id}/envelopes/${envelopeId}/written-${w.id}.pdf`;
        const up = await supabase.storage.from(BUCKET).upload(path, pdf.bytes, { contentType: "application/pdf", upsert: true });
        if (up.error) throw up.error;
        const { error: aErr } = await supabase.rpc("sign_attach_render", {
          _written_id: w.id,
          _storage_path: path,
          _page_count: pdf.pageCount,
          _page_sizes: pdf.pageSizes,
          _size_bytes: pdf.bytes.length,
          _sha256: await sha256(pdf.bytes),
          _blocks: pdf.blocks,
        });
        if (aErr) throw aErr;
        rendered++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
        console.error("sign written render", w.id, msg);
        await supabase.rpc("sign_render_failed", { _written_id: w.id, _error: msg });
        if (w.render_attempts + 1 >= MAX_ATTEMPTS) {
          await bell(supabase, e, {
            title: `Couldn't make "${w.name}"`,
            preview: "The agreement hasn't gone out. Open the template, check the document and send it again.",
            event: "render_failed",
          });
        }
        break;
      }
    }
  }
  return { rendered, render_failed: failed };
}
