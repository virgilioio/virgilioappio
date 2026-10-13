import * as React from 'react'

/**
 * Closing or archiving a job rejects everyone still in its pipeline (Allan,
 * 2026-10-13). This host shows the reject form for that, from anywhere:
 *
 *   const done = await requestRejectBeforeClosing({ jobId, jobTitle, candidateIds, action: 'close' })
 *
 * It resolves true once the rejections are saved, false if the form was
 * cancelled. One host is mounted in App.tsx; the form loads on first use.
 */
const RejectionDialog = React.lazy(() =>
  import('@/components/candidates/RejectionDialog').then((m) => ({ default: m.RejectionDialog })),
)

export interface RejectBeforeClosing {
  jobId: string
  jobTitle?: string | null
  candidateIds: string[]
  action: 'close' | 'archive'
}

type Request = RejectBeforeClosing & { resolve: (done: boolean) => void }
let enqueue: ((r: Request) => void) | null = null

export function requestRejectBeforeClosing(req: RejectBeforeClosing): Promise<boolean> {
  return new Promise((resolve) => {
    if (enqueue) enqueue({ ...req, resolve })
    else resolve(false)
  })
}

export function CloseJobRejectHost() {
  const [current, setCurrent] = React.useState<Request | null>(null)
  const [open, setOpen] = React.useState(false)
  const settled = React.useRef(false)

  React.useEffect(() => {
    enqueue = (r) => {
      settled.current = false
      setCurrent(r)
      setOpen(true)
    }
    return () => {
      enqueue = null
    }
  }, [])

  const settle = (done: boolean) => {
    if (!current || settled.current) return
    settled.current = true
    current.resolve(done)
  }

  if (!current) return null
  return (
    <React.Suspense fallback={null}>
      <RejectionDialog
        open={open}
        onOpenChange={(o) => {
          if (o) return
          setOpen(false)
          settle(false)
          // Unmount after the exit animation (--dur-dialog-out).
          window.setTimeout(() => setCurrent((c) => (c === current ? null : c)), 200)
        }}
        candidateIds={current.candidateIds}
        jobId={current.jobId}
        jobTitle={current.jobTitle ?? undefined}
        closingJob={current.action}
        onSuccess={() => settle(true)}
      />
    </React.Suspense>
  )
}
