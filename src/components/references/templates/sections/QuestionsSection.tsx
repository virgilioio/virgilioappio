import { useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlignLeft,
  BadgeCheck,
  CheckSquare,
  CircleDot,
  Gauge,
  GripVertical,
  Heading,
  Plus,
  Star,
  Text,
  ThumbsUp,
  Trash2,
  ToggleLeft,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  ASK_CANDIDATE_DISABLED_TOOLTIP,
  QUESTION_TYPES,
  QUESTION_TYPE_LABEL,
  canAskCandidate,
  newQuestion,
  type ReferenceAnswerType,
  type RefQuestion,
} from '@/lib/references/templateModel'

const HAIRLINE = '#E7E8EE'
const MUTED = '#8B8F9E'
const LILAC = '#D7C5FB'

const TYPE_ICON: Record<ReferenceAnswerType, typeof Star> = {
  rating_1_5: Star,
  single_select: CircleDot,
  multi_select: CheckSquare,
  yes_no: ToggleLeft,
  short_text: Text,
  long_text: AlignLeft,
  section_header: Heading,
  employment_verification: BadgeCheck,
  would_rehire: ThumbsUp,
  recommendation_score: Gauge,
}

function MiniSwitch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className="h-[18px] w-[32px] [&>span]:h-[14px] [&>span]:w-[14px] [&>span]:data-[state=checked]:translate-x-[14px]"
    />
  )
}

