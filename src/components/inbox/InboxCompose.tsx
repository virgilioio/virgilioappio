import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Mail, Search, X } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { Input } from '@/components/ui/input'
import { IconTip } from '@/components/ui/tooltip'
import { PersonAvatar } from '@/components/candidates/comments/PersonAvatar'
import { cn } from '@/lib/utils'
import { menuItem } from '@/lib/menu-classes'

export interface PickedCandidate {
  id: string
  name: string
  email: string
}

/**
 * Compose, step one: the Inbox is candidate mail only, so a new email starts
 * with who it's to. Same corner panel as the Gio composer, which takes over
 * once a candidate is picked.
 */
export function ComposePicker({ onPick, onClose }: { onPick: (c: PickedCandidate) => void; onClose: () => void }) {
  const [q, setQ] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [hi, setHi] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 150)
    return () => clearTimeout(t)
  }, [q])
  React.useEffect(() => inputRef.current?.focus(), [])

  const results = useQuery({
    queryKey: ['inbox', 'compose-candidates', debounced],
    enabled: debounced.length >= 2,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      // Commas and brackets would break the or() filter: search for the words around them.
      const term = debounced.replace(/[,()*%\\]/g, ' ').trim()
      const { data, error } = await supabase
        .from('candidates')
        .select('id, candidate_name, email, contact_email')
        .is('deleted_at', null)
        .is('merged_into', null)
        .or(`candidate_name.ilike.%${term}%,email.ilike.%${term}%,contact_email.ilike.%${term}%`)
        .order('updated_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return (data ?? [])
        .map(c => ({ id: c.id, name: c.candidate_name || 'Unnamed candidate', email: (c.email || c.contact_email || '').trim() }))
    },
  })
  const rows = debounced.length >= 2 ? results.data ?? [] : []
  React.useEffect(() => setHi(0), [debounced])

  const pick = (c: PickedCandidate | undefined) => {
    if (c && c.email) onPick(c)
  }

  return (
    <div
      role="dialog"
      aria-label="New email"
      className="fixed bottom-4 right-4 z-[60] flex w-[440px] max-w-[calc(100vw-32px)] flex-col overflow-hidden bg-white"
      style={{
        height: 'min(70vh, 460px)',
        borderRadius: 14,
        border: '1px solid #E7E8EE',
        boxShadow: '0 24px 64px -12px rgba(13,13,9,0.28), 0 0 0 1px rgba(13,13,9,0.04)',
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="flex shrink-0 items-center gap-2" style={{ background: '#0d0d09', padding: '10px 14px' }}>
        <Mail className="h-[13px] w-[13px]" style={{ color: '#fffcf9' }} />
        <span className="flex-1 truncate font-poppins font-semibold" style={{ fontSize: 13, color: '#fffcf9', letterSpacing: '-0.01em' }}>
          New email
        </span>
        <IconTip label="Close">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-md transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,252,249,0.7)' }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </IconTip>
      </div>

      <div className="shrink-0 px-4 pt-3.5">
        <label htmlFor="inbox-compose-to" className="text-[12px] font-medium text-[#5A6072]">
          To
        </label>
        <div className="relative mt-1.5">
          {results.isFetching && debounced.length >= 2 ? (
            <span aria-hidden className="gio-spinner gio-spinner-current absolute left-3 top-1/2 -mt-[6.5px] h-[13px] w-[13px] text-text-tertiary" />
          ) : (
            <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          )}
          <Input
            id="inbox-compose-to"
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="A candidate's name or email"
            autoComplete="off"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls="inbox-compose-results"
            aria-activedescendant={rows[hi] ? `inbox-compose-${rows[hi].id}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHi(h => Math.min(h + 1, Math.max(rows.length - 1, 0)))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHi(h => Math.max(h - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                pick(rows[hi])
              }
            }}
            className="h-9 pl-9 text-[13px]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {debounced.length < 2 ? (
          <p className="px-2 pt-2 text-[12.5px] text-[#6B7080]">
            The Inbox is for candidate email: start with who it's to.
          </p>
        ) : results.isError ? (
          <p role="alert" className="px-2 pt-2 text-[12.5px] text-[#B91C1C]">Couldn't search candidates. Try again in a moment.</p>
        ) : rows.length === 0 && !results.isFetching ? (
          <p className="px-2 pt-2 text-[12.5px] text-[#6B7080]">No candidate matches “{debounced}”.</p>
        ) : (
          <ul id="inbox-compose-results" role="listbox" aria-label="Candidates">
            {rows.map((c, i) => (
              <li key={c.id} id={`inbox-compose-${c.id}`} role="option" aria-selected={i === hi} aria-disabled={!c.email}>
                <button
                  type="button"
                  disabled={!c.email}
                  onMouseMove={() => setHi(i)}
                  onClick={() => pick(c)}
                  className={cn(menuItem, 'w-full', i === hi && 'bg-[hsl(var(--menu-hover))]', !c.email && 'opacity-60')}
                >
                  <span data-menu-lead className="flex h-5 w-5 items-center justify-center">
                    <PersonAvatar name={c.name} email={c.email} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{c.name}</span>
                  <span className="max-w-[180px] truncate text-[12px] text-[#6B7080]">{c.email || 'No email on file'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
