import { useState, useEffect, useMemo, useRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  ArrowRightLeft,
  ArrowRight,
  CopyPlus,
  Shield,
  LogOut,
  Search,
  X,
  Briefcase,
  Check,
  History,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useJobs } from '@/hooks/useJobs'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { useCandidateTransfer } from '@/hooks/useCandidateTransfer'
import type { JobStage } from '@/hooks/useJobStages'

type HiringPlanStageOption = {
  jhsId: string
  stage: JobStage
  position: number
  customStageName?: string | null
}

interface AddOrTransferCandidateDialogProps {
  candidateId: string
  candidateName: string
  currentJobId: string
  currentJobTitle: string
  trigger?: React.ReactNode
  hasNextCandidate?: boolean
  onNavigateNext?: () => void
  onClose?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type Mode = 'add' | 'transfer'

export function AddOrTransferCandidateDialog({
  candidateId,
  candidateName,
  currentJobId,
  currentJobTitle,
  trigger,
  hasNextCandidate,
  onNavigateNext,
  onClose,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AddOrTransferCandidateDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next)
    controlledOnOpenChange?.(next)
  }

  const [mode, setMode] = useState<Mode>('add')
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [selectedStageId, setSelectedStageId] = useState<string>('')
  const [ack, setAck] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement | null>(null)

  const { jobs, isLoading: jobsLoading } = useJobs()
  const { loadHiringPlanInstances } = useJobHiringPlan()
  const { addToJob, transferCandidate, isTransferring } = useCandidateTransfer()

  const firstName = useMemo(
    () => (candidateName || '').trim().split(/\s+/)[0] || candidateName || 'candidate',
    [candidateName]
  )

  useEffect(() => {
    if (open) {
      setMode('add')
      setSelectedJobId('')
      setSelectedStageId('')
      setAck(false)
      setQuery('')
      // autofocus search
      setTimeout(() => searchRef.current?.focus(), 40)
    }
  }, [open])

  // Reset ack when mode changes
  useEffect(() => {
    setAck(false)
  }, [mode])

  // Load stages when job changes; default to first stage silently
  useEffect(() => {
    if (!selectedJobId) {
      setSelectedStageId('')
      return
    }
    let cancelled = false
    loadHiringPlanInstances(selectedJobId).then((loaded: HiringPlanStageOption[]) => {
      if (cancelled) return
      if (loaded && loaded.length > 0) setSelectedStageId(loaded[0].jhsId)
      else setSelectedStageId('')
    })
    return () => {
      cancelled = true
    }
  }, [selectedJobId, loadHiringPlanInstances])