function QuestionRow({
  q,
  onChange,
  onDelete,
}: {
  q: RefQuestion
  onChange: (patch: Partial<RefQuestion>) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id })
  const Icon = TYPE_ICON[q.type] ?? Text
  const askAllowed = canAskCandidate(q.type)

  return (
    <div
      ref={setNodeRef}
      style={{
        translate: CSS.Translate.toString(transform) ?? undefined,
        transition,
        borderColor: HAIRLINE,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="bg-white border rounded-xl px-2.5 py-2"
    >
      <div
        className="grid items-center gap-2.5"
        style={{ gridTemplateColumns: '20px 22px minmax(0,1fr) auto auto auto auto 28px' }}
      >
        <button
          type="button"
          className="grid place-items-center text-[#B5B9C4] hover:text-[#5A6072] cursor-grab active:cursor-grabbing"
          aria-label="Reorder question"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-[15px] h-[15px]" />
        </button>

        <div className="grid place-items-center" style={{ color: '#5A6072' }}>
          <Icon className="w-[15px] h-[15px]" strokeWidth={2} />
        </div>

        <Input
          value={q.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={q.type === 'section_header' ? 'Section title' : 'Question the referee answers'}
          className="h-[34px] font-inter text-[13px]"
        />

        <span
          className="inline-flex items-center rounded-full font-inter font-medium whitespace-nowrap"
          style={{ background: '#F1F0EC', color: '#5A6072', fontSize: 11, padding: '3px 8px' }}
        >
          {QUESTION_TYPE_LABEL[q.type]}
        </span>

        {q.ask_candidate_too && (
          <span
            className="inline-flex items-center rounded-full font-inter font-medium whitespace-nowrap"
            style={{ background: '#EDE4FF', color: '#5B21B6', fontSize: 11, padding: '3px 8px' }}
          >
            Ask candidate
          </span>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <label
                className={cn('flex items-center gap-1.5 font-inter whitespace-nowrap', !askAllowed && 'opacity-45')}
                style={{ fontSize: 11.5, color: '#5A6072' }}
              >
                <MiniSwitch
                  checked={askAllowed && q.ask_candidate_too}
                  disabled={!askAllowed}
                  onCheckedChange={(v) => onChange({ ask_candidate_too: v })}
                />
                Ask candidate
              </label>
            </TooltipTrigger>
            {!askAllowed && <TooltipContent>{ASK_CANDIDATE_DISABLED_TOOLTIP}</TooltipContent>}
          </Tooltip>
        </TooltipProvider>

        <label
          className={cn(
            'flex items-center gap-1.5 font-inter whitespace-nowrap',
            q.type === 'section_header' && 'opacity-45',
          )}
          style={{ fontSize: 11.5, color: '#5A6072' }}
        >
          <MiniSwitch
            checked={q.required}
            disabled={q.type === 'section_header'}
            onCheckedChange={(v) => onChange({ required: v })}
          />
          Required
        </label>

        <Button
          variant="ghost"
          size="xs"
          icon={Trash2}
          iconOnly
          aria-label="Delete question"
          onClick={onDelete}
        />
      </div>
    </div>
  )
}

function AddQuestionPicker({ onAdd }: { onAdd: (type: ReferenceAnswerType) => void }) {
  const [open, setOpen] = useState(false)
  const standard = QUESTION_TYPES.filter((t) => t.family === 'standard')
  const reference = QUESTION_TYPES.filter((t) => t.family === 'reference')

  const Item = ({ type, label, hint, tinted }: { type: ReferenceAnswerType; label: string; hint?: string; tinted?: boolean }) => {
    const Icon = TYPE_ICON[type] ?? Text
    return (
      <button
        type="button"
        onClick={() => {
          onAdd(type)
          setOpen(false)
        }}
        className={cn(
          'w-full flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
          tinted ? 'hover:bg-[#EDE4FF]' : 'hover:bg-[#F1F0EC]',
        )}
      >
        <Icon
          className="w-[15px] h-[15px] mt-[2px] shrink-0"
          strokeWidth={2}
          style={{ color: tinted ? '#5B21B6' : '#5A6072' }}
        />
        <span className="min-w-0">
          <span className="block font-inter text-[12.5px] text-[#1F2230]">{label}</span>
          {hint && (
            <span className="block font-inter" style={{ fontSize: 11, color: MUTED }}>
              {hint}
            </span>
          )}
        </span>
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" icon={Plus}>
          Add question
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[320px] p-1">
        <div
          className="px-2 pt-1.5 pb-1 font-inter font-semibold uppercase"
          style={{ fontSize: 10, letterSpacing: '0.06em', color: MUTED }}
        >
          Standard types
        </div>
        {standard.map((t) => (
          <Item key={t.type} type={t.type} label={t.label} hint={t.hint} />
        ))}

        <div className="my-1" style={{ borderTop: `1px solid ${HAIRLINE}` }} />

        <div
          className="px-2 pt-1.5 pb-1 font-inter font-semibold uppercase"
          style={{ fontSize: 10, letterSpacing: '0.06em', color: '#5B21B6' }}
        >
          Reference types
        </div>
        <div className="rounded-lg" style={{ background: '#FAF8FF' }}>
          {reference.map((t) => (
            <Item key={t.type} type={t.type} label={t.label} hint={t.hint} tinted />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function QuestionsSection({
  questions,
  onChange,
}: {
  questions: RefQuestion[]
  onChange: (questions: RefQuestion[]) => void
}) {
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = questions.findIndex((q) => q.id === active.id)
    const to = questions.findIndex((q) => q.id === over.id)
    if (from < 0 || to < 0) return
    onChange(arrayMove(questions, from, to))
  }

  const askedCount = questions.filter((q) => q.ask_candidate_too).length

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            className="font-poppins font-semibold text-[#0d0d09]"
            style={{ fontSize: 18, letterSpacing: '-0.04em' }}
          >
            Questions
          </h3>
          <p className="mt-1 font-inter text-[12.5px] text-[#5A6072]">
            {questions.length} question{questions.length === 1 ? '' : 's'} · the candidate also answers{' '}
            {askedCount} of them about themselves.
          </p>
        </div>
        <AddQuestionPicker onAdd={(type) => onChange([...questions, newQuestion(type)])} />
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {questions.map((q) => (
              <QuestionRow
                key={q.id}
                q={q}
                onChange={(patch) => onChange(questions.map((x) => (x.id === q.id ? { ...x, ...patch } : x)))}
                onDelete={() => onChange(questions.filter((x) => x.id !== q.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p
        className="font-inter leading-relaxed"
        style={{ fontSize: 11.5, color: MUTED, borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10 }}
      >
        <span style={{ color: '#5B21B6' }}>Ask candidate</span> is available on 1–5 rating questions
        only — the same scale on both sides is what makes the two answers comparable. Recommendation
        score runs on a 10-point scale and is excluded.
      </p>
      <div className="h-[1px]" style={{ background: LILAC, opacity: 0 }} />
    </div>
  )
}
