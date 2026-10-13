/**
 * The link in a privacy email (2026-10-12). Public, token-resolved, no Gio
 * account. Route: /privacy/choice/:token
 *
 *  - notice    → "Remove my details" (asks once, then removes for good)
 *  - retention → "Keep my details" or "Remove my details"
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loader2, UserX } from 'lucide-react'

import { GioAtsLogo } from '@/components/brand/GioAtsLogo'
import { Button } from '@/components/ui/button'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { useReportSplashReady } from '@/contexts/SplashReadyContext'
import { supabase } from '@/integrations/supabase/client'
import { PRIVACY_EMAIL } from '@/components/legal/LegalPage'

type Peek = { purpose: 'notice' | 'retention'; first_name: string | null; answered: boolean; answer: 'keep' | 'remove' | null }
type View = 'loading' | 'invalid' | 'ask' | 'removed' | 'kept'

async function call(token: string, action: 'peek' | 'remove' | 'keep') {
  const { data, error } = await supabase.functions.invoke('privacy-choice', { body: { token, action } })
  if (error) throw error
  return data as Record<string, unknown>
}

export default function PrivacyChoice() {
  const { token = '' } = useParams()
  const [peek, setPeek] = useState<Peek | null>(null)
  const [view, setView] = useState<View>('loading')
  const [busy, setBusy] = useState<'remove' | 'keep' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useReportSplashReady(view !== 'loading')

  useEffect(() => {
    document.title = 'Your details · Virgilio'
    let alive = true
    call(token, 'peek')
      .then((d) => {
        if (!alive) return
        const p = d as unknown as Peek
        setPeek(p)
        setView(p.answer === 'remove' ? 'removed' : p.answer === 'keep' ? 'kept' : 'ask')
      })
      .catch(() => alive && setView('invalid'))
    return () => {
      alive = false
    }
  }, [token])

  const act = async (action: 'remove' | 'keep') => {
    if (action === 'remove') {
      // O6 (Block B §16, Pattern 1). Plain Cancel: on the 3-year check "Keep my
      // details" is an answer of its own, so the dialog never says "Keep".
      const ok = await confirmDestructive({
        icon: UserX,
        title: 'Remove your details from Virgilio?',
        description:
          'We\u2019ll delete your profile \u2014 your name, roles, location and work email \u2014 and won\u2019t add it again. This can\u2019t be undone.',
        confirmLabel: 'Remove my details',
      })
      if (!ok) return
    }
    setBusy(action)
    setError(null)
    try {
      await call(token, action)
      setView(action === 'remove' ? 'removed' : 'kept')
    } catch {
      setError(`That didn\u2019t go through. Nothing was removed; try again, or email ${PRIVACY_EMAIL}.`)
    } finally {
      setBusy(null)
    }
  }

  const hi = peek?.first_name ? `Hi ${peek.first_name}` : 'Hi'

  return (
    <div className="min-h-screen bg-[#fffcf9] text-[#1F2230]">
      <header className="mx-auto flex max-w-[560px] items-center px-5 pt-5 sm:px-8 sm:pt-7">
        <GioAtsLogo height={48} />
      </header>
      <main className="mx-auto max-w-[560px] px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        {view === 'loading' && (
          <div className="flex items-center gap-2 font-inter text-[14px] text-[#6B7080]" role="status">
            <Loader2 className="h-4 w-4 animate-spin gio-spinner" aria-hidden="true" />
            Loading your details…
          </div>
        )}

        {view === 'invalid' && (
          <Section title="This link doesn't work">
            <p>It may be incomplete or out of date. Email <Mail /> and we'll help you directly.</p>
          </Section>
        )}

        {view === 'removed' && (
          <Section title="Done">
            <p>We've deleted your details and won't add them again.</p>
          </Section>
        )}

        {view === 'kept' && (
          <Section title="Thanks">
            <p>We'll keep your details for another three years. You can ask us to remove them anytime at <Mail />.</p>
          </Section>
        )}

        {view === 'ask' && peek?.purpose === 'notice' && (
          <Section title={`${hi}`}>
            <p>
              Virgilio, a recruiting firm for sales and go-to-market roles, has your professional profile: your name,
              current role and company, past roles, location and work email. We use it only to consider you for roles
              that may fit.
            </p>
            <p>If you'd rather we didn't keep it, we'll delete your details and won't add them again.</p>
            <Actions error={error}>
              <Button variant="danger" loading={busy === 'remove'} disabled={busy !== null} onClick={() => act('remove')}>
                Remove my details
              </Button>
            </Actions>
          </Section>
        )}

        {view === 'ask' && peek?.purpose === 'retention' && (
          <Section title={`${hi}`}>
            <p>
              Virgilio has had your professional profile for over three years without being in touch. Keep it, and
              we'll think of you for sales and go-to-market roles that fit. Otherwise we'll delete it.
            </p>
            <Actions error={error}>
              <Button loading={busy === 'keep'} disabled={busy !== null} onClick={() => act('keep')}>
                Keep my details
              </Button>
              <Button variant="outline" loading={busy === 'remove'} disabled={busy !== null} onClick={() => act('remove')}>
                Remove my details
              </Button>
            </Actions>
          </Section>
        )}

        <p className="mt-12 font-inter text-[12.5px] text-[#6B7080]">
          <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
          {' · '}
          <Mail />
        </p>
      </main>
    </div>
  )
}

function Mail() {
  return (
    <a href={`mailto:${PRIVACY_EMAIL}`} className="underline underline-offset-2">
      {PRIVACY_EMAIL}
    </a>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="font-poppins text-[28px] font-semibold leading-[1.15] tracking-[-0.04em] text-[#0d0d09] sm:text-[34px]">
        {title}
        <span className="text-[#D7C5FB]">.</span>
      </h1>
      <div className="mt-5 space-y-4 font-inter text-[15px] leading-[1.65]">{children}</div>
    </section>
  )
}

function Actions({ error, children }: { error: string | null; children: React.ReactNode }) {
  return (
    <div className="pt-2">
      <div className="flex flex-wrap gap-2">{children}</div>
      <p className="gio-field-message mt-2 min-h-[18px] font-inter text-[13px] text-[#B91C1C]" role="alert">
        {error ?? ''}
      </p>
    </div>
  )
}