  const availableJobs = useMemo(
    () =>
      (jobs || []).filter(
        (job) => job.id !== currentJobId && job.status === 'open'
      ),
    [jobs, currentJobId]
  )

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return availableJobs
    return availableJobs.filter((j) => {
      const hay = `${j.title || ''} ${j.department || ''} ${j.location || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [availableJobs, query])

  const selectedJob = availableJobs.find((j) => j.id === selectedJobId)

  const canConfirm =
    !!selectedJobId &&
    !!selectedStageId &&
    !isTransferring &&
    (mode === 'add' || ack)

  const handleConfirm = async () => {
    if (!canConfirm || !selectedJob) return
    if (mode === 'add') {
      const result = await addToJob({
        candidateId,
        candidateName,
        targetJobId: selectedJobId,
        targetJobTitle: selectedJob.title || '',
        targetStageId: selectedStageId,
      })
      if (result.success) {
        setOpen(false)
        window.open(`/jobs/${selectedJobId}?candidate=${candidateId}`, '_blank')
      }
    } else {
      const result = await transferCandidate({
        candidateId,
        candidateName,
        sourceJobId: currentJobId,
        sourceJobTitle: currentJobTitle,
        targetJobId: selectedJobId,
        targetJobTitle: selectedJob.title || '',
        targetStageId: selectedStageId,
      })
      if (result.success) {
        window.open(`/jobs/${selectedJobId}?candidate=${candidateId}`, '_blank')
        setOpen(false)
        if (hasNextCandidate && onNavigateNext) onNavigateNext()
        else if (onClose) onClose()
      }
    }
  }

  const isTransfer = mode === 'transfer'
  const panelBg = isTransfer ? '#FFF9EE' : '#FAF8FF'
  const panelBorder = isTransfer ? '#F5E4BE' : '#EDE4FF'
  const tileBg = isTransfer ? '#FBEBC6' : '#EDE4FF'
  const tileFg = isTransfer ? '#B45309' : '#6F3FF5'

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogPrimitive.Trigger asChild>
          {trigger || (
            <Button variant="secondary" size="sm" icon={ArrowRightLeft}>
              Add / Transfer to Job
            </Button>
          )}
        </DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[60] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          style={{ background: 'rgba(13,13,9,0.34)' }}
        />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{
            width: 600,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 48px)',
            background: '#ffffff',
            borderRadius: 18,
            boxShadow:
              '0 28px 90px -14px rgba(13,13,9,0.42), 0 0 0 1px rgba(13,13,9,0.04)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            Add or transfer {firstName}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Add {firstName} to another job or transfer them entirely.
          </DialogPrimitive.Description>

          {/* HEADER */}
          <header
            className="flex items-start gap-3 shrink-0"
            style={{
              padding: '20px 24px 18px',
              borderBottom: '1px solid #F1F0EC',
            }}
          >
            <span
              className="flex items-center justify-center shrink-0"
              style={{
                height: 38,
                width: 38,
                background: '#EDE4FF',
                borderRadius: 11,
                color: '#6F3FF5',
              }}
            >
              <ArrowRightLeft style={{ height: 17, width: 17 }} strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <div
                className="font-inter"
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: '0.09em',
                  color: '#8B8F9E',
                  textTransform: 'uppercase',
                }}
              >
                Move candidate
              </div>
              <h2
                className="font-poppins truncate"
                style={{
                  fontSize: 19,
                  fontWeight: 600,
                  letterSpacing: '-0.035em',
                  color: '#0d0d09',
                  marginTop: 2,
                }}
              >
                Add or transfer {firstName}
                <span style={{ color: '#D7C5FB' }}>.</span>
              </h2>
            </div>
            <DialogPrimitive.Close
              className="flex items-center justify-center shrink-0 rounded-md transition-colors hover:bg-[#F6F5F1]"
              style={{ height: 30, width: 30, color: '#8B8F9E', background: 'transparent' }}
              aria-label="Close"
            >
              <X style={{ height: 17, width: 17 }} strokeWidth={2} />
            </DialogPrimitive.Close>
          </header>

          {/* BODY */}
          <div
            className="flex-1 min-h-0 overflow-y-auto"
            style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            {/* 1 · Segmented control */}
            <div
              className="flex"
              style={{
                background: '#F1F0EC',
                borderRadius: 12,
                padding: 4,
                gap: 4,
              }}
            >
              {(
                [
                  { key: 'add' as Mode, label: 'Add to job', Icon: CopyPlus },
                  { key: 'transfer' as Mode, label: 'Transfer over', Icon: ArrowRightLeft },
                ]
              ).map(({ key, label, Icon }) => {
                const active = mode === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMode(key)}
                    className="font-poppins flex items-center justify-center transition-all"
                    style={{
                      flex: 1,
                      height: 38,
                      borderRadius: 9,
                      gap: 7,
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      color: active ? '#fffcf9' : '#5A6072',
                      background: active ? '#0d0d09' : 'transparent',
                      boxShadow: active ? '0 1px 2px rgba(13,13,9,0.14)' : 'none',
                      border: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <Icon style={{ height: 15, width: 15 }} strokeWidth={2} />
                    {label}
                  </button>
                )
              })}
            </div>

            {/* 2 · Outcome panel */}
            <div
              style={{
                background: panelBg,
                border: `1px solid ${panelBorder}`,
                borderRadius: 12,
                padding: 14,
              }}
            >
              {/* Move diagram */}
              <div className="flex items-stretch" style={{ gap: 10 }}>
                {/* Left pill = current job */}
                <MovePill
                  flex
                  label={isTransfer ? 'Removed from' : 'Stays in'}
                  value={currentJobTitle}
                  bg={isTransfer ? '#FFF5F5' : '#ffffff'}
                  border={isTransfer ? '#F5C6C6' : '#E0DDD3'}
                  labelColor={isTransfer ? '#B4362F' : '#1F2230'}
                  valueColor={isTransfer ? '#B4362F' : '#1F2230'}
                  strike={isTransfer}
                />
                <div className="flex items-center justify-center">
                  <ArrowRight
                    style={{ height: 16, width: 16, color: isTransfer ? '#B4362F' : '#8B8F9E' }}
                    strokeWidth={2}
                  />
                </div>
                {/* Right pill = target job */}
                <MovePill
                  flex
                  label="Target job"
                  value={selectedJob?.title || 'Pick a job below'}
                  bg={selectedJob ? '#F5EFFF' : '#FAFAF7'}
                  border={selectedJob ? '#DFCBFB' : '#E7E8EE'}
                  labelColor={selectedJob ? '#5B21B6' : '#1F2230'}
                  valueColor={selectedJob ? '#5B21B6' : '#B5B9C4'}
                />
              </div>

              <div style={{ height: 1, background: panelBorder, margin: '13px 0 12px' }} />

              {/* Bullets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(isTransfer
                  ? [
                      {
                        Icon: ArrowRightLeft,
                        node: (
                          <>
                            Moves the <strong>entire history</strong> — comments, emails,
                            scorecards, and activity travel with her.
                          </>
                        ),
                      },
                      {
                        Icon: LogOut,
                        node: (
                          <>
                            Removes {firstName} from <strong>{currentJobTitle}</strong>. This
                            can't be undone.
                          </>
                        ),
                      },
                    ]
                  : [
                      {
                        Icon: CopyPlus,
                        node: (
                          <>
                            Creates a <strong>second application</strong> — {firstName} appears
                            in both jobs at once.
                          </>
                        ),
                      },
                      {
                        Icon: Shield,
                        node: (
                          <>
                            Comments, emails, and scorecards <strong>are not copied</strong>{' '}
                            between jobs.
                          </>
                        ),
                      },
                    ]
                ).map(({ Icon, node }, i) => (
                  <div key={i} className="flex items-start" style={{ gap: 10 }}>
                    <span
                      className="flex items-center justify-center shrink-0"
                      style={{
                        height: 22,
                        width: 22,
                        borderRadius: 7,
                        background: tileBg,
                        color: tileFg,
                        marginTop: 1,
                      }}
                    >
                      <Icon style={{ height: 12, width: 12 }} strokeWidth={2.2} />
                    </span>
                    <span
                      className="font-inter"
                      style={{ fontSize: 12.5, color: '#4A4F60', lineHeight: 1.5 }}
                    >
                      {node}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3 · Select target job */}
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <div
                  className="font-poppins"
                  style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2230' }}
                >
                  Select target job
                </div>
                <div
                  className="font-inter"
                  style={{ fontSize: 11, color: '#8B8F9E' }}
                >
                  {filteredJobs.length} of {availableJobs.length}
                </div>
              </div>

              {/* Search input */}
              <div
                className="flex items-center"
                style={{
                  height: 38,
                  background: '#ffffff',
                  border: '1px solid #E0DDD3',
                  borderRadius: 9,
                  padding: '0 10px',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Search style={{ height: 14, width: 14, color: '#8B8F9E' }} strokeWidth={2} />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search open jobs…"
                  className="font-inter flex-1 bg-transparent outline-none"
                  style={{ fontSize: 13, color: '#1F2230' }}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="flex items-center justify-center"
                    style={{
                      height: 20,
                      width: 20,
                      color: '#8B8F9E',
                      background: 'transparent',
                      border: 0,
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                    aria-label="Clear search"
                  >
                    <X style={{ height: 13, width: 13 }} strokeWidth={2} />
                  </button>
                )}
              </div>

              {/* Results list */}
              <div
                style={{
                  border: '1px solid #EDECE6',
                  borderRadius: 10,
                  padding: 4,
                  maxHeight: 208,
                  overflowY: 'auto',
                }}
              >
                {jobsLoading ? (
                  <div
                    className="font-inter text-center"
                    style={{ padding: 20, fontSize: 12.5, color: '#8B8F9E' }}
                  >
                    Loading jobs…
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div
                    className="font-inter text-center"
                    style={{ padding: 20, fontSize: 12.5, color: '#8B8F9E' }}
                  >
                    {query
                      ? `No open jobs match "${query}".`
                      : 'No other open jobs available.'}
                  </div>
                ) : (
                  filteredJobs.map((job) => {
                    const isSel = job.id === selectedJobId
                    const metaParts = [job.department, job.location].filter(Boolean) as string[]
                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => setSelectedJobId(job.id)}
                        className="flex items-center w-full text-left transition-colors"
                        style={{
                          borderRadius: 9,
                          padding: '9px 11px',
                          gap: 10,
                          background: isSel ? '#F5EFFF' : 'transparent',
                          boxShadow: isSel ? 'inset 0 0 0 1px #DFCBFB' : 'none',
                          border: 0,
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSel) e.currentTarget.style.background = '#FAFAF7'
                        }}
                        onMouseLeave={(e) => {
                          if (!isSel) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <span
                          className="flex items-center justify-center shrink-0"
                          style={{
                            height: 30,
                            width: 30,
                            background: '#F1F0EC',
                            borderRadius: 8,
                            color: '#5A6072',
                          }}
                        >
                          <Briefcase style={{ height: 14, width: 14 }} strokeWidth={2} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span
                            className="font-poppins block truncate"
                            style={{ fontSize: 13, fontWeight: 500, color: '#0d0d09' }}
                          >
                            {job.title}
                          </span>
                          {metaParts.length > 0 && (
                            <span
                              className="font-inter block truncate"
                              style={{ fontSize: 11, color: '#8B8F9E', marginTop: 1 }}
                            >
                              {metaParts.join(' · ')}
                            </span>
                          )}
                        </span>
                        <span
                          className="flex items-center justify-center shrink-0"
                          style={{
                            height: 20,
                            width: 20,
                            borderRadius: 999,
                            background: isSel ? '#6F3FF5' : '#F1F0EC',
                            color: isSel ? '#ffffff' : '#5A6072',
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          {isSel ? (
                            <Check style={{ height: 12, width: 12 }} strokeWidth={2.5} />
                          ) : (
                            initialsOf(job.title)
                          )}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* 4 · Transfer acknowledgment */}
            {isTransfer && (
              <label
                className="flex items-start cursor-pointer"
                style={{
                  background: '#FFF9EE',
                  border: '1px solid #F5E4BE',
                  borderRadius: 10,
                  padding: '11px 13px',
                  gap: 10,
                }}
              >
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{
                    height: 18,
                    width: 18,
                    borderRadius: 5,
                    background: ack ? '#B45309' : '#ffffff',
                    border: ack ? '1.5px solid #B45309' : '1.5px solid #D6B87A',
                    color: '#ffffff',
                    marginTop: 1,
                  }}
                >
                  {ack && <Check style={{ height: 11, width: 11 }} strokeWidth={3} />}
                </span>
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className="font-inter"
                  style={{ fontSize: 12.5, color: '#7A5510', lineHeight: 1.45 }}
                >
                  I understand {firstName} will be{' '}
                  <strong>removed from {currentJobTitle}</strong> and this can't be undone.
                </span>
              </label>
            )}
          </div>

          {/* FOOTER */}
          <footer
            className="flex items-center shrink-0"
            style={{
              padding: '13px 24px',
              borderTop: '1px solid #F1F0EC',
              background: '#FAFAF7',
              gap: 12,
            }}
          >
            <div className="flex items-center flex-1 min-w-0" style={{ gap: 6 }}>
              <History style={{ height: 12, width: 12, color: '#8B8F9E' }} strokeWidth={2} />
              <span
                className="font-inter truncate"
                style={{ fontSize: 11, color: '#8B8F9E' }}
              >
                Logged in activity · visible to the hiring team
              </span>
            </div>
            <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={isTransfer ? ArrowRightLeft : CopyPlus}
              onClick={handleConfirm}
              style={
                canConfirm
                  ? undefined
                  : { opacity: 0.4, pointerEvents: 'none' }
              }
              aria-disabled={!canConfirm}
            >
              {isTransfer ? 'Transfer candidate' : 'Add to job'}
            </Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function initialsOf(title: string): string {
  const parts = (title || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  const chars = (parts[0][0] || '') + (parts[1]?.[0] || '')
  return chars.toUpperCase()
}

interface MovePillProps {
  label: string
  value: string
  bg: string
  border: string
  labelColor: string
  valueColor: string
  strike?: boolean
  flex?: boolean
}

function MovePill({
  label,
  value,
  bg,
  border,
  labelColor,
  valueColor,
  strike,
  flex,
}: MovePillProps) {
  return (
    <div
      className="min-w-0"
      style={{
        flex: flex ? 1 : undefined,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 9,
        padding: '7px 10px',
      }}
    >
      <div
        className="font-inter truncate"
        style={{
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: labelColor,
          opacity: 0.7,
        }}
      >
        {label}
      </div>
      <div
        className="font-inter truncate"
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: valueColor,
          marginTop: 2,
          textDecoration: strike ? 'line-through' : 'none',
          textDecorationColor: strike ? 'rgba(180,54,47,0.5)' : undefined,
        }}
      >
        {value}
      </div>
    </div>
  )
}
