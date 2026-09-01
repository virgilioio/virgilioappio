// Reference-check magic-link tokens.
//
// Modelled on `chat-token.ts`: an HMAC-SHA256 signed payload where only the
// SHA-256 hash of the token is ever persisted. No ids, names or emails travel
// in the URL beyond the opaque payload, and every auth-shaped failure at the
// verify side collapses to one indistinguishable `not_found`.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export type ReferenceTokenKind = "candidate" | "referee" | "report";

export interface IssuedReferenceToken {
  token: string;
  tokenHash: string;
  expiresAt: string;
  url: string;
}

export interface VerifiedReferenceToken {
  kind: ReferenceTokenKind;
  tenantId: string;
  requestId: string;
  subjectId: string; // candidate_id for candidate links, referee id for referee links
  tokenHash: string;
  expiresAt: Date;
}

const ENCODER = new TextEncoder();

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function appBase(): string {
  return (Deno.env.get("PUBLIC_APP_URL") ?? "https://app.gogio.io").replace(/\/$/, "");
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, ENCODER.encode(payload)));
}

export async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", ENCODER.encode(input)));
}

function secret(): string {
  const s = Deno.env.get("REFERENCE_TOKEN_SECRET");
  if (!s) throw new Error("REFERENCE_TOKEN_SECRET is not configured");
  return s;
}

/** Mint a signed token. Only the returned hash should be persisted. */
export async function issueReferenceToken(input: {
  kind: ReferenceTokenKind;
  tenantId: string;
  requestId: string;
  subjectId: string;
  expiresInDays: number;
}): Promise<IssuedReferenceToken> {
  const jtiBytes = new Uint8Array(18);
  crypto.getRandomValues(jtiBytes);
  const jti = b64url(jtiBytes);

  const days = input.expiresInDays > 0 ? input.expiresInDays : 7;
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  const expEpoch = Math.floor(expiresAt.getTime() / 1000);

  const payload = [
    input.kind === "candidate" ? "c" : input.kind === "report" ? "s" : "r",
    input.tenantId,
    input.requestId,
    input.subjectId,
    jti,
    String(expEpoch),
  ].join(".");
  const sig = await hmacHex(secret(), payload);
  const token = `${payload}.${sig}`;

  const path =
    input.kind === "candidate"
      ? "references"
      : input.kind === "report"
        ? "report"
        : "reference";
  return {
    token,
    tokenHash: await sha256Hex(token),
    expiresAt: expiresAt.toISOString(),
    url: `${appBase()}/${path}/${token}`,
  };
}

/**
 * Verify shape, signature and expiry. Returns null on ANY problem — callers
 * must treat null as an indistinguishable "not found".
 */
export async function verifyReferenceToken(
  raw: string | null | undefined,
): Promise<VerifiedReferenceToken | null> {
  if (!raw || typeof raw !== "string" || raw.length > 800) return null;
  const parts = raw.split(".");
  if (parts.length !== 7) return null;
  const [kindCode, tenantId, requestId, subjectId, jti, expStr, sig] = parts;
  if (kindCode !== "c" && kindCode !== "r" && kindCode !== "s") return null;
  if (!tenantId || !requestId || !subjectId || !jti || !expStr || !sig) return null;

  const payload = [kindCode, tenantId, requestId, subjectId, jti, expStr].join(".");
  let expected: string;
  try {
    expected = await hmacHex(secret(), payload);
  } catch {
    return null;
  }
  if (expected.length !== sig.length) return null;
  // constant-time-ish compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;

  const expEpoch = Number(expStr);
  if (!Number.isFinite(expEpoch)) return null;
  const expiresAt = new Date(expEpoch * 1000);
  if (expiresAt.getTime() <= Date.now()) return null;

  return {
    kind: kindCode === "c" ? "candidate" : kindCode === "s" ? "report" : "referee",
    tenantId,
    requestId,
    subjectId,
    tokenHash: await sha256Hex(raw),
    expiresAt,
  };
}

export function ipFrom(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

/** Bucketed per-IP rate limit, reusing the existing chat limiter. Fails open. */
export async function rateLimitOk(
  supabase: SupabaseClient,
  scope: string,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("chat_bump_rate_limit", {
      p_scope: scope,
      p_scope_key: key,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) return true;
    const row = Array.isArray(data) ? data[0] : data;
    return row?.allowed !== false;
  } catch {
    return true;
  }
}

export async function logReferenceActivity(
  supabase: SupabaseClient,
  requestId: string,
  type: string,
  label: string,
  actor: string | null = null,
): Promise<void> {
  try {
    await supabase.from("reference_activity").insert({
      request_id: requestId,
      type,
      label,
      actor,
    });
  } catch (e) {
    console.warn("[referenceTokens] activity log skipped", e);
  }
}
