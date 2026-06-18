import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { FormSectionCard } from './FormSectionCard'

interface Props {
  value: string
  onChange: (value: string) => void
  onPolish: () => void | Promise<void>
  isPolishing?: boolean
  disabled?: boolean
}

/**
 * Key takeaways card — wraps the RichTextEditor and exposes the Polish notes
 * action in the card header (ghost purple, sparkles icon) per the spec.
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
    <FormSectionCard
      title="Key takeaways"
      subtitle="Comprehensive notes about your interview with this candidate."
      action={action}
    >
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder="Share your key takeaways and observations…"
      />
    </FormSectionCard>
  )
}
