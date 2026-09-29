/**
 * /cp/:token and /cp/:token/:slug — the client pipeline.
 *
 * Read-only board of the stages the recruiter shared. Every card opens the same
 * client-ready dossier as the candidate's own /d/ link. The board payload is
 * shaped on the server; nothing here hides anything.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'

import { supabaseAnonKey, supabaseUrl } from '@/integrations/supabase/client'
import { useReportSplashReady } from '@/contexts/SplashReadyContext'
import { AgencyBrand } from '@/components/public/AgencyBrand'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import PublicDossier from './PublicDossier'

const ENDPOINT = `${supabaseUrl}/functions/v1/pipeline-public`

interface Card {
  slug: string
  display_name: string
  title: string | null
  company?: string | null
  fit_score?: number
  days_in_stage?: number
  client_stage?: 'awaiting' | 'requested' | 'declined' | 'interviewing'
  stage_name: string
}
interface Board {
  state: 'live'
  brand: { agency_name: string; logo_url: string | null }
  workspace_name: string
  client_name: string | null
  job_title: string
  from_stage: string | null
  stages: Array<{ name: string; color: string; candidates: Card[] }>
}
interface Unavailable {
  state: 'unavailable'
  reason: 'off' | 'job_closed'
  brand: { agency_name: string; logo_url: string | null }
  workspace_name: string
  client_name: string | null
  job_title: string
}

const CLIENT_STAGE: Record<string, { label: string; tone: 'lilac' | 'green' | 'neutral' | 'blue' }> = {
  awaiting: { label: 'Awaiting your review', tone: 'lilac' },
  requested: { label: 'Interview requested', tone: 'green' },
  declined: { label: 'Not a fit', tone: 'neutral' },
  interviewing: { label: 'In interviews', tone: 'blue' },
}

async function call(body: Record<string, unknown>) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    body: JSON.stringify(body),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('This pipeline could not be loaded.')
  return res.json()
}

function useNoIndex() {
  useEffect(() => {
    const tags = [['robots', 'noindex, nofollow'], ['referrer', 'no-referrer']].map(([n, c]) => {
      const m = document.createElement('meta'); m.name = n; m.content = c; document.head.appendChild(m); return m
    })
    return () => tags.forEach((t) => t.remove())
  }, [])
}

function Shell({ brand, clientName, workspace, children }: { brand: Board['brand']; clientName: string | null; workspace: string; children: React.ReactNode }) {
  const divider = <span aria-hidden style={{ width: 1, height: 16, background: '#ECE7DD' }} />
  const dot = <span aria-hidden style={{ width: 3, height: 3, borderRadius: 9, background: '#D1D0CB' }} />
  return (
    <div className="font-inter flex flex-col" style={{ minHeight: '100dvh', background: '#FAF8F3' }}>
      <header className="flex items-center justify-between flex-wrap" style={{ padding: '16px 36px', borderBottom: '1px solid #ECE7DD', gap: 12 }}>
        <AgencyBrand name={brand.agency_name} logoUrl={brand.logo_url} />
        <div className="flex items-center" style={{ gap: 12, fontSize: 12 }}>
          <span className="inline-flex items-center" style={{ gap: 7, color: '#5A6072' }}>
            <span style={{ width: 7, height: 7, borderRadius: 9, background: '#12B886', boxShadow: '0 0 0 3px rgba(18,184,134,0.18)' }} />Live
          </span>
          {divider}
          <span className="hidden sm:inline" style={{ color: '#8B8F9E' }}>Hiring pipeline</span>
          <span className="hidden sm:inline-flex">{divider}</span>
          <span className="inline-flex items-center" style={{ gap: 5, color: '#5A6072' }}>
            <ShieldCheck size={13} color="#12B886" />Secure link
          </span>
        </div>
      </header>
      <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>{children}</div>
      <footer className="flex flex-wrap items-center justify-center" style={{ gap: 10, padding: '22px 16px', fontSize: 11.5, color: '#8B8F9E' }}>
        <span>Shared{clientName ? ` with ${clientName}` : ''} by {workspace}</span>{dot}
        <a href="/privacy" style={{ color: '#8B8F9E' }}>Privacy</a>{dot}
        <a href="mailto:support@gogio.com?subject=Report%20a%20pipeline%20link" style={{ color: '#8B8F9E' }}>Report this link</a>{dot}
        <span>Recruitment software by <span className="font-poppins" style={{ fontWeight: 600, color: '#5A6072' }}>Gio</span></span>
      </footer>
    </div>
  )
}

function PPCard({ card, onOpen }: { card: Card; onOpen: () => void }) {
  const meta = [card.title, card.company].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left transition-[border-color,box-shadow] duration-[120ms] hover:border-[#D7C5FB] hover:shadow-[0_6px_16px_-8px_rgba(13,13,9,0.18)]"
      style={{ background: '#fff', border: '1px solid #E7E8EE', borderRadius: 10, padding: 12, marginBottom: 8 }}
    >
      <div className="flex items-start" style={{ gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-poppins truncate" style={{ fontSize: 13, fontWeight: 600, color: '#1F2230', letterSpacing: '-0.01em' }}>{card.display_name}</div>
          {meta && <div className="truncate" style={{ fontSize: 11.5, color: '#8B8F9E', marginTop: 2 }}>{meta}</div>}
        </div>
        {typeof card.fit_score === 'number' && (
          <span className="font-poppins tabular-nums" style={{ fontSize: 12.5, fontWeight: 600, color: card.fit_score >= 85 ? '#0E9F6E' : card.fit_score >= 70 ? '#B45309' : '#5A6072' }}>
            {card.fit_score}
          </span>
        )}
      </div>
      {(card.client_stage || typeof card.days_in_stage === 'number') && (
        <div className="flex items-center" style={{ gap: 8, marginTop: 10 }}>
          {card.client_stage && (
            <Badge size="xs" dot tone={CLIENT_STAGE[card.client_stage].tone}>{CLIENT_STAGE[card.client_stage].label}</Badge>
          )}
          {typeof card.days_in_stage === 'number' && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8B8F9E' }}>{card.days_in_stage}d</span>
          )}
        </div>
      )}
    </button>
  )
}

export default function PublicPipeline() {
  useReportSplashReady(true)
  useNoIndex()
  const { token = '', slug } = useParams<{ token: string; slug?: string }>()
  const navigate = useNavigate()
  const [board, setBoard] = useState<Board | Unavailable | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastOpened = useRef<string | null>(null)

  const load = useCallback(async (countView = false) => {
    try {
      const data = await call({ action: 'board', token, count_view: countView })
      if (!data) { setMissing(true); return }
      setBoard(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This pipeline could not be loaded.')
    }
  }, [token])

  useEffect(() => {
    const key = `gio-pipeline-seen-${token}`
    const first = !sessionStorage.getItem(key)
    if (first) sessionStorage.setItem(key, '1')
    void load(first)
    // Live: moves, new candidates and feedback show up without a reload.
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 20000)
    return () => window.clearInterval(id)
  }, [load, token])

  // Back on the board after a candidate left the shared stages.
  useEffect(() => {
    if (slug || !board || board.state !== 'live' || !lastOpened.current) return
    const still = board.stages.some((s) => s.candidates.some((c) => c.slug === lastOpened.current))
    lastOpened.current = null
  }, [slug, board])

  if (missing) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#FAF8F3' }}>
        <p className="font-inter" style={{ fontSize: 13, color: '#8B8F9E' }}>404 — page not found</p>
      </div>
    )
  }
  if (!board) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#FAF8F3' }}>
        <p className="font-inter" style={{ fontSize: 13, color: '#8B8F9E' }}>{error ?? 'Opening the pipeline…'}</p>
      </div>
    )
  }

  if (board.state === 'unavailable') {
    return (
      <Shell brand={board.brand} clientName={board.client_name} workspace={board.workspace_name}>
        <div className="flex flex-col items-center text-center" style={{ margin: 'auto', padding: '60px 20px', maxWidth: 440 }}>
          <h1 className="font-poppins" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: '#1F2230' }}>
            {board.reason === 'job_closed' ? 'This role has closed' : 'This pipeline isn’t available right now'}
          </h1>
          <p style={{ fontSize: 13, color: '#5A6072', marginTop: 8, lineHeight: 1.55 }}>
            {board.reason === 'job_closed'
              ? `${board.job_title} is no longer recruiting. ${board.workspace_name} can tell you where things stand.`
              : `${board.workspace_name} has paused this link. They can share it again whenever you need it.`}
          </p>
        </div>
      </Shell>
    )
  }

  if (slug) {
    const back = () => navigate(`/cp/${token}`)
    return (
      <PublicDossier
        key={slug}
        pipeline={{
          token,
          slug,
          onGone: () => {
            toast({ description: 'This candidate has moved on from this stage.' })
            back()
          },
          renderTop: (nav) => (
            <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
              <button type="button" onClick={back} className="font-inter inline-flex items-center" style={{ gap: 6, fontSize: 12.5, color: '#5A6072', fontWeight: 500 }}>
                <ArrowLeft size={14} />Back to pipeline
              </button>
              {nav && (
                <span className="inline-flex items-center" style={{ marginLeft: 'auto', gap: 6, fontSize: 12, color: '#8B8F9E' }}>
                  {nav.stage_name} · {nav.index + 1} of {nav.total}
                  <button type="button" aria-label="Previous candidate" title={nav.prev?.name} disabled={!nav.prev}
                    onClick={() => nav.prev && navigate(`/cp/${token}/${nav.prev.slug}`)}
                    className="inline-flex items-center justify-center disabled:opacity-40"
                    style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E7E8EE', background: '#fff' }}>
                    <ChevronLeft size={14} />
                  </button>
                  <button type="button" aria-label="Next candidate" title={nav.next?.name} disabled={!nav.next}
                    onClick={() => nav.next && navigate(`/cp/${token}/${nav.next.slug}`)}
                    className="inline-flex items-center justify-center disabled:opacity-40"
                    style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E7E8EE', background: '#fff' }}>
                    <ChevronRight size={14} />
                  </button>
                </span>
              )}
            </div>
          ),
        }}
      />
    )
  }

  const total = board.stages.reduce((n, s) => n + s.candidates.length, 0)
  return (
    <Shell brand={board.brand} clientName={board.client_name} workspace={board.workspace_name}>
      <div className="flex flex-col" style={{ padding: '24px 36px 0', flex: 1, minHeight: 0 }}>
        <div className="flex items-end flex-wrap" style={{ gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8B8F9E' }}>
              {board.client_name ? `${board.client_name} · ` : ''}Hiring pipeline
            </div>
            <h1 className="font-poppins" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em', color: '#1F2230', marginTop: 4 }}>
              {board.job_title}<span style={{ color: '#D7C5FB' }}>.</span>
            </h1>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#5A6072' }}>
            {total} candidate{total === 1 ? '' : 's'} · from {board.from_stage}
          </span>
        </div>
        {total === 0 && (
          <p className="text-center" style={{ fontSize: 12.5, color: '#8B8F9E', marginBottom: 14 }}>
            Candidates will appear here as they reach {board.from_stage}.
          </p>
        )}
        <div className="flex overflow-x-auto" style={{ gap: 12, paddingBottom: 12, flex: 1 }}>
          {board.stages.map((stage) => (
            <section key={stage.name} className="flex flex-col"
              style={{ flex: '1 1 0', minWidth: 250, maxWidth: 340, background: '#FAFAF7', border: '1px solid #E7E8EE', borderRadius: 12, overflow: 'hidden' }}>
              <header className="flex items-center" style={{ gap: 8, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #E7E8EE' }}>
                <span style={{ width: 8, height: 8, borderRadius: 9, background: stage.color }} />
                <span className="font-poppins truncate" style={{ fontSize: 12, fontWeight: 600, color: '#1F2230' }}>{stage.name}</span>
                <span style={{ fontSize: 10.5, color: '#8B8F9E' }}>{stage.candidates.length}</span>
              </header>
              <div style={{ padding: 8, overflowY: 'auto' }}>
                {stage.candidates.map((c) => (
                  <PPCard key={c.slug} card={c} onOpen={() => { lastOpened.current = c.slug; navigate(`/cp/${token}/${c.slug}`) }} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Shell>
  )
}
