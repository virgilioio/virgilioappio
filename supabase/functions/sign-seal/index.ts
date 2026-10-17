// Gio Sign: sealing (x-internal-secret). Called by sign-submit right after the
// last signature ({ envelope_id }) and every two minutes by pg_cron ({}).
// For each completed, unsealed envelope: writes the fields and signatures into
// the documents, adds the certificate of completion, seals both files (PAdES
// with an RFC 3161 timestamp), stores them, then emails them to everyone on
// the envelope and, for an offer, puts a copy in the candidate's files.
// ASCII only.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { adminClient, json } from "../_shared/sign/signer.ts";
import { appBase } from "../_shared/referenceTokens.ts";
import { httpTsa, makeTestIdentity, pemSigner, sealPdf, sha256, hex, type Signer, type Tsa } from "../_shared/sign/pades.ts";
import { stampEnvelope, type StampPerson } from "../_shared/sign/stamp.ts";
import { sendMail, signedCopyEmail } from "../_shared/sign/emails.ts";
import { bell, brandOf, people, recordUrl } from "../_shared/sign/notify.ts";

const BUCKET = "sign-files";
const TSAS = (Deno.env.get("SIGN_TSA_URLS") || "http://timestamp.digicert.com,https://freetsa.org/tsr")
  .split(",").map((s) => s.trim()).filter(Boolean);

/** The first timestamp authority that answers. */
const tsa: Tsa = async (req) => {
  let last: unknown = null;
  for (const url of TSAS) {
    try {
      return await httpTsa(url)(req);
    } catch (err) {
      last = err;
      console.error("sign-seal tsa", url, err instanceof Error ? err.message : err);
    }
  }
  throw last ?? new Error("tsa_none");
};

/** The test identity, made once and kept in Vault. */
async function signer(supabase: SupabaseClient): Promise<Signer> {
  const read = async () => {
    const { data, error } = await supabase.rpc("sign_seal_identity");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row?.key_pem && row?.cert_pem ? (row as { key_pem: string; cert_pem: string }) : null;
  };
  let id = await read();
  if (!id) {
    const made = await makeTestIdentity();
    const { error } = await supabase.rpc("sign_seal_identity_save", { _key_pem: made.keyPem, _cert_pem: made.certPem });
    if (error) throw error;
    id = await read();
    if (!id) throw new Error("identity_missing");
  }
  return await pemSigner(id.key_pem, id.cert_pem, "Gio Sign (test)");
}

async function download(supabase: SupabaseClient, bucket: string, path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`download_failed:${path.split("/").pop()}`);
  return new Uint8Array(await data.arrayBuffer());
}

function b64(u: Uint8Array) {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

const fileSafe = (s: string) => String(s || "Agreement").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) || "Agreement";

