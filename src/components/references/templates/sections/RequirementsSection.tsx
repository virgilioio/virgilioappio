import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  RELATIONSHIP_OPTIONS,
  makeId,
  type RelationshipRule,
} from '@/lib/references/templateModel'

const HAIRLINE = '#E7E8EE'
const MUTED = '#8B8F9E'
const COUNTS = [1, 2, 3, 4, 5, 6]

function CountGroup({
  value,
  min,
  onChange,
  label,
}: {
  value: number
  min?: number
  onChange: (n: number) => void
  label: string
}) {
  return (
    <div>
      <p className="font-inter font-medium text-[#1F2230] mb-1.5" style={{ fontSize: 12.5 }}>
        {label}
      </p>
      <div className="inline-flex rounded-lg overflow-hidden" style={{ border: `1px solid ${HAIRLINE}` }}>
        {COUNTS.map((n) => {
          const disabled = min != null && n < min
          const active = n === value
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              className={cn(
                'font-poppins font-medium transition-colors',
                active ? 'bg-[#0d0d09] text-[#fffcf9]' : 'bg-white text-[#1F2230] hover:bg-[#FAFAF7]',
                disabled && 'opacity-35 cursor-not-allowed hover:bg-white',
              )}
              style={{ width: 38, height: 32, fontSize: 12.5, borderRight: n === 6 ? 'none' : `1px solid ${HAIRLINE}` }}
            >
              {n}
            </button>
          )
        })}
      </div>
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
  onChange: (patch: { min_referees?: number; max_referees?: number; relationship_rules?: RelationshipRule[] }) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3
          className="font-poppins font-semibold text-[#0d0d09]"
          style={{ fontSize: 18, letterSpacing: '-0.04em' }}
        >
          Requirements
        </h3>
        <p className="mt-1 font-inter text-[12.5px] text-[#5A6072]">
          How many referees this template asks for, and who they must be.
        </p>
      </div>

      <div className="flex flex-wrap gap-6">
        <CountGroup
          label="Minimum referees"
          value={min}
          onChange={(n) => onChange({ min_referees: n, max_referees: Math.max(n, max) })}
        />
        <CountGroup label="Maximum referees" value={max} min={min} onChange={(n) => onChange({ max_referees: n })} />
      </div>

      <div className="space-y-2.5" style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 16 }}>
        <div className="flex items-center justify-between gap-3">
          <p className="font-poppins font-medium text-[#0d0d09]" style={{ fontSize: 13.5 }}>
            Relationship rules
          </p>
          <Button
            variant="secondary"
            size="xs"
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
        </div>

        {rules.length === 0 && (
          <p className="font-inter" style={{ fontSize: 12, color: MUTED }}>
            No relationship rules — any referee mix is accepted.
          </p>
        )}

        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex flex-wrap items-center gap-2 bg-white border rounded-xl px-2.5 py-2"
            style={{ borderColor: HAIRLINE }}
          >
            <span className="font-inter text-[12.5px] text-[#5A6072]">At least</span>
            <Input
              type="number"
              min={1}
              max={6}
              value={rule.count}
              onChange={(e) =>
                onChange({
                  relationship_rules: rules.map((r) =>
                    r.id === rule.id ? { ...r, count: Math.max(1, Math.min(6, Number(e.target.value) || 1)) } : r,
                  ),
                })
              }
              className="h-[32px] w-[58px] font-inter text-[13px]"
            />
            <span className="font-inter text-[12.5px] text-[#5A6072]">referee must be a</span>
            <Select
              value={rule.relationship}
              onValueChange={(v) =>
                onChange({
                  relationship_rules: rules.map((r) => (r.id === rule.id ? { ...r, relationship: v } : r)),
                })
              }
            >
              <SelectTrigger className="h-[32px] w-[190px] font-inter text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center gap-2">
              <div className="inline-flex rounded-lg overflow-hidden" style={{ border: `1px solid ${HAIRLINE}` }}>
                {[
                  { key: true, label: 'Enforced' },
                  { key: false, label: 'Advisory' },
                ].map((opt) => (
                  <button
                    key={String(opt.key)}
                    type="button"
                    onClick={() =>
                      onChange({
                        relationship_rules: rules.map((r) =>
                          r.id === rule.id ? { ...r, enforced: opt.key } : r,
                        ),
                      })
                    }
                    className={cn(
                      'font-inter font-medium px-2.5 transition-colors',
                      rule.enforced === opt.key
                        ? 'bg-[#EDE4FF] text-[#5B21B6]'
                        : 'bg-white text-[#5A6072] hover:bg-[#FAFAF7]',
                    )}
                    style={{ height: 30, fontSize: 11.5 }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="xs"
                icon={Trash2}
                iconOnly
                aria-label="Delete rule"
                onClick={() => onChange({ relationship_rules: rules.filter((r) => r.id !== rule.id) })}
              />
            </div>
          </div>
        ))}

        <p className="font-inter leading-relaxed" style={{ fontSize: 11.5, color: MUTED }}>
          Enforced rules block the candidate from submitting their referee list until they are
          satisfied. Advisory rules are shown as guidance only. Recruiters can override the required
          referee count on an individual request.
        </p>
      </div>
    </div>
  )
}
