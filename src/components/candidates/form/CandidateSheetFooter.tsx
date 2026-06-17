import React from 'react'
import { Info, ExternalLink, UserPlus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CandidateSheetFooterProps {
  mode: 'add' | 'edit'
  isLoading?: boolean
  isSubmitDisabled?: boolean
  submitTitle?: string
  onCancel: () => void
  /** Add-mode only */
  dedupeCount?: number | null
  onSaveAndAddAnother?: () => void
  onSubmit: () => void
  /** Edit-mode only */
  addedLabel?: string
  editedLabel?: string
  onOpenProfile?: () => void
  /** Optional left-side live status line (overrides the default dedupe hint in add mode). */
  statusLine?: React.ReactNode
}

/**
 * Sticky footer with two layouts:
 * - add  → dedupe meta · Cancel · Save & add another · Add candidate (primary)
 * - edit → Cancel · added/edited meta · Open profile · Save changes (primary)
 */
export function CandidateSheetFooter({
  mode,
  isLoading,
  isSubmitDisabled,
  submitTitle,
  onCancel,
  dedupeCount,
  onSaveAndAddAnother,
  onSubmit,
  addedLabel,
  editedLabel,
  onOpenProfile,
  statusLine,
}: CandidateSheetFooterProps) {
  return (
    <div
      className={cn(
        'border-t border-virgilio-border/60 bg-background',
        'px-6 py-4 flex items-center gap-3 flex-wrap',
      )}
    >
      {mode === 'add' ? (
        <>
          {statusLine
            ? statusLine
            : typeof dedupeCount === 'number' && dedupeCount > 0 && (
                <div className="flex items-start gap-1.5 text-xs text-virgilio-muted leading-tight max-w-[240px]">
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
                  <span>
                    We'll de-duplicate against your existing {dedupeCount.toLocaleString()} candidates.
                  </span>
                </div>
              )}
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            {onSaveAndAddAnother && (
              <Button
                type="button"
                variant="secondary"
                onClick={onSaveAndAddAnother}
                disabled={isLoading || isSubmitDisabled}
              >
                Save & add another
              </Button>
            )}
            <Button
              type="submit"
              form="candidate-form"
              icon={UserPlus}
              loading={isLoading}
              disabled={isSubmitDisabled}
              title={submitTitle}
              onClick={onSubmit}
            >
              Add candidate
            </Button>
          </div>
        </>
      ) : (
        <>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          {(addedLabel || editedLabel) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-virgilio-muted leading-tight">
              {addedLabel && <span>Added {addedLabel}</span>}
              {addedLabel && editedLabel && <span aria-hidden>·</span>}
              {editedLabel && <span>last edited {editedLabel}</span>}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {onOpenProfile && (
              <Button
                type="button"
                variant="secondary"
                icon={ExternalLink}
                onClick={onOpenProfile}
              >
                Open profile
              </Button>
            )}
            <Button
              type="submit"
              form="candidate-form"
              icon={Check}
              loading={isLoading}
              disabled={isSubmitDisabled}
              onClick={onSubmit}
            >
              Save changes
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export default CandidateSheetFooter
