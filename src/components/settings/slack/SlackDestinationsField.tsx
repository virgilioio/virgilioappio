import { useState } from 'react'
import { Hash, Lock, Plus, RotateCw, UserRound, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PersonAvatar } from '@/components/candidates/comments/PersonAvatar'
import { IconTip } from '@/components/ui/tooltip'
import {
  ROLE_HINT,
  ROLE_LABEL,
  destinationLabel,
  type SlackDestination,
  type SlackDirectory,
  type SlackRole,
} from '@/lib/slack'
import { cn } from '@/lib/utils'

/**
 * Where an automation sends (2026-10-27): chips for what's picked, then Add,
 * a §19 picker with three groups: channels (a lock for private ones), people
 * in your Slack, and the job's people (the Recruiter, Sourcer, Hiring manager,
 * the interviewer), who get a DM when Gio finds them in Slack by email.
 */
const keyOf = (d: SlackDestination) => (d.type === 'role' ? `role:${d.role}` : `${d.type}:${d.id}`)

export function SlackDestinationsField({
  value,
  onChange,
  directory,
  loading,
  error,
  onRetry,
  roles,
  invalid,
  describedBy,
}: {
  value: SlackDestination[]
  onChange: (next: SlackDestination[]) => void
  directory: SlackDirectory | undefined
  loading: boolean
  error: string | null
  onRetry: () => void
  roles: SlackRole[]
  invalid?: boolean
  describedBy?: string
}) {
  const [open, setOpen] = useState(false)
  const picked = new Set(value.map(keyOf))
  const add = (d: SlackDestination) => {
    if (picked.has(keyOf(d)) || value.length >= 10) return
    onChange([...value, d])
  }
  const remove = (d: SlackDestination) => onChange(value.filter((x) => keyOf(x) !== keyOf(d)))

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5" aria-describedby={describedBy}>
        {value.map((d) => (
          <span
            key={keyOf(d)}
            className="inline-flex h-7 max-w-[240px] items-center gap-1.5 rounded-lg bg-[#F1F0EC] pl-2 pr-1 font-inter text-[12.5px] text-text-primary"
          >
            {d.type === 'channel' ? (
              <Hash className="h-3.5 w-3.5 shrink-0 text-[#5A6072]" aria-hidden />
            ) : d.type === 'user' ? (
              <UserRound className="h-3.5 w-3.5 shrink-0 text-[#5A6072]" aria-hidden />
            ) : (
              <Users className="h-3.5 w-3.5 shrink-0 text-[#6F3FF5]" aria-hidden />
            )}
            <span className="truncate">{d.type === 'channel' ? d.name : destinationLabel(d)}</span>
            <IconTip label="Remove">
              <button
                type="button"
                aria-label={`Remove ${destinationLabel(d)}`}
                onClick={() => remove(d)}
                className="gio-pressable grid h-5 w-5 place-items-center rounded-md text-[#6B7080] hover:bg-[#E4E2DC] hover:text-[#1F2230]"
              >
                <X className="h-3 w-3" />
              </button>
            </IconTip>
          </span>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={Plus}
              disabled={value.length >= 10}
              aria-invalid={invalid || undefined}
              className={cn(invalid && 'ring-1 ring-[#C2372B]')}
            >
              {value.length ? 'Add' : 'Add a channel or person'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[300px] p-[var(--menu-pad)]" data-escape-local>
            <Command>
              <CommandInput placeholder="Search channels and people" />
              <CommandList className="h-[300px] overflow-y-auto">
                {roles.length > 0 && (
                  <CommandGroup heading="The job's people, by DM">
                    {roles.map((r) => {
                      const d: SlackDestination = { type: 'role', role: r }
                      return (
                        <CommandItem
                          key={r}
                          value={`role ${ROLE_LABEL[r]}`}
                          disabled={picked.has(keyOf(d))}
                          onSelect={() => add(d)}
                          className={cn(ROLE_HINT[r] && 'items-start')}
                        >
                          <Users />
                          {ROLE_HINT[r] ? (
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">The {ROLE_LABEL[r].toLowerCase()}</span>
                              <span className="block truncate text-[12px] leading-4 [color:hsl(var(--menu-group-color))]">
                                {ROLE_HINT[r]}
                              </span>
                            </span>
                          ) : (
                            <span className="truncate">The {ROLE_LABEL[r].toLowerCase()}</span>
                          )}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                )}
                {loading ? (
                  <p className="px-2 py-3 font-inter text-[12.5px] text-text-tertiary">Loading your Slack&hellip;</p>
                ) : error ? (
                  <div className="flex items-center justify-between gap-2 px-2 py-3">
                    <p className="font-inter text-[12.5px] text-text-secondary">{error}</p>
                    <Button type="button" size="xs" variant="ghost" icon={RotateCw} onClick={onRetry}>
                      Retry
                    </Button>
                  </div>
                ) : (
                  <>
                    <CommandEmpty>Nothing in your Slack matches.</CommandEmpty>
                    <CommandGroup heading="Channels">
                      {(directory?.channels ?? []).map((c) => {
                        const d: SlackDestination = { type: 'channel', id: c.id, name: c.name }
                        return (
                          <CommandItem key={c.id} value={`channel ${c.name} ${c.id}`} disabled={picked.has(keyOf(d))} onSelect={() => add(d)}>
                            {c.is_private ? <Lock /> : <Hash />}
                            <span className="truncate">{c.name}</span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                    <CommandGroup heading="People">
                      {(directory?.users ?? []).map((u) => {
                        const d: SlackDestination = { type: 'user', id: u.id, name: u.name }
                        return (
                          <CommandItem key={u.id} value={`person ${u.name} ${u.handle} ${u.id}`} disabled={picked.has(keyOf(d))} onSelect={() => add(d)}>
                            <span data-menu-lead className="grid h-5 w-5 place-items-center">
                              <PersonAvatar name={u.name} url={u.avatar} className="h-5 w-5" />
                            </span>
                            <span className="truncate">{u.name}</span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
