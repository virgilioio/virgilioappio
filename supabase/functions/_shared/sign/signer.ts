// Gio Sign: what the public signing page's two functions share.
//
// A signer reaches their envelope with the link token from their email
// (only its SHA-256 hash is stored, in sign_recipient_secrets), then proves
// it's them with a 6-digit code sent to the same address, which opens a
// 2-hour session. Every auth-shaped failure is one indistinguishable
// "not_found", so links can't be probed. ASCII only in this file.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export { adminClient, ipFrom, rateLimitOk } from "../referenceTokens.ts";

const ENC = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", ENC.encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomCode(): string {
  const a = crypto.getRandomValues(new Uint32Array(1));
  return String(a[0] % 1000000).padStart(6, "0");
}

export const codeHash = (recipientId: string, code: string) => sha256Hex(`${recipientId}:${code}`);

export function json(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

export interface LinkContext {
  secret: Record<string, any>;
  recipient: Record<string, any>;
  envelope: Record<string, any>;
  brand: string;
}

/** Resolve a link token to its recipient and envelope, or null. */
export async function resolveLink(supabase: SupabaseClient, token: unknown): Promise<LinkContext | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;
  const hash = await sha256Hex(token);
  // The current link, or the one before it (a reminder sends a fresh link
  // but the previous email keeps working).
  const { data: secret } = await supabase
    .from("sign_recipient_secrets")
    .select("*")
    .or(`token_hash.eq.${hash},token_hash_prev.eq.${hash}`)
    .maybeSingle();
  if (!secret) return null;
  if (secret.token_expires_at && new Date(secret.token_expires_at).getTime() < Date.now()) return null;
  const { data: recipient } = await supabase
    .from("sign_recipients")
    .select("*")
    .eq("id", secret.recipient_id)
    .is("removed_at", null)
    .maybeSingle();
  if (!recipient || !recipient.envelope_id) return null;
  const { data: envelope } = await supabase
    .from("sign_envelopes")
    .select("*")
    .eq("id", recipient.envelope_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!envelope) return null;
  const { data: tenant } = await supabase.from("tenants").select("name").eq("id", envelope.tenant_id).maybeSingle();
  return { secret, recipient, envelope, brand: (tenant?.name as string) || "Gio Sign" };
}

export type SignerState =
  | "open"
  | "waiting"
  | "signed"
  | "declined"
  | "voided"
  | "expired"
  | "completed"
  | "copy";

/** Where this signer stands. "open" means it's their turn now. */
export async function signerState(supabase: SupabaseClient, ctx: LinkContext): Promise<SignerState> {
  const { envelope: e, recipient: r } = ctx;
  if (r.role === "cc") return e.status === "completed" ? "completed" : "copy";
  if (r.status === "signed" || r.status === "approved") return e.status === "completed" ? "completed" : "signed";
  if (e.status === "voided") return "voided";
  if (e.status === "declined") return "declined";
  if (e.status === "expired" || (e.expires_at && new Date(e.expires_at).getTime() < Date.now())) return "expired";
  if (e.status === "completed") return "completed";
  if (e.status !== "sent") return "waiting";
  const { data: turn } = await supabase.rpc("sign_is_turn", { _recipient_id: r.id });
  return turn ? "open" : "waiting";
}

/** True when the session token matches and hasn't run out. */
export async function sessionOk(ctx: LinkContext, session: unknown): Promise<boolean> {
  if (typeof session !== "string" || session.length < 20) return false;
  const s = ctx.secret;
  if (!s.session_hash || !s.session_expires_at) return false;
  if (new Date(s.session_expires_at).getTime() < Date.now()) return false;
  return (await sha256Hex(session)) === s.session_hash;
}

export function maskEmail(email: string): string {
  const [user, domain] = String(email || "").split("@");
  if (!domain) return email;
  const shown = user.slice(0, 1);
  return `${shown}${"*".repeat(Math.max(3, Math.min(8, user.length - 1)))}@${domain}`;
}

export async function logEvent(
  supabase: SupabaseClient,
  ctx: LinkContext,
  kind: string,
  label: string,
  req: Request,
  ip: string,
  detail: Record<string, unknown> = {},
) {
  await supabase.from("sign_events").insert({
    tenant_id: ctx.envelope.tenant_id,
    envelope_id: ctx.envelope.id,
    recipient_id: ctx.recipient.id,
    kind,
    label,
    key: false,
    actor_name: ctx.recipient.name,
    actor_email: ctx.recipient.email,
    ip: /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null,
    user_agent: (req.headers.get("user-agent") || "").slice(0, 500),
    detail,
  });
}

/** The verification code email, in the Gio Sign layout. */
export async function sendCodeEmail(input: { to: string; name: string; code: string; brand: string; title: string }) {
  const { codeEmail, sendMail } = await import("./emails.ts");
  await sendMail(codeEmail({ brand: input.brand, recipientName: input.name, recipientEmail: input.to, code: input.code, title: input.title }));
}
