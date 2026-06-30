// chat-email-pixel — Phase 5.1
// 1x1 transparent GIF that stamps email_opened_at + read_by_recipient_at on a
// chat_messages row the first time the candidate's mail client renders the
// pixel. Public/unauthenticated endpoint.
//
// Defensive choices:
//  - Always return a 200 + GIF, regardless of DB outcome (never break email rendering).
//  - Only stamp once (WHERE email_opened_at IS NULL) — repeated opens are ignored.
//  - No-store cache headers so each open re-fetches the pixel.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// 1x1 transparent GIF (43 bytes)
const GIF = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
])

const PIXEL_HEADERS = {
  'Content-Type': 'image/gif',
  'Content-Length': String(GIF.byteLength),
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  'Access-Control-Allow-Origin': '*',
}

function pixel() {
  return new Response(GIF, { status: 200, headers: PIXEL_HEADERS })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: PIXEL_HEADERS })
    if (req.method !== 'GET' && req.method !== 'HEAD') return pixel()

    const url = new URL(req.url)
    const messageId = url.searchParams.get('m') ?? ''
    if (!UUID_RE.test(messageId)) return pixel()

    const svc = createClient(SUPABASE_URL, SERVICE_KEY)
    const now = new Date().toISOString()

    // Stamp once. read_by_recipient_at doubles as the chat "delivered/read"
    // signal already used by the recruiter UI.
    const { data, error } = await svc
      .from('chat_messages')
      .update({ email_opened_at: now, read_by_recipient_at: now })
      .eq('id', messageId)
      .eq('direction', 'out')
      .is('email_opened_at', null)
      .select('id, thread_id, tenant_id')
      .maybeSingle()

    if (!error && data?.thread_id) {
      // Best-effort audit; ignore failures.
      void svc.from('chat_audit_log').insert({
        tenant_id: data.tenant_id,
        actor_id: null,
        thread_id: data.thread_id,
        event: 'email_opened',
        metadata: {
          message_id: data.id,
          user_agent: req.headers.get('user-agent') ?? null,
        },
      })
    }
  } catch (e) {
    console.error('chat-email-pixel error', e)
  }
  return pixel()
})
