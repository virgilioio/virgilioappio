import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { CandidateSheetSection } from '../form/CandidateSheetSection'

interface Props {
  value: string
  onChange: (value: string) => void
  onPolish: () => void | Promise<void>
  isPolishing?: boolean
  disabled?: boolean
}

/**
 * Key takeaways — uses the shared CandidateSheetSection chrome (uppercase
 * label outside, white card inside) to stay aligned with the job wizard and
 * Add/Edit candidate sheets. Polish notes lives in the section action slot.
 */
export function KeyTakeawaysCard({ value, onChange, onPolish, isPolishing, disabled }: Props) {
  const polishDisabled = disabled || isPolishing || !value?.trim()
  const action = !disabled ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onPolish}
      disabled={polishDisabled}
      className="h-8 gap-1.5 text-[#5B21B6] hover:text-[#5B21B6] hover:bg-[#EDE4FF]"
    >
      {isPolishing ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Polishing…
        </>
      ) : (
        <>
          <Sparkles className="h-3.5 w-3.5" />
          Polish notes
        </>
      )}
    </Button>
  ) : undefined

  return (
    <CandidateSheetSection label="KEY TAKEAWAYS" action={action}>
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder="Share your key takeaways and observations…"
      />
    </CandidateSheetSection>
  )
}
