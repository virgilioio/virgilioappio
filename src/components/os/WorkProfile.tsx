import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { AffixInput } from '@/components/ui/affix-input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'
import { LoadError } from '@/components/empty/LoadError'
import { motionToken } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  MAX_CAPACITY,
  RATING_WORDS,
  SEGMENTS,
  SPECIALTIES,
  loadLevel,
  takesSegments,
  useRating,
  useSaveRating,
  useSaveWorkProfile,
  useWorkProfile,
  type WorkProfile,
} from '@/lib/os/workProfile'

type SaveState = 'idle' | 'saving' | 'saved' | 'savedAgo' | 'error'

/** §12 autosave states in a reserved line: "Saving…" → "Saved" → "Saved just now", or "Couldn't save · Retry". */
function useSaveState() {
  const [state, setState] = useState<SaveState>('idle')
  const ago = useRef<number | null>(null)
  useEffect(() => () => void (ago.current && window.clearTimeout(ago.current)), [])
  const saved = () => {
    setState('saved')
    if (ago.current) window.clearTimeout(ago.current)
    ago.current = window.setTimeout(() => setState((s) => (s === 'saved' ? 'savedAgo' : s)), 2000)
  }
  return { state, saving: () => setState('saving'), saved, failed: () => setState('error') }
}

function SaveLine({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const label = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'savedAgo' ? 'Saved just now' : null
  return (
    <div className="mt-2 flex min-h-[18px] items-center justify-end font-inter text-[11.5px]" aria-live="polite">
      {state === 'error' ? (
        <span className="gio-autosave-label text-[#B91C1C]">
          Couldn't save ·{' '}
          <button
            type="button"
            onClick={onRetry}
            className="font-medium underline underline-offset-2 transition-colors duration-hover hover:text-text-primary"
          >
            Retry
          </button>
        </span>
      ) : label ? (
        <span key={label} className="gio-autosave-label text-[#8B8F9E]">
          {label}
        </span>
      ) : null}
    </div>
  )
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="font-inter text-[12px] font-medium text-[#1F2230]">{children}</span>
      {hint && <span className="font-inter text-[11.5px] text-[#6B7080]">{hint}</span>}
    </div>
  )
}

/** A chip that toggles one option on or off. */
function ToggleChip({
  on,
  onClick,
  disabled,
  title,
  children,
}: {
  on: boolean
  onClick: () => void
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      aria-label={title}
      className={cn(
        'gio-pressable inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 font-inter text-[12.5px] transition-colors duration-hover disabled:cursor-default',
        on
          ? 'border-[#0d0d09] bg-[#0d0d09] font-medium text-white'
          : 'border-[#E0DDD3] bg-white text-[#5A6072] hover:border-[#C9C6BB] hover:text-[#1F2230]',
      )}
    >
      {on && <Check className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />}
      {children}
    </button>
  )
}

const LOAD_TONE = {
  unset: { bar: '#C9C6BB', text: '#6B7080', word: '' },
  ok: { bar: '#12B886', text: '#0B7A52', word: 'Has room' },
  near: { bar: '#F59E0B', text: '#B45309', word: 'Nearly full' },
  over: { bar: '#C2372B', text: '#C2372B', word: 'Over capacity' },
} as const

/**
 * Load against capacity: "9 of 12 open jobs" with a bar (scaleX, never a
 * width transition) that turns amber near the limit and red over it.
 */
export function LoadBar({ open, max }: { open: number; max: number | null }) {
  const level = loadLevel(open, max)
  const tone = LOAD_TONE[level]
  const fill = max ? Math.min(open / max, 1) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 font-inter text-[12.5px]">
        <span className="tabular-nums text-[#1F2230]">
          {max ? (
            <>
              <span className="font-semibold">{open}</span> of {max} open jobs
            </>
          ) : (
            <>
              <span className="font-semibold">{open}</span> open {open === 1 ? 'job' : 'jobs'}
            </>
          )}
        </span>
        <span className="text-[11.5px] font-medium" style={{ color: tone.text }}>
          {max ? tone.word : 'No capacity set'}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EFEEEA]"
        role="meter"
        aria-label="Load"
        aria-valuemin={0}
        aria-valuemax={max ?? 0}
        aria-valuenow={open}
      >
        <div
          className="gio-progress-fill h-full w-full rounded-full"
          style={{ transform: `scaleX(${fill})`, background: tone.bar, transition: 'transform var(--dur-progress) var(--ease-in-out), background-color var(--dur-hover) ease' }}
        />
      </div>
    </div>
  )
}

/**
 * Work profile on a member's Overview: load against capacity, segments (for
 * TA / Sourcer and Engagement Specialist) and specialties. Chips save at once
 * (optimistic, put back if the save fails); capacity saves after a pause.
 */
