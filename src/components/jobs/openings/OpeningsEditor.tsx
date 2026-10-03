import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Lock, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'
import {
  OpeningRow,
  nextReqId,
  tmpId,
  validateOpenings,
  setupSummaryText,
} from '@/lib/jobOpenings'
import { fetchWorkspaceReqIds, isReqIdTaken, useJobOpenings } from '@/hooks/useJobOpenings'

const db = supabase as any

const GRID = {
  create: '26px minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr) 30px',
  setup: '26px minmax(0,1.05fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.25fr) 30px',
}

const inputCls =
  'h-[34px] w-full rounded-lg border border-[#E0DDD3] bg-white px-[10px] font-inter text-[12.5px] text-[#1F2230] outline-none transition-[border-color,box-shadow] hover:border-[#CFCBBF] focus:border-[#B9B6AC] focus:shadow-[0_0_0_3px_rgba(31,34,48,0.06)] focus-visible:ring-0 [&::-webkit-calendar-picker-indicator]:opacity-45 disabled:cursor-not-allowed disabled:opacity-60'
const errCls = '!border-[#FECACA] shadow-[0_0_0_3px_rgba(250,82,82,0.08)]'

function prettyDate(d?: string) {
  if (!d) return '—'
  try {
    return format(parseISO(d), 'MMM d, yyyy')
  } catch {
    return d
  }
}

interface CommonProps {
  readOnly?: boolean
}
type CreateProps = CommonProps & {
  mode: 'create'
  value: OpeningRow[]
  onChange: (rows: OpeningRow[]) => void
  /** Reports whether any row currently has an error. */
  onValidityChange?: (valid: boolean) => void
}
type SetupProps = CommonProps & { mode: 'setup'; jobId: string }

export function OpeningsEditor(props: CreateProps | SetupProps) {
  return props.mode === 'create' ? <CreateEditor {...props} /> : <SetupEditor {...props} />
}

/* ------------------------------------------------------------ CREATE MODE */

