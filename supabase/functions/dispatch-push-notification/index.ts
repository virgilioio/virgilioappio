// Dispatches a Web Push to all push_subscriptions of a notification's recipient.
// Called from emit_notification via pg_net (with service-role auth) and respects
// the recipient's per-category push preference.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@app.gogio.io'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

const PUSH_PREF_COL: Record<string, string> = {
  mention: 'mention_push',
  application_batch: 'application_batch_push',
  scorecard_submitted: 'scorecard_submitted_push',
  interview_event: 'interview_event_push',
  offer_event: 'offer_event_push',
  posting_status: 'posting_status_push',
  daily_digest: 'daily_digest_push',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: 'VAPID not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { notification_id } = await req.json().catch(() => ({}))
    if (!notification_id || typeof notification_id !== 'string') {
      return new Response(JSON.stringify({ error: 'notification_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

    const { data: notif, error: nErr } = await supabase
      .from('notifications')
      .select('id,user_id,category,title,subtitle,action_url')
      .eq('id', notification_id)
      .maybeSingle()
    if (nErr || !notif) {
      return new Response(JSON.stringify({ error: 'notification not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check push preference for the recipient/category
    const prefCol = PUSH_PREF_COL[notif.category]
    if (!prefCol) {
      return new Response(JSON.stringify({ skipped: 'unknown category' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select(prefCol)
      .eq('user_id', notif.user_id)
      .maybeSingle()
    // @ts-ignore dynamic
    if (!prefs || prefs[prefCol] !== true) {
      return new Response(JSON.stringify({ skipped: 'push disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .eq('user_id', notif.user_id)
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ skipped: 'no subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.stringify({
      title: notif.title,
      body: notif.subtitle ?? '',
      url: notif.action_url ?? '/',
      tag: notif.id,
    })

    const stale: string[] = []
    const results = await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          )
        } catch (err: any) {
          const sc = err?.statusCode
          if (sc === 404 || sc === 410) stale.push(s.endpoint)
          throw err
        }
      }),
    )

    if (stale.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', stale)
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length
    return new Response(JSON.stringify({ sent, failed: results.length - sent, pruned: stale.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('dispatch-push-notification error', err)
    return new Response(JSON.stringify({ error: err?.message ?? 'error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
