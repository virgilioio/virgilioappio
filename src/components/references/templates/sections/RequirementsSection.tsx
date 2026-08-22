import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { Info, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TypeChip } from '@/components/references/TypeChip'
import { InfoBlock, RowShell, SectionHead } from '../rowKit'
import { RELATIONSHIP_OPTIONS, makeId, type RelationshipRule } from '@/lib/references/templateModel'

const COUNTS = [1, 2, 3, 4, 5, 6]

function CountRow({
  value,
  floor,
  onChange,
}: {
  value: number
  /** Numbers below this are disabled and inert. */
  floor?: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex" style={{ gap: 8 }}>
      {COUNTS.map((n) => {
        const disabled = floor != null && n < floor
        const selected = n === value
        return (
          <button
            key={n}
            type="button"
            aria-disabled={disabled}
            onClick={() => {
              if (disabled) return
              onChange(n)
            }}
            className="font-poppins"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: `1px solid ${selected ? '#0d0d09' : '#E0DDD3'}`,
              background: selected ? '#0d0d09' : '#fff',
              color: disabled ? '#D1D0CB' : selected ? '#fffcf9' : '#5A6072',
              fontWeight: 600,
              fontSize: 12.5,
              letterSpacing: '-0.01em',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}

export function RequirementsSection({
  min,
  max,
  rules,
  onChange,
}: {
  min: number
  max: number
  rules: RelationshipRule[]
  onChange: (patch: {
    min_referees?: number
    max_referees?: number
    relationship_rules?: RelationshipRule[]
  }) => void
}) {
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = rules.findIndex((r) => r.id === active.id)
    const to = rules.findIndex((r) => r.id === over.id)
    if (from < 0 || to < 0) return
    onChange({ relationship_rules: arrayMove(rules, from, to) })
  }

  const patchRule = (id: string, p: Partial<RelationshipRule>) =>
    onChange({ relationship_rules: rules.map((r) => (r.id === id ? { ...r, ...p } : r)) })

  return (
    <div>
      <SectionHead
        title="Referee requirements"
        subtitle="Rules the candidate must satisfy before they can submit. Enforced on the candidate's page."
      />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <FormField label="Minimum referees" required>
          <CountRow
            value={min}
            onChange={(n) => onChange({ min_referees: n, max_referees: Math.max(n, max) })}
          />
        </FormField>
        <FormField label="Maximum referees" required>
          <CountRow value={max} floor={min} onChange={(n) => onChange({ max_referees: n })} />
        </FormField>
      </div>

      <div style={{ marginTop: 20 }}>
        <SectionHead
          title="Required relationships"
          subtitle="At least one referee must match each rule below."
          action={
            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={() =>
                onChange({
                  relationship_rules: [
                    ...rules,
                    { id: makeId(), count: 1, relationship: 'Direct manager', enforced: true },
                  ],
                })
              }
            >
              Add rule
            </Button>
          }
        />

        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div>
              {rules.map((rule, i) => (
                <RowShell
                  key={rule.id}
                  id={rule.id}
                  last={i === rules.length - 1}
                  deleteLabel="Delete rule"
                  onDelete={() =>
                    onChange({ relationship_rules: rules.filter((r) => r.id !== rule.id) })
                  }
                >
                  <span
                    className="inline-flex items-center font-inter"
                    style={{ flex: 1, gap: 6, fontSize: 12.5, color: '#1F2230' }}
                  >
                    At least
                    <Select
                      value={String(rule.count)}
                      onValueChange={(v) => patchRule(rule.id, { count: Number(v) })}
                    >
                      <SelectTrigger
                        className="h-[26px] w-[54px] font-poppins"
                        style={{ fontSize: 12.5, fontWeight: 600 }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    referee must be a
                    <Select
                      value={rule.relationship}
                      onValueChange={(v) => patchRule(rule.id, { relationship: v })}
                    >
                      <SelectTrigger className="h-[26px] w-auto border-0 bg-transparent p-0 shadow-none focus:ring-0">
                        <TypeChip label={rule.relationship} tone="purple" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIP_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </span>

                  {!rule.enforced && (
                    <Badge tone="neutral" size="xs">
                      Advisory only
                    </Badge>
                  )}
                </RowShell>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <InfoBlock>
          <Info size={13} style={{ color: '#8B8F9E', flexShrink: 0, marginTop: 1 }} />
          <span>
            The candidate sees these as a checklist and cannot submit until they're met. Recruiters
            can override the count per request when triggering a check.
          </span>
        </InfoBlock>
      </div>
    </div>
  )
}
