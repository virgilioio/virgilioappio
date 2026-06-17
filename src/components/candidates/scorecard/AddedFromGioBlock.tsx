import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { GioAddedQuestion } from '@/hooks/useGioAddedQuestions'

interface Props {
  item: GioAddedQuestion
  onAnswerChange: (id: string, value: string) => void
  onRemove: (sourcePointIndex: number) => void
  readOnly?: boolean
}

export function AddedFromGioBlock({ item, onAnswerChange, onRemove, readOnly }: Props) {
  return (
    <div className="space-y-2 rounded-lg border border-[#E0DDD3] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#EDE4FF] border border-[#D7C5FB] px-2 py-0.5 text-[10.5px] font-medium text-[#5B21B6]">
            <Sparkles className="h-3 w-3" /> Added from Gio
          </span>
          <p className="text-[13px] font-medium text-[#1F2230] leading-snug">{item.question}</p>
        </div>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Remove from scorecard"
            className="h-7 w-7 p-0 text-[#8B8F9E] hover:text-[#1F2230]"
            onClick={() => onRemove(item.source_point_index)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Textarea
        placeholder="Enter your answer…"
        value={item.answer}
        onChange={e => onAnswerChange(item.id, e.target.value)}
        disabled={readOnly}
        className="min-h-[80px] bg-white border-[#E0DDD3]"
      />
    </div>
  )
}
