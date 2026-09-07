import { useState } from 'react'
import { ChevronDown, Plus, Flag, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { JOB_PRIORITIES } from '@/lib/job-priority'

interface JobPriorityFilterChipProps {
  selected: string[]
  onChange: (values: string[]) => void
}

export function JobPriorityFilterChip({ selected, onChange }: JobPriorityFilterChipProps) {
  const [open, setOpen] = useState(false)
  const active = selected.length > 0
  const LeadIcon = active ? Flag : Plus

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(v => v !== id) : [...selected, id])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter by priority"
          className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-lg transition-colors"
          style={{
            background: active ? '#EFE9FE' : '#FFFFFF',
            border: `1px solid ${active ? '#C7B4F8' : '#E7E8EE'}`,
            color: active ? '#4B21C0' : '#5A6072',
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            fontWeight: active ? 600 : 500,
          }}
        >
          <LeadIcon size={13} strokeWidth={2} />
          <span>Priority{active ? ` · ${selected.length}` : ''}</span>
          <ChevronDown size={13} strokeWidth={2} style={{ opacity: 0.65 }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-0 border-0 bg-transparent shadow-none w-auto"
      >
        <div
          style={{
            width: 190,
            background: '#FFFFFF',
            border: '1px solid #E7E8EE',
            borderRadius: 10,
            boxShadow: '0 12px 28px rgba(13,13,9,0.12)',
            padding: 6,
          }}
        >
          {JOB_PRIORITIES.map(p => {
            const checked = selected.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                aria-pressed={checked}
                className="w-full inline-flex items-center gap-2 text-left"
                style={{
                  padding: '7px 8px',
                  borderRadius: 7,
                  background: checked ? '#F6F5F1' : 'transparent',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: '#0d0d09',
                }}
              >
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    flex: '0 0 14px',
                    background: checked ? '#6F3FF5' : '#FFFFFF',
                    border: `1px solid ${checked ? '#6F3FF5' : '#D8D9E0'}`,
                    color: '#FFFFFF',
                  }}
                >
                  {checked && <Check size={10} strokeWidth={3} />}
                </span>
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: p.dot, flex: '0 0 7px' }} />
                <span>{p.label}</span>
              </button>
            )
          })}

          <div style={{ borderTop: '1px solid #F1F0EC', marginTop: 6, paddingTop: 6 }} className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onChange([])}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: 500,
                color: '#5A6072',
                padding: '5px 8px',
                borderRadius: 7,
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: '#0d0d09',
                color: '#FFFCF9',
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 8,
              }}
            >
              Done
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
