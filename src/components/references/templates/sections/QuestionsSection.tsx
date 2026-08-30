import { useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import {
  BadgeCheck,
  Calendar,
  CalendarRange,
  EyeOff,
  Gauge,
  Hash,
  Heading,
  List,
  ListChecks,
  Plus,
  Repeat,
  Scale,
  Star,
  Text,
  ToggleLeft,
  Type,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TypeChip } from '@/components/references/TypeChip'
import { RowShell, SectionCard, SectionHead, TrailingToggle } from '../rowKit'
import {
  ASK_CANDIDATE_DISABLED_TOOLTIP,
  QUESTION_TYPES,
  QUESTION_TYPE_LABEL,
  canAskCandidate,
  newQuestion,
  type ReferenceAnswerType,
  type RefQuestion,
} from '@/lib/references/templateModel'

const TYPE_ICON: Record<ReferenceAnswerType, LucideIcon> = {
  rating_1_5: Star,
  single_select: List,
  multi_select: ListChecks,
  yes_no: ToggleLeft,
  short_text: Type,
  long_text: Text,
  section_header: Heading,
  employment_verification: BadgeCheck,
  would_rehire: Repeat,
  recommendation_score: Gauge,
  number: Hash,
  date: Calendar,
  date_range: CalendarRange,
}

const REFERENCE_TYPES: ReferenceAnswerType[] = [
  'employment_verification',
  'would_rehire',
  'recommendation_score',
]
const isReferenceType = (t: ReferenceAnswerType) => REFERENCE_TYPES.includes(t)

const EXPLAINERS: { title: string; body: string; icon: LucideIcon }[] = [
  {
    title: 'Employment verification',
    icon: BadgeCheck,
    body: "Title and dates as the referee remembers them. Captured for the record — never auto-compared, because there's no structured work history to compare it against.",
  },
  {
    title: 'Would you rehire?',
    icon: Repeat,
    body: 'Its own field type — the single most predictive question in a reference.',
  },
  {
    title: 'Ask candidate',
    icon: Scale,
    body: 'Rating questions only — the one type with a shared 1–5 scale on both sides. The candidate answers the same question about themselves and Gio reports the gap.',
  },
]

function QuestionRow({
  q,
  last,
  onChange,
  onDelete,
}: {
  q: RefQuestion
  last: boolean
  onChange: (patch: Partial<RefQuestion>) => void
  onDelete: () => void
}) {
  const Icon = TYPE_ICON[q.type] ?? Text
  const reference = isReferenceType(q.type)
  const askAllowed = canAskCandidate(q.type)

  return (
    <RowShell id={q.id} last={last} onDelete={onDelete} deleteLabel="Delete question">
      <span
        className="grid place-items-center shrink-0"
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: reference ? '#EDE4FF' : '#F1F0EC',
          color: reference ? '#6F3FF5' : '#8B8F9E',
        }}
      >
        <Icon size={13} strokeWidth={2} />
      </span>

      <div className="min-w-0" style={{ flex: 1 }}>
        <div className="flex items-center" style={{ gap: 7 }}>
          <Input
            value={q.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder={q.type === 'section_header' ? 'Section title' : 'Question the referee answers'}
            className="h-[26px] min-w-0 border-0 bg-transparent px-0 font-inter shadow-none focus-visible:ring-0"
            style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}
          />
          {q.internal && (
            <Badge tone="neutral" size="xs" icon={EyeOff}>
              Internal only
            </Badge>
          )}
          {q.ask_candidate_too && (
            <Badge tone="lilac" size="xs" icon={Scale}>
              Ask candidate
            </Badge>
          )}
        </div>
        {q.helper && (
          <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E', marginTop: 2 }}>
            {q.helper}
          </p>
        )}
      </div>

      {q.type === 'number' && (
        <Input
          value={q.unit ?? ''}
          onChange={(e) => onChange({ unit: e.target.value })}
          placeholder="Unit, e.g. direct reports"
          className="h-[26px] w-[168px] shrink-0 font-inter"
          style={{ fontSize: 11.5 }}
        />
      )}

      {(q.type === 'date' || q.type === 'date_range') && (
        <select
          value={q.precision ?? 'month_year'}
          onChange={(e) =>
            onChange({ precision: e.target.value as 'month_year' | 'full_date' })
          }
          className="font-inter shrink-0"
          style={{
            height: 26,
            borderRadius: 7,
            border: '1px solid #E0DDD3',
            background: '#fff',
            fontSize: 11.5,
            color: '#5A6072',
            padding: '0 6px',
          }}
        >
          <option value="month_year">Month &amp; year</option>
          <option value="full_date">Full date</option>
        </select>
      )}

      <TypeChip
        label={QUESTION_TYPE_LABEL[q.type]}
        tone={reference ? 'purple' : 'neutral'}
        icon={Icon}
      />

      {q.type === 'yes_no' && (
        <TrailingToggle
          label="Yes is a concern"
          width={132}
          checked={q.invert === true}
          onChange={(v) => onChange({ invert: v })}
          title="Answering yes flags this as a concern rather than reassurance"
        />
      )}

      <TrailingToggle
        label="Ask candidate"
        width={118}
        accent
        disabled={!askAllowed}
        checked={askAllowed && q.ask_candidate_too}
        onChange={(v) => onChange({ ask_candidate_too: v })}
        title={
          askAllowed
            ? 'The candidate answers this about themselves too'
            : ASK_CANDIDATE_DISABLED_TOOLTIP
        }
      />

      <TrailingToggle
        label="Required"
        width={84}
        disabled={q.type === 'section_header'}
        checked={q.required}
        onChange={(v) => onChange({ required: v })}
      />
    </RowShell>
  )
}