async function logo(): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`${appBase()}/gio-sign-logo.png`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function sealOne(supabase: SupabaseClient, id: string, sign: Signer, logoPng: Uint8Array | null) {
  const { data: e, error: eErr } = await supabase.from("sign_envelopes").select("*").eq("id", id).maybeSingle();
  if (eErr || !e) throw new Error("envelope_missing");
  const brand = await brandOf(supabase, e.tenant_id);

  const [{ data: docs }, { data: fields }, { data: recips }, { data: events }] = await Promise.all([
    supabase.from("sign_documents").select("name, storage_path, page_count, sha256, position").eq("envelope_id", id).is("removed_at", null).order("position"),
    supabase.from("sign_fields").select("type, page, x, y, w, h, value, recipient_id, font_size, data_style").eq("envelope_id", id).is("removed_at", null),
    supabase.from("sign_recipients").select("*").eq("envelope_id", id).is("removed_at", null).order("position"),
    supabase.from("sign_events").select("created_at, label, actor_name, ip").eq("envelope_id", id).order("created_at"),
  ]);
  if (!docs?.length) throw new Error("no_documents");
  const ids = (recips ?? []).map((r: any) => r.id);
  const { data: signatures } = await supabase.from("sign_signatures").select("*").in("recipient_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const stampDocs = [];
  for (const d of docs) {
    stampDocs.push({ name: d.name, bytes: await download(supabase, BUCKET, d.storage_path), sha256: d.sha256, pages: d.page_count });
  }
  const persons: StampPerson[] = [];
  for (const r of recips ?? []) {
    const s = (signatures ?? []).find((x: any) => x.recipient_id === r.id);
    persons.push({
      ...r,
      signed_ip: r.signed_ip ? String(r.signed_ip) : null,
      signature: s
        ? {
          kind: s.kind,
          full_name: s.full_name,
          image: s.image_path ? await download(supabase, BUCKET, s.image_path) : null,
          initials_image: s.initials_image_path ? await download(supabase, BUCKET, s.initials_image_path) : null,
        }
        : null,
    });
  }

  const { pdf, certificate } = await stampEnvelope(
    {
      public_id: e.public_id,
      title: e.title,
      sender_name: e.sender_name,
      sender_email: e.sender_email,
      sent_at: e.sent_at,
      completed_at: e.completed_at,
      brand,
    },
    stampDocs,
    (fields ?? []).map((f: any) => ({ ...f, x: Number(f.x), y: Number(f.y), w: Number(f.w), h: Number(f.h) })),
    persons,
    (events ?? []).map((v: any) => ({ ...v, ip: v.ip ? String(v.ip) : null })),
    logoPng,
  );

  const info = { location: "app.gogio.io", contact: "support@virgilio.tech" };
  const sealed = await sealPdf(pdf, sign, tsa, { ...info, reason: `Signed with Gio Sign. Envelope ${e.public_id}` });
  const sealedCert = await sealPdf(certificate, sign, tsa, { ...info, reason: `Certificate of completion. Envelope ${e.public_id}` });

  const base = `${e.tenant_id}/envelopes/${e.id}/sealed`;
  const sealedPath = `${base}/${e.public_id}.pdf`;
  const certPath = `${base}/${e.public_id}-certificate.pdf`;
  for (const [path, bytes] of [[sealedPath, sealed], [certPath, sealedCert]] as const) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`upload_failed:${error.message}`);
  }
  const digest = hex(await sha256(sealed));
  const { error: doneErr } = await supabase.rpc("sign_seal_done", {
    _envelope_id: e.id,
    _sealed_path: sealedPath,
    _sha256: digest,
    _certificate_path: certPath,
    _detail: { signer: sign.name, bytes: sealed.length, certificate_sha256: hex(await sha256(sealedCert)) },
  });
  if (doneErr) throw doneErr;

  // From here the envelope is sealed; delivery problems are logged, not retried as a seal.
  const title = fileSafe(e.title);
  const files = [
    { filename: `${title} (signed).pdf`, content: b64(sealed) },
    { filename: `${title} (certificate).pdf`, content: b64(sealedCert) },
  ];

  if (e.kind === "candidate" && e.ats_candidate_id) {
    try {
      const path = `${e.ats_candidate_id}/${Date.now()}-signed-${e.public_id}.pdf`;
      const up = await supabase.storage.from("candidate-attachments").upload(path, sealed, { contentType: "application/pdf", upsert: false });
      if (up.error) throw up.error;
      const { error } = await supabase.from("candidate_attachments").insert({
        candidate_id: e.ats_candidate_id,
        file_name: `${title} (signed).pdf`,
        file_url: path,
        file_size_bytes: sealed.length,
        file_type: "application/pdf",
        uploaded_by: e.sender_user_id,
        is_resume: false,
      });
      if (error) throw error;
    } catch (err) {
      console.error("sign-seal candidate file", e.id, err instanceof Error ? err.message : JSON.stringify(err));
    }
  }

  const list = await people(supabase, e.id);
  const to = new Map<string, { name: string; isSender: boolean }>();
  for (const r of recips ?? []) to.set(String(r.email).toLowerCase(), { name: r.name, isSender: false });
  const senderKey = String(e.sender_email).toLowerCase();
  to.set(senderKey, { name: e.sender_name, isSender: true });
  let sent = 0;
  for (const [email, who] of to) {
    try {
      await sendMail(signedCopyEmail({
        brand,
        senderName: e.sender_name,
        senderEmail: e.sender_email,
        recipientName: who.name,
        recipientEmail: email,
        isSender: who.isSender,
        title: e.title,
        publicId: e.public_id,
        people: list,
        files,
        recordUrl: recordUrl(e),
      }));
      sent++;
    } catch (err) {
      console.error("sign-seal email", e.id, err instanceof Error ? err.message : err);
    }
  }
  await supabase.rpc("sign_mark_delivered", { _envelope_id: e.id, _count: sent });
  return { id: e.id, sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected || req.headers.get("x-internal-secret") !== expected) {
    return json(401, { error: "unauthorized" }, corsHeaders);
  }
  const supabase = adminClient();
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const only = typeof body?.envelope_id === "string" ? body.envelope_id : null;

  // Health check: seals a one-page PDF in memory (nothing stored or sent) and
  // returns it, to confirm the identity, the timestamp authority and the timing.
  if (body?.selftest === true) {
    try {
      const t0 = Date.now();
      const sign = await signer(supabase);
      const t1 = Date.now();
      const { PDFDocument, StandardFonts } = await import("npm:pdf-lib@1.17.1");
      const doc = await PDFDocument.create();
      const page = doc.addPage([612, 792]);
      page.drawText("Gio Sign seal check", { x: 60, y: 720, size: 18, font: await doc.embedFont(StandardFonts.Helvetica) });
      const out = await sealPdf(await doc.save({ useObjectStreams: false }), sign, tsa, { reason: "Seal check", location: "app.gogio.io", contact: "support@virgilio.tech" });
      return json(200, { ok: true, identity_ms: t1 - t0, seal_ms: Date.now() - t1, bytes: out.length, pdf: b64(out) }, corsHeaders);
    } catch (err) {
      return json(500, { ok: false, error: err instanceof Error ? err.message : String(err) }, corsHeaders);
    }
  }

  const { data: claimed, error } = await supabase.rpc("sign_seal_claim", { _envelope_id: only, _limit: 3 });
  if (error) {
    console.error("sign-seal claim", error.message);
    return json(500, { error: "server" }, corsHeaders);
  }
  const ids = ((claimed ?? []) as unknown[]).map((x: any) => (typeof x === "string" ? x : x?.sign_seal_claim ?? x?.id)).filter(Boolean) as string[];
  if (!ids.length) return json(200, { sealed: 0, failed: 0 }, corsHeaders);

  let sign: Signer;
  try {
    sign = await signer(supabase);
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    for (const id of ids) await supabase.rpc("sign_seal_failed", { _envelope_id: id, _error: `identity: ${msg}` });
    return json(500, { error: "identity" }, corsHeaders);
  }
  const logoPng = await logo();

  let sealed = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await sealOne(supabase, id, sign, logoPng);
      sealed++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("sign-seal", id, msg);
      const { data: attempts } = await supabase.rpc("sign_seal_failed", { _envelope_id: id, _error: msg });
      if (Number(attempts) >= 5) {
        const { data: e } = await supabase.from("sign_envelopes").select("*").eq("id", id).maybeSingle();
        if (e) await bell(supabase, e, { title: "Signed by everyone, but the sealed copy couldn't be made", subtitle: e.title, event: "seal_failed" });
      }
    }
  }
  return json(200, { sealed, failed }, corsHeaders);
});
