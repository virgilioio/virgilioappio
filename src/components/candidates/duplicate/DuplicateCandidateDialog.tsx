import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, X, GitMerge, UserPlus, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusPill } from './StatusPill'
import { DossierPane } from './DossierPane'
import { MergePane } from './MergePane'
import { useDuplicateContext } from './useDuplicateContext'
import type { DupStatus, Resolution } from './types'

interface DuplicateCandidateDialogProps {
  isOpen: boolean
  existingCandidateId: string | null
  incoming: Record<string, any> | null
  incomingFileName?: string | null
  incomingProvenance?: string | null
  isSubmitting?: boolean
  onCancel: () => void
  onMerge: (resolutions: Record<string, Resolution>) => void | Promise<void>
  onNotDuplicate: () => void | Promise<void>
  onOpenProfile?: () => void
}

export function DuplicateCandidateDialog({
  isOpen,
  existingCandidateId,
  incoming,
  incomingFileName = null,
  incomingProvenance = null,
  isSubmitting = false,
  onCancel,
  onMerge,
  onNotDuplicate,
  onOpenProfile,
}: DuplicateCandidateDialogProps) {
  const { context, isLoading, error } = useDuplicateContext(existingCandidateId, incoming, isOpen)
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({})

  // every conflict defaults to the value already on file
  useEffect(() => {
    if (!context) return
    const next: Record<string, Resolution> = {}
    for (const f of context.fields) if (f.classification === 'conflict') next[f.key] = 'existing'
    setResolutions(next)
  }, [context])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onCancel])

  const conflicts = useMemo(
    () => (context?.fields ?? []).filter((f) => f.classification === 'conflict'),
    [context],
  )
  const taking = conflicts.filter((f) => resolutions[f.key] === 'incoming').length

  const summary = useMemo(() => {
    const n = conflicts.length
    const noun = n === 1 ? 'conflict' : 'conflicts'
    if (n === 0) return 'Nothing to decide · every value on file is kept'
    if (taking === 0) return `${n} ${noun} · keeping every value on file`
    return `${n} ${noun} · ${taking} of ${n} taking the incoming value`
  }, [conflicts.length, taking])

  const canWrite = context?.permissions.can_merge !== false

  const headerStatuses = useMemo(() => {
    if (!context) return [] as DupStatus[]
    const live = context.applications.filter((a) => a.status === 'active' || a.status === 'offered' || a.status === 'hired')
    return [...new Set(live.map((a) => a.status))]
  }, [context])

  const openJobCount = useMemo(
    () => (context?.applications ?? []).filter((a) => a.job_status === 'open').length,
    [context],
  )

  const footprintSentence = useMemo(() => {
    if (!context) return ''
    const clauses: string[] = []
    const n = context.counts.applications
    if (n) clauses.push(`${n} application${n === 1 ? '' : 's'}`)
    if (context.applications.some((a) => a.status === 'offered')) clauses.push('a live offer')
    if (context.applications.some((a) => a.status === 'hired')) clauses.push('a placement')
    if (context.applications.some((a) => a.status === 'rejected')) clauses.push('a rejection on file')
    const list = clauses.length
      ? clauses.length === 1
        ? clauses[0]
        : `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`
      : 'no applications yet'
    return `is already in your database with ${list}. Read the record on the left before you decide — merging is not reversible from here.`
  }, [context])

  if (!isOpen) return null

  const body = (
    <div
      className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(13,13,9,0.34)' }}
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Duplicate candidate detected"
        className="flex min-w-0 flex-col overflow-hidden rounded-[18px] bg-dup-paper"
        style={{
          width: 1040,
          maxWidth: '100%',
          height: 'calc(100% - 16px)',
          maxHeight: 840,
          boxShadow: '0 28px 90px -14px rgba(13,13,9,.42), 0 0 0 1px rgba(13,13,9,.04)',
        }}
      >
        {/* header */}
        <div className="shrink-0 border-b border-dup-hairline bg-dup-paper" style={{ padding: '14px 18px 12px' }}>
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className="flex shrink-0 items-center justify-center rounded-[11px] bg-dup-purple-soft"
              style={{ width: 38, height: 38 }}
            >
              <Copy size={16} className="text-dup-purple" />
            </span>
            <div className="min-w-0 flex-1">
              <div
                className="font-inter uppercase text-dup-subtle"
                style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.09em' }}
              >
                Add candidate · Match found
              </div>
              <h2
                className="font-poppins text-dup-ink"
                style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.035em' }}
              >
                Duplicate candidate detected<span className="text-dup-purple-period">.</span>
              </h2>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {headerStatuses.map((s) => <StatusPill key={s} status={s} />)}
              {openJobCount > 0 && (
                <span className="font-inter text-dup-subtle" style={{ fontSize: 11.5 }}>
                  in {openJobCount === 1 ? 'one open job' : openJobCount === 2 ? 'two open jobs' : `${openJobCount} open jobs`}
                </span>
              )}
              <button
                type="button"
                onClick={onCancel}
                aria-label="Close"
                className="flex items-center justify-center rounded-lg text-dup-muted hover:bg-dup-canvas"
                style={{ width: 28, height: 28 }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {context && (
            <p className="mt-2 font-inter text-dup-muted" style={{ fontSize: 12.5, maxWidth: '94ch' }}>
              <span className="text-dup-text" style={{ fontWeight: 600 }}>
                {context.candidate.candidate_name}
              </span>{' '}
              {footprintSentence}
            </p>
          )}
        </div>

        {/* body */}
        <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: 'minmax(0,400px) minmax(0,1fr)' }}>
          {isLoading && (
            <div className="col-span-2 flex items-center justify-center gap-2 font-inter text-dup-muted" style={{ fontSize: 12.5 }}>
              <Loader2 size={15} className="animate-spin" />
              Reading the record on file…
            </div>
          )}
          {!isLoading && error && (
            <div className="col-span-2 flex flex-col items-center justify-center gap-2 px-8 text-center">
              <AlertTriangle size={18} className="text-dup-warn-icon" />
              <div className="font-poppins text-dup-text" style={{ fontSize: 15, fontWeight: 600 }}>
                We could not read the existing record
              </div>
              <div className="font-inter text-dup-muted" style={{ fontSize: 12.5 }}>{error}</div>
            </div>
          )}
          {!isLoading && !error && context && (
            <>
              <DossierPane context={context} onOpenProfile={onOpenProfile} />
              <MergePane
                context={context}
                resolutions={resolutions}
                setResolution={(key, r) => setResolutions((prev) => ({ ...prev, [key]: r }))}
                incomingFileName={incomingFileName}
                incomingProvenance={incomingProvenance}
                disabled={!canWrite || isSubmitting}
              />
            </>
          )}
        </div>

        {/* footer */}
        <div
          className="flex shrink-0 items-center gap-4 border-t border-dup-hairline bg-dup-canvas-alt"
          style={{ padding: '12px 22px' }}
        >
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <GitMerge size={13} className="mt-0.5 shrink-0 text-dup-subtle" />
            <div className="min-w-0">
              <div className="font-inter text-dup-text break-words" style={{ fontSize: 11.5, fontWeight: 500 }}>
                {summary}
              </div>
              <div className="font-inter text-dup-subtle break-words" style={{ fontSize: 10.5 }}>
                {canWrite
                  ? 'Applications, interviews, notes and files are never dropped. The change is written to the audit log.'
                  : `Your role cannot merge candidate records. Ask ${context?.permissions.ask ?? 'a workspace admin'} to do it.`}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={UserPlus}
              disabled={!canWrite || isSubmitting || isLoading}
              onClick={() => onNotDuplicate()}
            >
              Not the same person
            </Button>
            <Button
              type="button"
              size="sm"
              icon={GitMerge}
              loading={isSubmitting}
              disabled={!canWrite || isLoading || !!error}
              onClick={() => onMerge(resolutions)}
            >
              Merge into existing record
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(body, document.body)
}

export default DuplicateCandidateDialog