function CreateEditor({ value, onChange, onValidityChange, readOnly }: CreateProps) {
  const [taken, setTaken] = useState<Record<string, boolean>>({})
  const [workspaceIds, setWorkspaceIds] = useState<string[]>([])
  const focusId = useRef<string | null>(null)

  useEffect(() => {
    fetchWorkspaceReqIds().then((ids) => {
      setWorkspaceIds(ids)
      if (value.length === 0) {
        onChange([
          { id: tmpId(), req_id: nextReqId(ids), target_hire_date: '', target_start_date: '', status: 'open' },
        ])
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const errors = useMemo(() => validateOpenings(value, taken), [value, taken])
  useEffect(() => {
    onValidityChange?.(value.length > 0 && Object.keys(errors).length === 0)
  }, [errors, value.length, onValidityChange])

  const patch = (id: string, p: Partial<OpeningRow>) => onChange(value.map((r) => (r.id === id ? { ...r, ...p } : r)))

  const add = () => {
    const last = value[value.length - 1]
    const row: OpeningRow = {
      id: tmpId(),
      req_id: nextReqId([...workspaceIds, ...value.map((r) => r.req_id)]),
      target_hire_date: last?.target_hire_date || '',
      target_start_date: last?.target_start_date || '',
      status: 'open',
    }
    focusId.current = row.id
    onChange([...value, row])
  }

  const checkServer = async (row: OpeningRow) => {
    const k = row.req_id.trim().toLowerCase()
    if (!k) return
    const t = await isReqIdTaken(row.req_id)
    setTaken((prev) => ({ ...prev, [k]: t }))
  }

  const n = value.length
  return (
    <EditorShell
      mode="create"
      rows={value}
      errors={errors}
      readOnly={readOnly}
      focusId={focusId}
      onPatch={patch}
      onBlurReq={checkServer}
      onRemove={(id) => onChange(value.filter((r) => r.id !== id))}
      onAdd={add}
      summary={`${n} ${n === 1 ? 'opening' : 'openings'} · this job can make ${n} ${n === 1 ? 'hire' : 'hires'}`}
    />
  )
}

/* ------------------------------------------------------------- SETUP MODE */

function SetupEditor({ jobId, readOnly }: SetupProps) {
  const { openings, isLoading, refetch } = useJobOpenings(jobId)
  const [rows, setRows] = useState<OpeningRow[]>([])
  const [taken, setTaken] = useState<Record<string, boolean>>({})
  const [serverErr, setServerErr] = useState<Record<string, string>>({})
  const [workspaceIds, setWorkspaceIds] = useState<string[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const rowsRef = useRef<OpeningRow[]>([])
  const focusId = useRef<string | null>(null)
  const hydrated = useRef(false)

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  useEffect(() => {
    if (isLoading) return
    // Merge server status into local rows without clobbering in-flight edits.
    setRows((prev) => {
      if (!hydrated.current) {
        hydrated.current = true
        return openings
      }
      const byId = new Map(openings.map((o) => [o.id, o]))
      return prev.map((r) => {
        const s = byId.get(r.id)
        return s ? { ...r, status: s.status, candidate_name: s.candidate_name } : r
      })
    })
  }, [openings, isLoading])

  useEffect(() => {
    fetchWorkspaceReqIds().then(setWorkspaceIds)
    return () => Object.values(timers.current).forEach(clearTimeout)
  }, [])

  const errors = useMemo(() => {
    const e = validateOpenings(rows, taken)
    for (const [id, m] of Object.entries(serverErr)) if (!e[id]) e[id] = { message: m, fields: ['req'] }
    return e
  }, [rows, taken, serverErr])

  const save = async (id: string) => {
    const row = rowsRef.current.find((r) => r.id === id)
    if (!row) return
    const local = validateOpenings(rowsRef.current, taken)
    if (local[id]) return
    const payload = {
      req_id: row.req_id.trim().toUpperCase(),
      target_hire_date: row.target_hire_date,
      target_start_date: row.target_start_date,
      position: rowsRef.current.findIndex((r) => r.id === id),
    }
    const res = row.persisted
      ? await db.from('job_openings').update(payload).eq('id', id)
      : await db.from('job_openings').insert({ ...payload, job_id: jobId }).select('id').single()
    if (res.error) {
      setServerErr((p) => ({ ...p, [id]: cleanErr(res.error.message) }))
      return
    }
    setServerErr((p) => {
      const { [id]: _, ...rest } = p
      return rest
    })
    if (!row.persisted && res.data?.id) {
      const newId = res.data.id as string
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, id: newId, persisted: true } : r)))
    }
    refetch()
  }

  const schedule = (id: string) => {
    clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(() => save(id), 600)
  }

  const patch = (id: string, p: Partial<OpeningRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)))
    setServerErr((s) => {
      const { [id]: _, ...rest } = s
      return rest
    })
    schedule(id)
  }

  const add = () => {
    const last = rows[rows.length - 1]
    const row: OpeningRow = {
      id: tmpId(),
      req_id: nextReqId([...workspaceIds, ...rows.map((r) => r.req_id)]),
      target_hire_date: last?.target_hire_date || '',
      target_start_date: last?.target_start_date || '',
      status: 'open',
    }
    focusId.current = row.id
    setRows((prev) => [...prev, row])
    schedule(row.id)
  }

  const remove = async (id: string) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    clearTimeout(timers.current[id])
    if (!row.persisted) {
      setRows((prev) => prev.filter((r) => r.id !== id))
      return
    }
    const { error } = await db.from('job_openings').delete().eq('id', id)
    if (error) {
      setServerErr((p) => ({ ...p, [id]: cleanErr(error.message) }))
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
    refetch()
  }

  const checkServer = async (row: OpeningRow) => {
    const k = row.req_id.trim().toLowerCase()
    if (!k) return
    const t = await isReqIdTaken(row.req_id, row.id)
    setTaken((prev) => ({ ...prev, [k]: t }))
  }

  if (isLoading) {
    return <div className="py-6 text-center font-inter text-[12px] text-[#8B8F9E]">Loading openings…</div>
  }

  return (
    <EditorShell
      mode="setup"
      rows={rows}
      errors={errors}
      readOnly={readOnly}
      focusId={focusId}
      onPatch={patch}
      onBlurReq={checkServer}
      onRemove={remove}
      onAdd={add}
      summary={setupSummaryText(rows)}
    />
  )
}

function cleanErr(m: string) {
  if (/job_openings_tenant_req_uidx|duplicate key/i.test(m)) return 'This Req ID is already used by another opening.'
  return m
}

/* ------------------------------------------------------------------ SHELL */