function TypePicker({ onAdd }: { onAdd: (type: ReferenceAnswerType) => void }) {
  const groups: { heading: string; family: 'standard' | 'reference' }[] = [
    { heading: 'Standard types', family: 'standard' },
    { heading: 'Reference types', family: 'reference' },
  ]

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 12,
        background: '#FAFAF7',
        border: '1px solid #EDE4FF',
        borderRadius: 10,
      }}
    >
      {groups.map((g, gi) => (
        <div key={g.family} style={{ marginBottom: gi === 0 ? 10 : 0 }}>
          <p
            className="font-inter uppercase"
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#8B8F9E',
              letterSpacing: '0.07em',
              marginBottom: 6,
            }}
          >
            {g.heading}
          </p>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {QUESTION_TYPES.filter((t) => t.family === g.family).map((t) => {
              const Icon = TYPE_ICON[t.type] ?? Text
              const reference = g.family === 'reference'
              return (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => onAdd(t.type)}
                  className="inline-flex items-center font-inter"
                  style={{
                    gap: 6,
                    height: 30,
                    padding: '0 11px',
                    borderRadius: 8,
                    background: '#fff',
                    fontSize: 12,
                    color: '#1F2230',
                    border: `1px solid ${reference ? '#D7C5FB' : '#E0DDD3'}`,
                    cursor: 'pointer',
                  }}
                >
                  <Icon size={13} strokeWidth={2} color={reference ? '#6F3FF5' : '#8B8F9E'} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function QuestionsSection({
  questions,
  onChange,
}: {
  questions: RefQuestion[]
  onChange: (questions: RefQuestion[]) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

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
    <div className="space-y-4">
      <SectionCard>
      <SectionHead
        title="Questions for referees"
        subtitle={`Reference checks have their own type set — ${askedCount} of these are also asked of the candidate.`}
        action={
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setPickerOpen((o) => !o)}>
            Add question
          </Button>
        }
      />

      {pickerOpen && (
        <TypePicker
          onAdd={(type) => {
            const label = `New ${(QUESTION_TYPE_LABEL[type] ?? 'question').toLowerCase()}`
            onChange([...questions, { ...newQuestion(type), label, required: false }])
            setPickerOpen(false)
          }}
        />
      )}

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <div>
            {questions.map((q, i) => (
              <QuestionRow
                key={q.id}
                q={q}
                last={i === questions.length - 1}
                onChange={(patch) =>
                  onChange(questions.map((x) => (x.id === q.id ? { ...x, ...patch } : x)))
                }
                onDelete={() => onChange(questions.filter((x) => x.id !== q.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      </SectionCard>

      <div className="flex" style={{ gap: 10 }}>
        {EXPLAINERS.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.title}
              style={{
                flex: 1,
                padding: 12,
                background: '#FAF8FF',
                border: '1px solid #EDE4FF',
                borderRadius: 10,
              }}
            >
              <div className="flex items-center" style={{ gap: 7, marginBottom: 5 }}>
                <Icon size={13} strokeWidth={2} color="#6F3FF5" />
                <p
                  className="font-poppins"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: '#1F2230',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {card.title}
                </p>
              </div>
              <p className="font-inter" style={{ fontSize: 11, color: '#5A6072', lineHeight: 1.5 }}>
                {card.body}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
