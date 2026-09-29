/** /cp/:token and /cp/:token/:slug — shared client pipeline. */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, ShieldCheck, Sparkles } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'

import { supabaseAnonKey, supabaseUrl } from '@/integrations/supabase/client'
import { useReportSplashReady } from '@/contexts/SplashReadyContext'
import { AgencyBrand } from '@/components/public/AgencyBrand'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { PASTELS } from '@/lib/pastels'
import PublicDossier from './PublicDossier'

const ENDPOINT = `${supabaseUrl}/functions/v1/pipeline-public`
type SectionKey = 'application' | 'recruiting' | 'offers' | 'hired' | 'rejected'
interface SectionMeta { key: SectionKey; label: string; count: number }
interface Row {
  slug: string; display_name: string; title: string | null; company?: string | null; fit_score?: number
  public_status?: 'awaiting' | 'requested' | 'declined' | 'interviewing' | 'scheduled'; scheduled_start?: string
  stage_name?: string; days_in_stage?: number; applied_at?: string | null; offered_at?: string | null
  offer_status?: string; accepted_at?: string | null; start_date?: string | null; reached_stage?: string | null
  closed_at?: string | null; rejection_reason?: string
}
interface Board {
  state: 'live'; brand: { agency_name: string; logo_url: string | null }; workspace_name: string; client_name: string | null
  job_title: string; client_can_respond: boolean; active_section: SectionKey; sections: SectionMeta[]
  stages?: Array<{ name: string; color: string; candidates: Row[] }>; rows?: Row[]
  show_fit_score: boolean; show_employer: boolean; show_client_status: boolean; show_reject_reason: boolean
}
interface Unavailable { state: 'unavailable'; reason: 'off' | 'job_closed'; brand: Board['brand']; workspace_name: string; client_name: string | null; job_title: string }

const SECTION_TONE: Record<SectionKey, keyof typeof PASTELS> = { application: 'purple', recruiting: 'yellow', offers: 'blue', hired: 'green', rejected: 'neutral' }
const CLIENT_STAGE: Record<string, { label: string; tone: 'lilac' | 'green' | 'neutral' | 'blue' }> = {
  awaiting: { label: 'Awaiting your review', tone: 'lilac' }, requested: { label: 'Interview requested', tone: 'green' }, declined: { label: 'Not a fit', tone: 'neutral' }, interviewing: { label: 'In interviews', tone: 'blue' }, scheduled: { label: 'Scheduled', tone: 'blue' },
}
const EMPTY: Record<Exclude<SectionKey, 'recruiting'>, string> = { application: 'New applications will appear here.', offers: 'Offers will appear here once they’re being prepared.', hired: 'Hires will appear here.', rejected: 'Candidates who don’t progress will appear here.' }

function scheduledLabel(iso: string) {
  const ms = Date.parse(iso); if (Number.isNaN(ms)) return 'Scheduled'
  const start = (v: number) => { const d = new Date(v); d.setHours(0, 0, 0, 0); return d.getTime() }
  const diff = Math.round((start(ms) - start(Date.now())) / 86400000)
  const day = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day} · ${new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}
