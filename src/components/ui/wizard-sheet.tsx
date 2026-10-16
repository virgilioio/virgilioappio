import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'

import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { UnsavedGuard } from '@/components/ui/unsaved-guard'
import { IconTip } from '@/components/ui/tooltip'
import { useStepSlide } from '@/lib/motion'
import { cn } from '@/lib/utils'

export interface WizardStep {
  title: string
  /** done: a check; locked: can't be reached until earlier steps are valid. */
  state: 'todo' | 'done' | 'locked'
}

/**
 * The Create Job sheet's frame (JobWizard), shared: eyebrow, title with its
 * purple period, subtitle, a steps rail with a note under it, the step body
 * (slides 16px between steps), and a sticky footer with Cancel/Back · hint ·
 * secondary · primary. A dirty sheet asks before closing (UnsavedGuard, inline).
 * Same classes as JobWizard so both read as one product.
 */
export function WizardSheet({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  steps,
  current,
  onStep,
  railNote,
  hint,
  secondary,
  primary,
  dirty,
  flush,
  wide,
  children,
}: {
  open: boolean
  /** Called when the sheet should close (after the unsaved check). */
  onClose: () => void
  eyebrow: string
  title: string
  subtitle?: ReactNode
  steps: WizardStep[]
  current: number
  onStep: (index: number) => void
  railNote?: { title: string; body: ReactNode }
  /** Short text in the footer: the first problem, or a summary. */
  hint?: ReactNode
  secondary?: ReactNode
  primary: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean; icon?: LucideIcon; iconRight?: LucideIcon }
  dirty?: boolean
  /** The step body fills the space edge to edge (e.g. an editor). */
  flush?: boolean
  /** Everything right of the rail instead of 1080px (e.g. the fields editor). */
  wide?: boolean
  children: ReactNode
}) {
  const stepRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  useStepSlide(stepRef, current)
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [current])

  const guardOpen = useRef(false)
  const [asking, setAsking] = useState(false)
  useEffect(() => {
    if (!open) setAsking(false)
  }, [open, setAsking])
  guardOpen.current = asking

  const requestClose = () => {
    if (primary.loading) return
    if (dirty) setAsking(true)
    else onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && requestClose()}>
      <SheetContent
        side="right"
        className={cn(
          'w-full p-0 bg-[#F6F5F1] border-l border-virgilio-border [transition-property:transform,opacity,max-width] duration-[320ms]',
          wide ? 'sm:max-w-[calc(100vw-88px)]' : 'sm:max-w-[1080px]',
        )}
        onEscapeKeyDown={(e) => {
          // The guard handles its own Esc; a control marked data-escape-local
          // (a selected field in an editor) uses Esc to let go of the selection.
          const local = document.activeElement instanceof Element && document.activeElement.closest('[data-escape-local]')
          if (guardOpen.current || local) e.preventDefault()
        }}
      >
        <div className="flex h-full flex-col">
          <div className={cn('px-6 sm:px-10 pt-1', wide ? 'pb-4' : 'pb-6')}>
            <p className="text-[11px] font-poppins font-semibold uppercase tracking-[0.14em] text-virgilio-purple">{eyebrow}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <SheetTitle asChild>
                <h1 className={cn('font-poppins font-semibold tracking-[-0.04em] text-text-primary leading-tight', wide ? 'text-[24px] sm:text-[26px]' : 'text-[28px] sm:text-[34px]')}>
                  {title}
                  <span className="text-virgilio-purple">.</span>
                </h1>
              </SheetTitle>
            </div>
            {subtitle ? (
              <SheetDescription asChild>
                <p className="mt-2 max-w-xl text-[13.5px] text-text-secondary leading-snug">{subtitle}</p>
              </SheetDescription>
            ) : (
              <SheetDescription className="sr-only">{eyebrow}</SheetDescription>
            )}
          </div>

          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* A wide step (an editor) folds the rail to its step numbers, so the work gets the room. */}
            <aside className={cn('hidden md:flex shrink-0 flex-col gap-2 pb-6', wide ? 'w-[68px] px-3' : 'w-[260px] px-6 lg:px-10')}>
              <ol className="space-y-1">
                {steps.map((step, i) => {
                  const isActive = i === current
                  const locked = step.state === 'locked' && !isActive
                  return (
                    <li key={step.title}>
                      <StepTip label={step.title} show={!!wide}>
                      <button
                        type="button"
                        onClick={() => !locked && i !== current && onStep(i)}
                        disabled={locked}
                        aria-current={isActive ? 'step' : undefined}
                        aria-label={wide ? `Step ${i + 1}: ${step.title}` : undefined}
                        className={cn(
                          'group flex w-full items-center gap-3 rounded-xl py-2.5 text-left transition-colors',
                          wide ? 'justify-center px-0' : 'px-3',
                          isActive ? 'bg-white border border-virgilio-border shadow-sm' : 'hover:bg-white/60',
                          locked && 'opacity-50 cursor-not-allowed',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-poppins font-semibold transition-colors',
                            step.state === 'done' && !isActive
                              ? 'bg-virgilio-purple text-white'
                              : isActive
                              ? 'bg-[#0d0d09] text-white'
                              : 'bg-virgilio-border text-text-tertiary',
                          )}
                        >
                          {step.state === 'done' && !isActive ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </span>
                        <span className={cn('text-[13px] font-poppins font-medium', isActive ? 'text-text-primary' : 'text-text-secondary', wide && 'sr-only')}>
                          {step.title}
                        </span>
                      </button>
                      </StepTip>
                    </li>
                  )
                })}
              </ol>
              {railNote && !wide && (
                <div className="mt-4 rounded-xl bg-[#F2EBFF] p-4">
                  <p className="text-[10.5px] font-poppins font-semibold uppercase tracking-[0.12em] text-virgilio-purple">{railNote.title}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">{railNote.body}</p>
                </div>
              )}
            </aside>

            <main ref={mainRef} className={cn('flex-1 min-w-0', flush ? 'overflow-hidden' : 'overflow-y-auto px-6 sm:px-10 pb-8')}>
              <div ref={stepRef} className={flush ? 'h-full' : undefined}>
                {children}
              </div>
            </main>
          </div>

          <div className="relative border-t border-virgilio-border bg-[#F6F5F1]/95 backdrop-blur px-6 sm:px-10 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {current === 0 ? (
                  <Button variant="ghost" onClick={requestClose} type="button">
                    Cancel
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => onStep(current - 1)} type="button" icon={ChevronLeft} disabled={primary.loading}>
                    Back
                  </Button>
                )}
                {hint && <p className="hidden min-w-0 truncate xl:block text-[12px] text-text-tertiary">{hint}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {secondary}
                <Button
                  type="button"
                  onClick={primary.onClick}
                  icon={primary.icon}
                  iconRight={primary.iconRight ?? (primary.icon ? undefined : ChevronRight)}
                  disabled={primary.disabled}
                  loading={primary.loading}
                >
                  {primary.label}
                </Button>
              </div>
            </div>
            <UnsavedGuard
              open={asking}
              onKeep={() => setAsking(false)}
              onDiscard={() => {
                setAsking(false)
                onClose()
              }}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}


/** On a folded rail, each step number keeps its name as a tooltip. */
function StepTip({ label, show, children }: { label: string; show: boolean; children: ReactElement }) {
  return show ? (
    <IconTip label={label} side="right">
      {children}
    </IconTip>
  ) : (
    children
  )
}
