// Candidate-side attachment upload.
//
// POST /functions/v1/chat-candidate-upload
// Body: { token, filename, mime, size }
//
// Verifies the candidate magic-link token, enforces file-type / size limits,
// and returns a signed upload URL for the private `chat-attachments` bucket
// scoped to the thread. Also returns a short-lived signed read URL that the
// UI can render immediately after upload.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import {
  audit,
  authenticateCandidateRequest,
  bumpRateLimit,
  jsonResponse,
} from "../_shared/chat-candidate-auth.ts";

const BodySchema = z.object({
  token: z.string().min(32).max(2048),
  filename: z.string().min(1).max(200),
  mime: z.string().min(1).max(120),
  size: z.number().int().positive().max(10 * 1024 * 1024), // 10 MB
});

const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument", "text/plain", "text/csv"];

const BUCKET = "chat-attachments";
const READ_TTL = 60 * 60 * 24; // 24h

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" });

  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonResponse(400, { error: "bad_request" }); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return jsonResponse(400, { error: "bad_request" });

  const auth = await authenticateCandidateRequest(req, parsed.data.token);
  if (!auth.ok) return auth.response;
  const { supabase, ctx, ip } = auth;

  if (ctx.paused) return jsonResponse(423, { error: "chat_paused" });

  const okType = ALLOWED_MIME_PREFIXES.some((p) => parsed.data.mime.startsWith(p));
  if (!okType) return jsonResponse(415, { error: "unsupported_media_type" });

  const allowed = await bumpRateLimit(supabase, "candidate_upload_ip", ip, 30, 60);
  if (!allowed) return jsonResponse(429, { error: "rate_limited" }, { "Retry-After": "60" });

  // Sanitize filename — keep extension, strip path traversal.
  const safeName = parsed.data.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const path = `${ctx.threadId}/${crypto.randomUUID()}-${safeName}`;

  const { data: signedUpload, error: uploadErr } = await supabase
    .storage.from(BUCKET).createSignedUploadUrl(path);
  if (uploadErr || !signedUpload) {
    console.error("[chat-candidate-upload] signed upload failed", uploadErr);
    return jsonResponse(500, { error: "internal_error" });
  }

  const { data: signedRead } = await supabase
    .storage.from(BUCKET).createSignedUrl(path, READ_TTL);

  await audit(supabase, {
    tenant_id: ctx.tenantId,
    thread_id: ctx.threadId,
    actor_type: "candidate",
    event: "attachment_upload_requested",
    metadata: { filename: safeName, mime: parsed.data.mime, size: parsed.data.size, ip },
  });

  return jsonResponse(200, {
    uploadUrl: signedUpload.signedUrl,
    token: signedUpload.token,
    path,
    bucket: BUCKET,
    readUrl: signedRead?.signedUrl ?? null,
    readUrlExpiresIn: READ_TTL,
  });
});