const relative = (iso?: string | null) => iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true }).replace(/^about /, '') : '—'
const shortDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'
async function call(body: Record<string, unknown>) {
  const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` }, body: JSON.stringify(body) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('This pipeline could not be loaded.')
  return res.json()
}
function useNoIndex() { useEffect(() => { const tags = [['robots', 'noindex, nofollow'], ['referrer', 'no-referrer']].map(([name, content]) => { const m = document.createElement('meta'); m.name = name; m.content = content; document.head.appendChild(m); return m }); return () => tags.forEach((t) => t.remove()) }, []) }
function Shell({ brand, clientName, workspace, children }: { brand: Board['brand']; clientName: string | null; workspace: string; children: React.ReactNode }) {
  const divider = <span aria-hidden style={{ width: 1, height: 16, background: '#ECE7DD' }} />; const dot = <span aria-hidden style={{ width: 3, height: 3, borderRadius: 9, background: '#D1D0CB' }} />
  return <div className="font-inter flex flex-col" style={{ minHeight: '100dvh', background: '#FAF8F3' }}>
    <header className="flex items-center justify-between flex-wrap" style={{ padding: '16px 36px', borderBottom: '1px solid #ECE7DD', gap: 12 }}><AgencyBrand name={brand.agency_name} logoUrl={brand.logo_url} /><div className="flex items-center" style={{ gap: 12, fontSize: 12 }}><span className="inline-flex items-center" style={{ gap: 7, color: '#5A6072' }}><span style={{ width: 7, height: 7, borderRadius: 9, background: '#12B886', boxShadow: '0 0 0 3px rgba(18,184,134,0.18)' }} />Live</span>{divider}<span className="hidden sm:inline" style={{ color: '#8B8F9E' }}>Hiring pipeline</span><span className="hidden sm:inline-flex">{divider}</span><span className="inline-flex items-center" style={{ gap: 5, color: '#5A6072' }}><ShieldCheck size={13} color="#12B886" />Secure link</span></div></header>
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>{children}</div>
    <footer className="flex flex-wrap items-center justify-center" style={{ gap: 10, padding: '22px 16px', fontSize: 11.5, color: '#8B8F9E' }}><span>Shared{clientName ? ` with ${clientName}` : ''} by {workspace}</span>{dot}<a href="/privacy" style={{ color: '#8B8F9E' }}>Privacy</a>{dot}<a href="mailto:support@gogio.com?subject=Report%20a%20pipeline%20link" style={{ color: '#8B8F9E' }}>Report this link</a>{dot}<span>Recruitment software by <span className="font-poppins" style={{ fontWeight: 600, color: '#5A6072' }}>Gio</span></span></footer>
  </div>
}
function Status({ row, application = false }: { row: Row; application?: boolean }) {
  if (!row.public_status) return null
  const state = CLIENT_STAGE[row.public_status]
  const label = row.public_status === 'scheduled' && row.scheduled_start ? scheduledLabel(row.scheduled_start) : application && row.public_status === 'awaiting' ? 'Ready to review' : state.label
  return <Badge size="xs" dot tone={state.tone}>{label}</Badge>
}
function PPCard({ card, onOpen }: { card: Row; onOpen: () => void }) {
  const meta = [card.title, card.company].filter(Boolean).join(' · ')
  return <button type="button" onClick={onOpen} className="w-full text-left transition-[border-color,box-shadow] duration-[120ms] hover:border-[#D7C5FB] hover:shadow-[0_6px_16px_-8px_rgba(13,13,9,0.18)]" style={{ background: '#fff', border: '1px solid #E7E8EE', borderRadius: 10, padding: 12, marginBottom: 8 }}>
    <div className="flex items-start" style={{ gap: 8 }}><div style={{ flex: 1, minWidth: 0 }}><div className="font-poppins truncate" style={{ fontSize: 13, fontWeight: 600, color: '#1F2230' }}>{card.display_name}</div>{meta && <div className="truncate" style={{ fontSize: 11.5, color: '#8B8F9E', marginTop: 2 }}>{meta}</div>}</div>{typeof card.fit_score === 'number' && <span className="font-poppins tabular-nums" style={{ fontSize: 12.5, fontWeight: 600, color: card.fit_score >= 85 ? '#0E9F6E' : card.fit_score >= 70 ? '#B45309' : '#5A6072' }}>{card.fit_score}</span>}</div>
    {(card.public_status || typeof card.days_in_stage === 'number') && <div className="flex items-center" style={{ gap: 8, marginTop: 10 }}><Status row={card} />{typeof card.days_in_stage === 'number' && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8B8F9E' }}>{card.days_in_stage}d</span>}</div>}
  </button>
}
function CandidateCell({ row }: { row: Row }) { const meta = [row.title, row.company ? `@ ${row.company}` : null].filter(Boolean).join(' '); const av = row.display_name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2)
  return <span className="flex items-center" style={{ gap: 10, minWidth: 0 }}><span className="font-poppins inline-flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 999, background: '#F1F0EC', color: '#5A6072', fontSize: 10.5, fontWeight: 600 }}>{av}</span><span style={{ minWidth: 0 }}><span className="font-poppins truncate" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0d0d09' }}>{row.display_name}</span>{meta && <span className="font-inter truncate" style={{ display: 'block', fontSize: 11.5, color: '#5A6072' }}>{meta}</span>}</span></span> }
function FitCell({ score }: { score?: number }) { return typeof score === 'number' ? <span className="font-poppins inline-flex items-center" style={{ gap: 5, fontSize: 13.5, fontWeight: 600, color: score >= 85 ? '#12B886' : score >= 70 ? '#F59E0B' : '#5A6072' }}><Sparkles size={11} />{score}</span> : <span>—</span> }
function FlatTable({ board, onOpen }: { board: Board; onOpen: (row: Row) => void }) {
  const section = board.active_section as Exclude<SectionKey, 'recruiting'>; const rows = board.rows ?? []
  const extra = section === 'application' ? [['Applied', 'minmax(0,1fr)'], ...(board.show_client_status ? [['Status', 'minmax(0,1.2fr)']] : [])] : section === 'offers' ? [['Offer sent', 'minmax(0,1fr)'], ...(board.show_client_status ? [['Status', 'minmax(0,1.2fr)']] : [])] : section === 'hired' ? [['Accepted', 'minmax(0,1fr)'], ['Starts', 'minmax(0,1fr)']] : [['Reached', 'minmax(0,1fr)'], ['Closed', 'minmax(0,.8fr)'], ...(board.show_reject_reason ? [['Reason', 'minmax(0,1.1fr)']] : [])]
  const columns = [['Candidate', 'minmax(0,2fr)'], ...(board.show_fit_score ? [['Gio Fit', '84px']] : []), ...extra] as string[][]
  const grid = [...columns.map((c) => c[1]), '24px'].join(' ')
  return <div className="flex flex-col" style={{ flex: 1, minHeight: 0, background: '#fff', border: '1px solid #E7E8EE', borderRadius: 12, overflow: 'hidden' }}>
    <div className="grid items-center" style={{ gridTemplateColumns: grid, padding: '10px 16px', gap: 12, background: '#FAFAF7', borderBottom: '1px solid #E7E8EE' }}>{columns.map(([label]) => <span key={label} style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.055em', textTransform: 'uppercase', color: '#8B8F9E' }}>{label}</span>)}<span /></div>
    <div style={{ overflowY: 'auto' }}>
      {rows.length === 0 ? <div className="text-center" style={{ padding: 28, fontSize: 12.5, color: '#8B8F9E' }}>{EMPTY[section]}</div> : rows.map((row) => <button key={row.slug} type="button" onClick={() => onOpen(row)} className="group grid items-center w-full text-left hover:bg-[#FAFAF7]" style={{ gridTemplateColumns: grid, minHeight: 56, padding: '10px 16px', gap: 12, borderBottom: '1px solid #F1F0EC' }}>
        <CandidateCell row={row} />{board.show_fit_score && <FitCell score={row.fit_score} />}
        {section === 'application' && <><span style={{ fontSize: 12, color: '#5A6072' }}>{relative(row.applied_at)}</span>{board.show_client_status && <Status row={row} application />}</>}
        {section === 'offers' && <><span style={{ fontSize: 12, color: '#5A6072' }}>{relative(row.offered_at)}</span>{board.show_client_status && <Badge tone="lilac" dot size="xs">{row.offer_status}</Badge>}</>}
        {section === 'hired' && <><span style={{ fontSize: 12, color: '#5A6072' }}>{shortDate(row.accepted_at)}</span><span className="font-poppins" style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09' }}>{shortDate(row.start_date)}</span></>}
        {section === 'rejected' && <><span className="truncate" style={{ fontSize: 12, color: '#5A6072' }}>{row.reached_stage || '—'}</span><span style={{ fontSize: 12, color: '#5A6072' }}>{shortDate(row.closed_at)}</span>{board.show_reject_reason && <Badge tone="neutral" size="xs">{row.rejection_reason}</Badge>}</>}
        <ChevronRight size={14} className="text-[#D1D0CB] group-hover:text-[#5A6072]" />
      </button>)}
    </div>
  </div>
}

export default function PublicPipeline() {
  useReportSplashReady(true); useNoIndex()
  const { token = '', slug } = useParams<{ token: string; slug?: string }>(); const navigate = useNavigate(); const [search, setSearch] = useSearchParams()
  const requested = (search.get('section') || 'recruiting') as SectionKey
  const [board, setBoard] = useState<Board | Unavailable | null>(null); const [missing, setMissing] = useState(false); const [error, setError] = useState<string | null>(null)
  const load = useCallback(async (countView = false) => { try { const data = await call({ action: 'board', token, section: requested, count_view: countView }); if (!data) { setMissing(true); return } setBoard(data); if (data.state === 'live' && data.active_section !== requested) setSearch(data.active_section === 'recruiting' ? {} : { section: data.active_section }, { replace: true }) } catch (e) { setError(e instanceof Error ? e.message : 'This pipeline could not be loaded.') } }, [token, requested, setSearch])
  useEffect(() => { const key = `gio-pipeline-seen-${token}`; const first = !sessionStorage.getItem(key); if (first) sessionStorage.setItem(key, '1'); void load(first); const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 20000); return () => window.clearInterval(id) }, [load, token])
  const setSection = (section: SectionKey) => setSearch(section === 'recruiting' ? {} : { section }, { replace: true })
  const openRow = (row: Row) => navigate(`/cp/${token}/${row.slug}${board?.state === 'live' && board.active_section !== 'recruiting' ? `?section=${board.active_section}` : ''}`)
  if (missing) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#FAF8F3' }}><p style={{ fontSize: 13, color: '#8B8F9E' }}>404 — page not found</p></div>
  if (!board) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#FAF8F3' }}><p style={{ fontSize: 13, color: '#8B8F9E' }}>{error ?? 'Opening the pipeline…'}</p></div>
  if (board.state === 'unavailable') return <Shell brand={board.brand} clientName={board.client_name} workspace={board.workspace_name}><div className="flex flex-col items-center text-center" style={{ margin: 'auto', padding: '60px 20px', maxWidth: 440 }}><h1 className="font-poppins" style={{ fontSize: 20, fontWeight: 600, color: '#1F2230' }}>{board.reason === 'job_closed' ? 'This role has closed' : 'This pipeline isn’t available right now'}</h1><p style={{ fontSize: 13, color: '#5A6072', marginTop: 8 }}>{board.reason === 'job_closed' ? `${board.job_title} is no longer recruiting. ${board.workspace_name} can tell you where things stand.` : `${board.workspace_name} has paused this link. They can share it again whenever you need it.`}</p></div></Shell>
  const section = board.active_section
  if (slug) {
    const back = () => navigate(`/cp/${token}${section === 'recruiting' ? '' : `?section=${section}`}`)
    return <PublicDossier key={`${slug}-${section}`} pipeline={{ token, slug, section, onGone: () => { toast({ description: 'This candidate has moved on from this stage.' }); back() }, renderTop: (nav) => <div className="flex items-center flex-wrap" style={{ gap: 10 }}><button type="button" onClick={back} className="inline-flex items-center" style={{ gap: 6, fontSize: 12.5, color: '#5A6072', fontWeight: 500 }}><ArrowLeft size={14} />Back to pipeline</button>{nav && <span className="inline-flex items-center" style={{ marginLeft: 'auto', gap: 6, fontSize: 12, color: '#8B8F9E' }}><Badge tone={SECTION_TONE[section] as any} size="xs">{nav.section_name}{section === 'recruiting' && nav.stage_name ? ` · ${nav.stage_name}` : ''}</Badge>{nav.index + 1} of {nav.total}<button type="button" aria-label="Previous candidate" title={nav.prev?.name} onClick={() => nav.prev && navigate(`/cp/${token}/${nav.prev.slug}${section === 'recruiting' ? '' : `?section=${section}`}`)} className="inline-flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E7E8EE', background: '#fff' }}><ChevronLeft size={14} /></button><button type="button" aria-label="Next candidate" title={nav.next?.name} onClick={() => nav.next && navigate(`/cp/${token}/${nav.next.slug}${section === 'recruiting' ? '' : `?section=${section}`}`)} className="inline-flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E7E8EE', background: '#fff' }}><ChevronRight size={14} /></button></span>}</div> }} />
  }
  const recruitingTotal = board.sections.find((s) => s.key === 'recruiting')?.count ?? 0
  const recruitingAwaiting = (board.stages ?? []).flatMap((s) => s.candidates).filter((r) => r.public_status === 'awaiting').length
  const applicationAwaiting = board.active_section === 'application' ? (board.rows ?? []).filter((r) => r.public_status === 'awaiting').length : 0
  const awaiting = recruitingAwaiting + applicationAwaiting
  return <Shell brand={board.brand} clientName={board.client_name} workspace={board.workspace_name}><div className="flex flex-col" style={{ padding: '24px 36px 0', flex: 1, minHeight: 0 }}>
    <div className="flex items-end flex-wrap" style={{ gap: 16, marginBottom: 16 }}><div><div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8B8F9E' }}>{board.client_name ? `${board.client_name} · ` : ''}Hiring pipeline</div><h1 className="font-poppins" style={{ fontSize: 24, fontWeight: 600, color: '#1F2230', marginTop: 4 }}>{board.job_title}<span style={{ color: '#D7C5FB' }}>.</span></h1></div>{section === 'recruiting' && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#5A6072' }}>{recruitingTotal} candidate{recruitingTotal === 1 ? '' : 's'} in process{board.client_can_respond && awaiting > 0 ? ` · ${awaiting} awaiting your review` : ''}</span>}</div>
    {board.sections.length > 1 && <div role="tablist" aria-label="Pipeline section" className="grid" style={{ gridTemplateColumns: `repeat(${board.sections.length},minmax(0,1fr))`, gap: 6, padding: 6, borderRadius: 12, background: '#fff', border: '1px solid #E7E8EE', marginBottom: 14 }}>{board.sections.map((item) => { const active = item.key === section; const pastel = PASTELS[SECTION_TONE[item.key]]; return <button key={item.key} role="tab" aria-selected={active} type="button" onClick={() => setSection(item.key)} className="font-poppins flex items-center" style={{ minWidth: 0, padding: '10px 12px', gap: 8, borderRadius: 8, background: active ? pastel.bg : 'transparent', color: active ? pastel.fg : '#5A6072', border: `1px solid ${active ? pastel.bg : 'transparent'}`, fontSize: 12.5, fontWeight: active ? 600 : 500 }}><span className="truncate">{item.label}</span><span style={{ marginLeft: 'auto', padding: '1px 6px', borderRadius: 999, background: active ? pastel.fg : '#F1F0EC', color: active ? '#fff' : '#5A6072', fontFamily: 'Inter', fontSize: 10.5, fontWeight: 600 }}>{item.count}</span></button> })}</div>}
    {section === 'recruiting' ? <div className="flex overflow-x-auto" style={{ gap: 12, paddingBottom: 12, flex: 1 }}>{(board.stages ?? []).map((stage) => <section key={stage.name} className="flex flex-col" style={{ flex: '1 1 0', minWidth: 250, maxWidth: 340, background: '#FAFAF7', border: '1px solid #E7E8EE', borderRadius: 12, overflow: 'hidden' }}><header className="flex items-center" style={{ gap: 8, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #E7E8EE' }}><span style={{ width: 8, height: 8, borderRadius: 9, background: stage.color }} /><span className="font-poppins truncate" style={{ fontSize: 12, fontWeight: 600, color: '#1F2230' }}>{stage.name}</span><span style={{ fontSize: 10.5, color: '#8B8F9E' }}>{stage.candidates.length}</span></header><div style={{ padding: 8, overflowY: 'auto' }}>{stage.candidates.map((c) => <PPCard key={c.slug} card={c} onOpen={() => openRow(c)} />)}</div></section>)}</div> : <FlatTable board={board} onOpen={openRow} />}
  </div></Shell>
}
