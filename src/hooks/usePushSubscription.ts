import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function usePushSubscription() {
  const { user } = useAuth()
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  const [permission, setPermission] = useState<NotificationPermission>(
    supported && typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [subscribed, setSubscribed] = useState(false)
  const configured = !!VAPID_PUBLIC_KEY

  const refresh = useCallback(async () => {
    if (!supported) return
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = (await reg?.pushManager.getSubscription()) ?? null
    setSubscribed(!!sub)
  }, [supported])

  useEffect(() => { refresh() }, [refresh])

  const subscribe = useCallback(async () => {
    if (!supported || !configured || !user) return false
    let perm = permission
    if (perm !== 'granted') {
      perm = await Notification.requestPermission()
      setPermission(perm)
    }
    if (perm !== 'granted') return false
    const reg =
      (await navigator.serviceWorker.getRegistration('/sw.js')) ??
      (await navigator.serviceWorker.register('/sw.js'))
    const existing = await reg.pushManager.getSubscription()
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }))
    const json = sub.toJSON() as any
    await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: 'endpoint' }
    )
    setSubscribed(true)
    return true
  }, [supported, configured, user, permission])

  const unsubscribe = useCallback(async () => {
    if (!supported) return
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
    setSubscribed(false)
  }, [supported])

  return { supported, configured, permission, subscribed, subscribe, unsubscribe }
}
