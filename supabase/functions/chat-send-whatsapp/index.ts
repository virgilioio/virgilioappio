// Phase 5.2 (deferred) — WhatsApp channel scaffold.
//
// This function is intentionally a placeholder. It preserves the same
// invocation shape as `chat-send-email` so the frontend router
// (`useSendChatMessage`) and any future admin tools can start pointing at
// WhatsApp without another refactor once a verified BSP is chosen.
//
// Future integration checklist (whoever picks this up):
//   1. Pick provider (Meta Cloud API direct, Twilio, or 360dialog).
//   2. Add secrets via add_secret:
//        - WHATSAPP_PROVIDER            ('meta' | 'twilio' | '360dialog')
//        - WHATSAPP_PHONE_NUMBER_ID     (Meta) or WHATSAPP_FROM (Twilio)
//        - WHATSAPP_ACCESS_TOKEN / WHATSAPP_AUTH_TOKEN
//        - WHATSAPP_WEBHOOK_VERIFY_TOKEN
//   3. Implement:
//        - Outbound send (free-form within 24h window, template outside)
//        - Inbound webhook -> upsert chat_threads(channel='whatsapp'),
//          insert chat_messages(direction='in'), trigger notifications.
//        - Delivery/read receipt webhook -> stamp read_by_recipient_at and
//          a new delivered_at column (add via migration when ready).
//        - Template registry table (chat_whatsapp_templates) with
//          name/lang/status/body sync from Meta.
//   4. Flip config.toml `verify_jwt = false` for the inbound webhook
//      endpoint (this send endpoint stays `verify_jwt = true`).
//   5. Update Composer + Settings > Integrations to show WhatsApp state.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return new Response(
    JSON.stringify({
      error: 'whatsapp_not_configured',
      message:
        'WhatsApp channel is scaffolded but not connected to a provider yet. See docs/chat/PLAN.md §5.2.',
    }),
    {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
