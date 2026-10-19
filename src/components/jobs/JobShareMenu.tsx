import { useEffect, useMemo, useRef, useState } from 'react'
import { IconSwap } from '@/components/ui/icon-swap'
import { useLocation } from 'react-router-dom'
import { Link2, Check, Share2, Globe } from 'lucide-react'
import { pipelinePublicUrl, useJobPipelineShare } from '@/hooks/useJobPipelineShare'
import { copyToClipboardSilent } from '@/utils/clipboard'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { menuItem, menuPanel, menuSeparator } from '@/lib/menu-classes'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { useMembers } from '@/hooks/useMembers'

interface JobShareMenuProps {
  jobId: string
  /** Only shown to users who can edit the hiring team. */
  canManageTeam?: boolean
  onManage?: () => void
}

interface AccessPerson {
  id: string
  name: string
  avatarUrl?: string | null
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] || ''
  const b = parts[1]?.[0] || ''
  return (a + b).toUpperCase() || name.slice(0, 2).toUpperCase() || '?'
}

export function JobShareMenu({ jobId, canManageTeam = false, onManage }: JobShareMenuProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [manualCopy, setManualCopy] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const copyRowRef = useRef<HTMLButtonElement>(null)
  const manualInputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()

  const { assignments } = useJobAssignments(jobId)
  const { share: pipelineShare } = useJobPipelineShare(open ? jobId : null)
  const [pipelineCopied, setPipelineCopied] = useState(false)
  const { members } = useMembers(true)

  const jobUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/jobs/${jobId}`

  // Live access list: hiring team on this job + workspace admins/owners who can see it.
  const people = useMemo<AccessPerson[]>(() => {
    const byId = new Map<string, AccessPerson>()
    const add = (userId?: string | null) => {
      if (!userId || byId.has(userId)) return
      const m = members.find((mm) => mm.user_id === userId)
      const name =
        `${m?.user_first_name || ''} ${m?.user_last_name || ''}`.trim() ||
        m?.user_email ||
        'Member'
      byId.set(userId, { id: userId, name, avatarUrl: m?.user_avatar_url ?? null })
    }
    assignments.forEach((a) => add(a.user_id))
    members
      .filter(
        (m) =>
          m.system_role === 'admin' ||
          m.user_type === 'workspace_owner' ||
          m.user_type === 'platform_admin'
      )
      .forEach((m) => add(m.user_id))
    return Array.from(byId.values())
  }, [assignments, members])

  // Close on outside mousedown / Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Close on route change
  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])

  // Focus first item on open, reset transient states on close
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => copyRowRef.current?.focus())
    } else {
      setCopied(false)
      setManualCopy(false)
    }
  }, [open])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])

  const handleCopy = async () => {
    let ok = false
    try {
      await navigator.clipboard.writeText(jobUrl)
      ok = true
    } catch {
      ok = false
    }
    if (!ok) {
      try {
        const input = manualInputRef.current
        if (input) {
          input.value = jobUrl
          input.removeAttribute('aria-hidden')
          input.focus()
          input.select()
          ok = document.execCommand('copy')
        }
      } catch {
        ok = false
      }
    }
    if (ok) {
      setManualCopy(false)
      setCopied(true)
    } else {
      setManualCopy(true)
      manualInputRef.current?.select()
    }
  }

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const focusables = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || []
    ).filter((el) => !el.hasAttribute('disabled'))
    if (!focusables.length) return
    const idx = focusables.indexOf(document.activeElement as HTMLElement)
    const next =
      e.key === 'ArrowDown'
        ? focusables[(idx + 1 + focusables.length) % focusables.length]
        : focusables[(idx - 1 + focusables.length) % focusables.length]
    next?.focus()
  }

  const visible = people.slice(0, 4)
  const overflow = people.length - visible.length

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        variant="secondary"
        size="md"
        icon={Share2}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Share
      </Button>

      <input
        ref={manualInputRef}
        readOnly
        aria-hidden="true"
        tabIndex={-1}
        className="absolute opacity-0 pointer-events-none h-0 w-0"
      />

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Share job"
          onKeyDown={onPanelKeyDown}
          data-state="open"
          className={cn('absolute right-0 top-10 z-[70] w-[288px] origin-top-right', menuPanel)}
        >
          <button
            ref={copyRowRef}
            role="menuitem"
            type="button"
            onClick={handleCopy}
            className={cn(menuItem, 'items-start hover:bg-[hsl(var(--menu-hover))]')}
          >
            <span data-menu-lead className="grid place-items-center">
              <IconSwap swapped={copied} from={<Link2 />} to={<Check className="text-[#1F7A45]" />} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">
                {copied ? 'Copied to clipboard' : manualCopy ? 'Press ⌘C to copy' : 'Copy job link'}
              </span>
              <span className="block text-[12px] leading-5 text-[hsl(var(--menu-group-color))]">
                Only people with access to this job can open it
              </span>
            </span>
          </button>

          {pipelineShare?.is_public && (
            <button
              role="menuitem"
              type="button"
              onClick={async () => {
                if (await copyToClipboardSilent(pipelinePublicUrl(pipelineShare.token))) {
                  setPipelineCopied(true)
                  setTimeout(() => setPipelineCopied(false), 1600)
                }
              }}
              className={cn(menuItem, 'items-start hover:bg-[hsl(var(--menu-hover))]')}
            >
              <span data-menu-lead className="grid place-items-center">
                <IconSwap swapped={pipelineCopied} from={<Globe />} to={<Check className="text-[#1F7A45]" />} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{pipelineCopied ? 'Copied to clipboard' : 'Copy client pipeline link'}</span>
                <span className="block text-[12px] leading-5 text-[hsl(var(--menu-group-color))]">
                  Anyone with the link · shared stages onward
                </span>
              </span>
            </button>
          )}

          {/* The footer (Gio Docs' menu foot): who has access, and Manage. */}
          <div aria-hidden className={menuSeparator} />
          <div className="flex min-h-[28px] items-center gap-2 px-2 py-1 font-inter text-[12px] leading-5 text-[hsl(var(--menu-group-color))]">
            <div className="flex shrink-0 -space-x-1.5">
              {visible.map((p) => (
                <Avatar key={p.id} className="h-5 w-5 ring-2 ring-white">
                  {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="bg-virgilio-purple text-[9px] font-medium text-white">
                    {initials(p.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {overflow > 0 && (
                <div className="grid h-5 min-w-5 place-items-center rounded-full bg-[#F1F0EC] px-1 text-[9px] font-medium text-[#5A6072] ring-2 ring-white">
                  +{overflow}
                </div>
              )}
            </div>
            <span className="truncate">
              {people.length} {people.length === 1 ? 'person has' : 'people have'} access
            </span>
            {canManageTeam && onManage && (
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false)
                  onManage()
                }}
                className="ml-auto shrink-0 font-semibold text-virgilio-purple hover:underline focus:underline"
              >
                Manage
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default JobShareMenu
