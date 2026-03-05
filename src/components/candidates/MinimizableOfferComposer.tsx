import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
  editingOffer?: { id: string; form_id: string; field_values: Record<string, any> } | null
}

interface OfferDraft {
  selectedFormId: string
  fieldValues: Record<string, any>
  lastUpdated: number
}

const getDraftKey = (candidateId: string) => `offer-draft-${candidateId}`

export function MinimizableOfferComposer({
  isOpen,
  onOpenChange,
  candidateId,
  candidateName,
  jobId,
  jobTitle,
  organizationId,
  editingOffer,
}: MinimizableOfferComposerProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [selectedFormId, setSelectedFormId] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({})
  const [draftRestored, setDraftRestored] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const draftKey = getDraftKey(candidateId)

  // Restore draft on open
  useEffect(() => {
    if (!isOpen) return
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) {
        const draft: OfferDraft = JSON.parse(saved)
        setSelectedFormId(draft.selectedFormId || '')
        setFieldValues(draft.fieldValues || {})
        setDraftRestored(true)
        toast({ title: 'Draft restored', description: 'Your previous offer progress has been restored.' })
      }
    } catch {
      // ignore corrupt data
    }
  }, [isOpen, draftKey])

  // Debounced auto-save
  const saveDraft = useCallback(() => {
    if (!selectedFormId && Object.keys(fieldValues).length === 0) return
    const draft: OfferDraft = { selectedFormId, fieldValues, lastUpdated: Date.now() }
    localStorage.setItem(draftKey, JSON.stringify(draft))
  }, [selectedFormId, fieldValues, draftKey])

  useEffect(() => {
    if (!isOpen) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(saveDraft, 2000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [selectedFormId, fieldValues, isOpen, saveDraft])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey)
  }, [draftKey])

  const handleFormChange = (id: string) => {
    setSelectedFormId(id)
    setFieldValues({})
    setDraftRestored(false)
  }

  const handleClose = () => {
    // Save draft synchronously on close
    if (selectedFormId || Object.keys(fieldValues).length > 0) {
      const draft: OfferDraft = { selectedFormId, fieldValues, lastUpdated: Date.now() }
      localStorage.setItem(draftKey, JSON.stringify(draft))
    }
    onOpenChange(false)
    // Reset local state
    setIsMinimized(false)
    setDraftRestored(false)
  }

  const handleCancel = () => {
    clearDraft()
    setSelectedFormId('')
    setFieldValues({})
    setDraftRestored(false)
    onOpenChange(false)
    setIsMinimized(false)
  }

  const handleSuccess = () => {
    clearDraft()
    setSelectedFormId('')
    setFieldValues({})
    setDraftRestored(false)
    onOpenChange(false)
    setIsMinimized(false)
  }

  if (!isOpen) return null

  return (
    <div
      className={cn(
        "absolute bottom-4 right-4 z-[60] bg-background border rounded-lg shadow-2xl transition-all duration-300 pointer-events-auto",
        isMinimized ? "w-[360px] h-[52px]" : "w-[580px] max-w-[min(95vw,580px)]"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Bar */}
      <div
        className={cn(
          "flex items-center justify-between bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors",
          isMinimized ? "h-full px-4 rounded-lg" : "p-4 border-b rounded-t-lg"
        )}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <h3 className="font-semibold text-sm truncate">
          {isMinimized ? `Offer: ${candidateName}` : `Create Offer — ${candidateName}`}
        </h3>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content Area */}
      {!isMinimized && (
        <div className="max-h-[600px] overflow-y-auto p-4">
          <OfferComposerBody
            candidateId={candidateId}
            candidateName={candidateName}
            jobId={jobId}
            jobTitle={jobTitle}
            organizationId={organizationId}
            selectedFormId={selectedFormId}
            onSelectedFormIdChange={handleFormChange}
            fieldValues={fieldValues}
            onFieldValuesChange={setFieldValues}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            draftRestored={draftRestored}
          />
        </div>
      )}
    </div>
  )
}
