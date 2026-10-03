import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Sheet, SheetContent, SheetOverlay, SheetPortal, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OfferComposerBody } from './OfferComposerBody'
import { toast } from '@/hooks/use-toast'

interface MinimizableOfferComposerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string
  candidateName: string
  jobId: string
  jobTitle?: string
  organizationId: string
  editingOffer?: { id: string; form_id: string; field_values: Record<string, any>; opening_id?: string | null } | null
}

interface OfferDraft { selectedFormId: string; fieldValues: Record<string, any>; openingId: string; lastUpdated: number }
const getDraftKey = (candidateId: string) => `offer-draft-${candidateId}`

export function MinimizableOfferComposer({ isOpen, onOpenChange, candidateId, candidateName, jobId, jobTitle, organizationId, editingOffer }: MinimizableOfferComposerProps) {
  const [selectedFormId, setSelectedFormId] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({})
  const [openingId, setOpeningId] = useState('')
  const [draftRestored, setDraftRestored] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftKey = getDraftKey(candidateId)

  useEffect(() => {
    if (!isOpen) return
    if (editingOffer) {
      setSelectedFormId(editingOffer.form_id || '')
      setFieldValues(editingOffer.field_values || {})
      setOpeningId(editingOffer.opening_id || '')
      setDraftRestored(false)
      return
    }
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) {
        const draft: OfferDraft = JSON.parse(saved)
        setSelectedFormId(draft.selectedFormId || '')
        setFieldValues(draft.fieldValues || {})
        setOpeningId(draft.openingId || '')
        setDraftRestored(true)
        toast({ title: 'Draft restored', description: 'Your previous offer progress has been restored.' })
      }
    } catch { /* ignore corrupt draft */ }
  }, [isOpen, draftKey, editingOffer])

  const saveDraft = useCallback(() => {
    if (!selectedFormId && Object.keys(fieldValues).length === 0) return
    localStorage.setItem(draftKey, JSON.stringify({ selectedFormId, fieldValues, openingId, lastUpdated: Date.now() } satisfies OfferDraft))
  }, [selectedFormId, fieldValues, openingId, draftKey])

  useEffect(() => {
    if (!isOpen) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(saveDraft, 2000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [selectedFormId, fieldValues, openingId, isOpen, saveDraft])

  const reset = () => { setSelectedFormId(''); setFieldValues({}); setOpeningId(''); setDraftRestored(false) }
  const handleClose = () => { saveDraft(); onOpenChange(false) }
  const handleCancel = () => { localStorage.removeItem(draftKey); reset(); onOpenChange(false) }
  const handleSuccess = () => { localStorage.removeItem(draftKey); reset(); onOpenChange(false) }
  const firstName = candidateName.trim().split(/\s+/)[0] || candidateName

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <SheetPortal><SheetOverlay className="bg-primary/20" /></SheetPortal>
      <SheetContent side="right" showOverlay={false} className="flex h-full w-full flex-col gap-0 overflow-hidden rounded-l-xl border-0 bg-card p-0 shadow-2xl sm:max-w-[820px] [&>button:last-child]:hidden">
        <header className="flex shrink-0 items-start gap-3 border-b border-dup-hairline px-6 pb-3.5 pt-4">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 font-inter text-[10.5px] font-semibold uppercase tracking-[0.08em] text-virgilio-purple">Offer · 3-step builder</p>
            <div className="flex flex-wrap items-center gap-2"><SheetTitle className="font-poppins text-[20px] font-semibold leading-[1.15] tracking-[-0.035em] text-dup-ink">Build {firstName}'s offer<span className="text-purple-period">.</span></SheetTitle>{draftRestored && <Badge tone="lilac" size="xs" icon={Sparkles}>Gio drafted</Badge>}</div>
            <p className="mt-1.5 max-w-[480px] font-inter text-[12.5px] leading-[1.5] text-dup-muted">Compensation, terms, and the letter copy. Approvals route automatically after preview.</p>
          </div>
          <Button variant="ghost" size="sm" iconOnly aria-label="Close" icon={X} onClick={handleClose} />
        </header>
        <OfferComposerBody candidateId={candidateId} candidateName={candidateName} jobId={jobId} jobTitle={jobTitle} organizationId={organizationId} selectedFormId={selectedFormId} onSelectedFormIdChange={(id) => { setSelectedFormId(id); setFieldValues({}); setDraftRestored(false) }} fieldValues={fieldValues} onFieldValuesChange={setFieldValues} openingId={openingId} onOpeningIdChange={setOpeningId} onSuccess={handleSuccess} onCancel={handleCancel} onSaveDraft={saveDraft} draftRestored={draftRestored} editingOfferId={editingOffer?.id} />
      </SheetContent>
    </Sheet>
  )
}