export function WorkProfileForm({
  tenantId,
  userId,
  jobRole,
  openJobs,
  jobsReady,
  editable,
}: {
  tenantId: string
  userId: string
  jobRole: string | null
  openJobs: number
  /** False while the person's jobs are still loading: the load never shows 0 before it's known. */
  jobsReady: boolean
  editable: boolean
}) {
  const work = useWorkProfile(tenantId, userId)
  const save = useSaveWorkProfile(tenantId, userId)
  const status = useSaveState()
  const [capDraft, setCapDraft] = useState<string | null>(null)
  const capTimer = useRef<number | null>(null)
  const lastTried = useRef<WorkProfile | null>(null)
  useEffect(() => () => void (capTimer.current && window.clearTimeout(capTimer.current)), [])

  if (work.isError) return <LoadError what="their work profile" compact onRetry={() => void work.refetch()} />
  if (!work.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[34px] w-full" />
        <Skeleton className="h-[56px] w-full" />
        <Skeleton className="h-[92px] w-full" />
      </div>
    )
  }

  const current = work.data
  const commit = (next: WorkProfile) => {
    lastTried.current = next
    status.saving()
    save.mutate(next, { onSuccess: status.saved, onError: status.failed })
  }
  const toggle = <K extends 'segments' | 'specialties'>(key: K, id: WorkProfile[K][number]) => {
    const list = current[key] as string[]
    const nextList = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
    commit({ ...current, [key]: nextList })
  }

  const capText = capDraft ?? (current.max_open_jobs != null ? String(current.max_open_jobs) : '')
  const capNum = capText.trim() === '' ? null : Number(capText)
  const capError =
    capNum !== null && (!Number.isInteger(capNum) || capNum < 1 || capNum > MAX_CAPACITY)
      ? `Enter a whole number from 1 to ${MAX_CAPACITY}.`
      : null
  const flushCap = (text: string) => {
    if (capTimer.current) window.clearTimeout(capTimer.current)
    capTimer.current = null
    const n = text.trim() === '' ? null : Number(text)
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > MAX_CAPACITY)) return
    if (n === current.max_open_jobs) return
    commit({ ...current, max_open_jobs: n })
  }
  const showSegments = takesSegments(jobRole) || current.segments.length > 0

  return (
    <div className="space-y-4">
      <div>
        {jobsReady ? <LoadBar open={openJobs} max={current.max_open_jobs} /> : <Skeleton className="h-[34px] w-full" />}
      </div>

      <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div className="max-w-[200px]">
          <FieldLabel>Capacity</FieldLabel>
          <AffixInput
            numeric
            inputMode="numeric"
            suffix="open jobs"
            aria-label="Capacity, most open jobs"
            placeholder="Not set"
            value={capText}
            invalid={!!capError}
            aria-invalid={!!capError}
            disabled={!editable}
            onChange={(e) => {
              const text = e.target.value.replace(/[^0-9]/g, '').slice(0, 3)
              setCapDraft(text)
              if (capTimer.current) window.clearTimeout(capTimer.current)
              capTimer.current = window.setTimeout(() => flushCap(text), motionToken('--delay-autosave', 600))
            }}
            onBlur={() => {
              flushCap(capText)
              if (!capError) setCapDraft(null)
            }}
          />
          <p className="gio-field-message mt-1 min-h-[18px] font-inter text-[11.5px] text-[#B91C1C]" role={capError ? 'alert' : undefined}>
            {capError ?? ''}
          </p>
          <FieldLabel hint="Anniversaries count from it">Start date</FieldLabel>
          <Input
            type="date"
            aria-label="Start date"
            className="tabular-nums"
            min="1980-01-01"
            max="2100-01-01"
            value={current.start_date ?? ''}
            disabled={!editable}
            onChange={(e) => {
              const v = e.target.value || null
              if (v === current.start_date || (v && (v < '1980-01-01' || v > '2100-01-01'))) return
              commit({ ...current, start_date: v })
            }}
          />
        </div>

        {showSegments && (
          <div>
            <FieldLabel hint="Company sizes they recruit for">Segments</FieldLabel>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Segments">
              {SEGMENTS.map((s) => (
                <ToggleChip
                  key={s.id}
                  on={current.segments.includes(s.id)}
                  disabled={!editable}
                  title={`${s.label}, ${s.hint}`}
                  onClick={() => toggle('segments', s.id)}
                >
                  {s.label}
                  <span className={cn('hidden text-[11.5px] sm:inline', current.segments.includes(s.id) ? 'text-white/70' : 'text-[#8B8F9E]')}>
                    {s.hint}
                  </span>
                </ToggleChip>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <FieldLabel hint="The kinds of roles they fill best">Specialties</FieldLabel>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Specialties">
          {SPECIALTIES.map((s) => (
            <ToggleChip key={s.id} on={current.specialties.includes(s.id)} disabled={!editable} onClick={() => toggle('specialties', s.id)}>
              {s.label}
            </ToggleChip>
          ))}
        </div>
      </div>

      <SaveLine state={status.state} onRetry={() => lastTried.current && commit(lastTried.current)} />
    </div>
  )
}

/**
 * A manager's 1-5 rating with a private note (People & Access admins only;
 * the person never sees it, and nobody rates themself). The rating saves on
 * click; the note after a pause or when it loses focus.
 */
export function RatingForm({
  tenantId,
  userId,
  firstName,
  isSelf,
  nameOf,
}: {
  tenantId: string
  userId: string
  firstName: string
  isSelf: boolean
  nameOf: (userId: string | null) => string
}) {
  const rating = useRating(tenantId, userId, !isSelf)
  const save = useSaveRating(tenantId, userId)
  const status = useSaveState()
  const segRef = useSegmentLayer<HTMLDivElement>()
  const [note, setNote] = useState<string | null>(null)
  const noteTimer = useRef<number | null>(null)
  const lastTried = useRef<{ rating: number | null; note: string | null } | null>(null)
  useEffect(() => () => void (noteTimer.current && window.clearTimeout(noteTimer.current)), [])

  if (isSelf) {
    return <p className="font-inter text-[12.5px] text-[#6B7080]">You can't rate yourself. Another admin can.</p>
  }
  if (rating.isError) return <LoadError what="the rating" compact onRetry={() => void rating.refetch()} />
  if (rating.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[34px] w-full" />
        <Skeleton className="h-[72px] w-full" />
      </div>
    )
  }

  const value = rating.data?.rating ?? null
  const savedNote = rating.data?.note ?? ''
  const noteText = note ?? savedNote
  const commit = (next: { rating: number | null; note: string | null }) => {
    lastTried.current = next
    status.saving()
    save.mutate(next, { onSuccess: status.saved, onError: status.failed })
  }
  const flushNote = (text: string) => {
    if (noteTimer.current) window.clearTimeout(noteTimer.current)
    noteTimer.current = null
    if (text.trim() === savedNote.trim()) return
    commit({ rating: value, note: text.trim() || null })
  }

  return (
    <div>
      <div
        ref={segRef}
        role="radiogroup"
        aria-label={`Rate ${firstName} from 1 to 5`}
        className="gio-seg flex w-full"
        style={{ gap: 2, padding: 3, background: '#ECEAE2', borderRadius: 9 }}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${n}, ${RATING_WORDS[n]}`}
              data-seg-option
              data-active={active || undefined}
              onClick={() => commit({ rating: active ? null : n, note: noteText.trim() || null })}
              className="flex-1 font-inter tabular-nums"
              style={{
                padding: '6px 0',
                borderRadius: 7,
                border: 'none',
                fontSize: 13,
                fontWeight: 500,
                color: active ? '#fff' : '#5A6072',
                background: 'transparent',
                transition: 'color var(--dur-hover) ease',
              }}
            >
              {n}
            </button>
          )
        })}
        <SegmentLayer fill="#0d0d09" />
      </div>
      <div className="mt-1.5 flex min-h-[18px] items-baseline justify-between gap-3 font-inter text-[11.5px]">
        <span className="font-medium text-[#1F2230]">{value ? RATING_WORDS[value] : 'Not rated yet'}</span>
        {rating.data?.rated_at && (
          <span className="truncate text-[#6B7080]">
            {nameOf(rating.data.rated_by)} ·{' '}
            {new Date(rating.data.rated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </div>

      <div className="mt-3">
        <FieldLabel>Note</FieldLabel>
        <Textarea
          aria-label="Rating note"
          placeholder={`What's behind the rating, for other admins`}
          value={noteText}
          maxLength={2000}
          onChange={(e) => {
            const text = e.target.value
            setNote(text)
            if (noteTimer.current) window.clearTimeout(noteTimer.current)
            noteTimer.current = window.setTimeout(() => flushNote(text), motionToken('--delay-autosave', 600))
          }}
          onBlur={() => flushNote(noteText)}
          className="min-h-[72px] text-[13px]"
        />
      </div>
      <p className="mt-2 font-inter text-[11.5px] text-[#6B7080]">
        Only People &amp; Access admins see this. {firstName} doesn't.
      </p>
      <SaveLine state={status.state} onRetry={() => lastTried.current && commit(lastTried.current)} />
    </div>
  )
}