function EditorShell({
  mode,
  rows,
  errors,
  readOnly,
  focusId,
  onPatch,
  onBlurReq,
  onRemove,
  onAdd,
  summary,
}: {
  mode: 'create' | 'setup'
  rows: OpeningRow[]
  errors: Record<string, { message: string; fields: Array<'req' | 'hire' | 'start'> }>
  readOnly?: boolean
  focusId: React.MutableRefObject<string | null>
  onPatch: (id: string, p: Partial<OpeningRow>) => void
  onBlurReq: (row: OpeningRow) => void
  onRemove: (id: string) => void
  onAdd: () => void
  summary: string
}) {
  const grid = GRID[mode]
  const labels = ['Req ID', 'Target hire date', 'Target start date', ...(mode === 'setup' ? ['Status'] : [])]

  return (
    <TooltipProvider delayDuration={150}>
      <div>
        <div
          className="grid items-end"
          style={{ gridTemplateColumns: grid, gap: 10, paddingBottom: 8, borderBottom: '1px solid #F1F0EC' }}
        >
          <span />
          {labels.map((l) => (
            <span
              key={l}
              className="font-inter uppercase"
              style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', color: '#8B8F9E' }}
            >
              {l}
              {l !== 'Status' && <span style={{ color: '#FA5252' }}> *</span>}
            </span>
          ))}
          <span />
        </div>

        {rows.map((r, i) => {
          const err = errors[r.id]
          const locked = r.status !== 'open'
          const filled = r.status === 'filled'
          const name = r.candidate_name || 'a candidate'
          const removeReason = filled
            ? `Filled by ${name} — this opening can't be removed.`
            : r.status === 'offer'
              ? `Reserved by ${name}'s offer — withdraw the offer to remove it.`
              : rows.length <= 1
                ? 'A job needs at least one opening.'
                : null
          const has = (f: 'req' | 'hire' | 'start') => !!err?.fields.includes(f)
          return (
            <div key={r.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F6F5F1' : 'none', padding: '10px 0' }}>
              <div className="grid items-center" style={{ gridTemplateColumns: grid, gap: 10 }}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-mono cursor-default" style={{ fontSize: 11, color: '#8B8F9E' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Opening ID · {r.persisted ? r.id : 'not saved yet'}</TooltipContent>
                </Tooltip>

                {locked ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="flex items-center gap-1.5 font-mono"
                        style={{ height: 34, background: '#FAFAF7', border: '1px solid #EDEBE5', borderRadius: 8, padding: '0 10px', fontSize: 12, color: '#1F2230' }}
                      >
                        <Lock style={{ width: 12, height: 12, color: '#8B8F9E' }} />
                        <span className="truncate">{r.req_id}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Locked — linked to a candidate</TooltipContent>
                  </Tooltip>
                ) : (
                  <input
                    className={cn(inputCls, 'font-mono text-[12px] uppercase', has('req') && errCls)}
                    value={r.req_id}
                    placeholder="REQ-0000"
                    disabled={readOnly}
                    autoFocus={focusId.current === r.id}
                    onFocus={() => {
                      if (focusId.current === r.id) focusId.current = null
                    }}
                    onChange={(e) => onPatch(r.id, { req_id: e.target.value.toUpperCase() })}
                    onBlur={() => onBlurReq(r)}
                  />
                )}

                {(['target_hire_date', 'target_start_date'] as const).map((k) =>
                  filled ? (
                    <span key={k} className="font-inter" style={{ fontSize: 12.5, color: '#5A6072' }}>
                      {prettyDate(r[k])}
                    </span>
                  ) : (
                    <input
                      key={k}
                      type="date"
                      className={cn(inputCls, has(k === 'target_hire_date' ? 'hire' : 'start') && errCls)}
                      value={r[k] || ''}
                      disabled={readOnly}
                      onChange={(e) => onPatch(r.id, { [k]: e.target.value } as any)}
                    />
                  ),
                )}

                {mode === 'setup' && (
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge tone={filled ? 'green' : r.status === 'offer' ? 'yellow' : 'neutral'} dot size="sm">
                      {filled ? 'Filled' : r.status === 'offer' ? 'Offer out' : 'Open'}
                    </Badge>
                    {locked && r.candidate_name && (
                      <>
                        <span
                          className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#EDE4FF] font-poppins text-[#5B21B6]"
                          style={{ width: 18, height: 18, fontSize: 8.5, fontWeight: 600 }}
                        >
                          {initials(r.candidate_name)}
                        </span>
                        <span className="truncate font-inter" style={{ fontSize: 12, color: '#1F2230' }}>
                          {r.candidate_name}
                        </span>
                      </>
                    )}
                  </div>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <button
                        type="button"
                        aria-label="Remove opening"
                        disabled={!!removeReason || readOnly}
                        onClick={() => onRemove(r.id)}
                        className="inline-flex items-center justify-center rounded-lg text-[#8B8F9E] transition-colors hover:bg-[#FEF2F2] hover:text-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#8B8F9E]"
                        style={{ width: 30, height: 30 }}
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </span>
                  </TooltipTrigger>
                  {removeReason && <TooltipContent>{removeReason}</TooltipContent>}
                </Tooltip>
              </div>
              {err && (
                <div className="font-inter" style={{ paddingLeft: 36, marginTop: 6, fontSize: 11, fontWeight: 500, color: '#E03131' }}>
                  {err.message}
                </div>
              )}
            </div>
          )
        })}

        <div className="flex items-center justify-between gap-3" style={{ paddingTop: 12, borderTop: '1px solid #F1F0EC' }}>
          {!readOnly ? (
            <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={onAdd}>
              Add opening
            </Button>
          ) : (
            <span />
          )}
          <span className="font-inter text-right" style={{ fontSize: 11.5, color: '#8B8F9E' }}>
            {summary}
          </span>
        </div>
      </div>
    </TooltipProvider>
  )
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}
