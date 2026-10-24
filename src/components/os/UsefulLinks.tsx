import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Archive, ExternalLink, Link2, MoreHorizontal, Pencil, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CharCounterLine } from '@/components/ui/char-counter'
import { IconTip } from '@/components/ui/tooltip'
import { shakeFirstInvalid } from '@/lib/motion'
import { undoToast } from '@/lib/undoToast'
import { hostOf, linkProblems, normalUrl, useArchiveLink, useMoveLink, useSaveLink, type LinkDraft, type UsefulLink } from '@/lib/os/usefulLinks'

const ICON_BTN =
  'gio-pressable inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#6B7080] transition-colors duration-hover hover:bg-[#F1F0EC] hover:text-[#1F2230] disabled:opacity-40 disabled:pointer-events-none'

/** One link: an icon chip, the name, a line of description and the site it opens. */
function LinkBody({ link }: { link: UsefulLink }) {
  return (
    <>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[#2563EB]" aria-hidden>
        <Link2 className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-inter text-[13px] font-medium text-[#1F2230]">{link.title}</span>
        <span className="block truncate font-inter text-[12px] text-[#6B7080]">
          {link.description ? `${link.description} · ` : ''}
          {hostOf(link.url)}
        </span>
      </span>
    </>
  )
}

/** The read-only list every member sees (My profile home). */
export function UsefulLinksList({ links }: { links: UsefulLink[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {links.map((l) => (
        <li key={l.id}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-[56px] items-center gap-3 rounded-[10px] bg-[#F7F6F2] px-3.5 py-2.5 transition-colors duration-hover hover:bg-[#F1F0EC]"
          >
            <LinkBody link={l} />
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#8B8F9E] transition-colors duration-hover group-hover:text-[#1F2230]" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/** The admin list on /os/links: reorder with the arrows, edit and archive from ⋯. */
export function UsefulLinksEditor({
  tenantId,
  links,
  onEdit,
}: {
  tenantId: string
  links: UsefulLink[]
  onEdit: (link: UsefulLink) => void
}) {
  const archive = useArchiveLink(tenantId)
  const move = useMoveLink(tenantId)

  const moveBy = (i: number, by: -1 | 1) => {
    const order = [...links]
    const [l] = order.splice(i, 1)
    order.splice(i + by, 0, l)
    move.mutate(order, { onError: () => toast.error("Couldn't move the link. Try again.") })
  }

  const doArchive = (l: UsefulLink) =>
    archive.mutate(
      { id: l.id, archived: true },
      {
        onSuccess: () =>
          undoToast(`${l.title} archived`, () =>
            archive.mutate({ id: l.id, archived: false }, { onError: () => toast.error(`Couldn't bring back ${l.title}. Try again.`) }),
          ),
        onError: () => toast.error(`Couldn't archive ${l.title}. Try again.`),
      },
    )

  return (
    <ul className="flex flex-col gap-1.5">
      {links.map((l, i) => (
        <li key={l.id} className="flex min-h-[56px] items-center gap-3 rounded-[10px] bg-[#F7F6F2] px-3.5 py-2.5">
          <LinkBody link={l} />
          <span className="flex shrink-0 items-center gap-0.5">
            <IconTip label="Move up">
              <button type="button" aria-label={`Move ${l.title} up`} disabled={i === 0} onClick={() => moveBy(i, -1)} className={ICON_BTN}>
                <ArrowUp size={14} />
              </button>
            </IconTip>
            <IconTip label="Move down">
              <button
                type="button"
                aria-label={`Move ${l.title} down`}
                disabled={i === links.length - 1}
                onClick={() => moveBy(i, 1)}
                className={ICON_BTN}
              >
                <ArrowDown size={14} />
              </button>
            </IconTip>
            <DropdownMenu>
              <IconTip label={`${l.title} actions`}>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label={`${l.title} actions`} className={ICON_BTN}>
                    <MoreHorizontal size={15} />
                  </button>
                </DropdownMenuTrigger>
              </IconTip>
              <DropdownMenuContent align="end" className="w-[272px]">
                <DropdownMenuItem onSelect={() => window.open(l.url, '_blank', 'noopener,noreferrer')}>
                  <ExternalLink />
                  <span className="truncate">Open</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(l)}>
                  <Pencil />
                  <span className="truncate">Edit</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-danger onSelect={() => doArchive(l)}>
                  <Archive />
                  <span className="truncate">Archive</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Archived links, each with Restore. */
export function ArchivedLinks({ tenantId, links }: { tenantId: string; links: UsefulLink[] }) {
  const archive = useArchiveLink(tenantId)
  return (
    <ul className="flex flex-col gap-1.5">
      {links.map((l) => (
        <li key={l.id} className="flex min-h-[56px] items-center gap-3 rounded-[10px] bg-[#F7F6F2] px-3.5 py-2.5 opacity-80">
          <LinkBody link={l} />
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={() =>
              archive.mutate(
                { id: l.id, archived: false },
                {
                  onSuccess: () => toast.success(`${l.title} is back on everyone's profile.`),
                  onError: () => toast.error(`Couldn't restore ${l.title}. Try again.`),
                },
              )
            }
          >
            Restore
          </Button>
        </li>
      ))}
    </ul>
  )
}

const EMPTY: LinkDraft = { title: '', description: '', url: '' }

/** Add or edit a link. Closes only once the save succeeds; errors stay inside. */
export function LinkDialog({
  open,
  onOpenChange,
  tenantId,
  link,
  nextPosition,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  /** Null to add a new one. */
  link: UsefulLink | null
  nextPosition: number
}) {
  const save = useSaveLink(tenantId)
  const [draft, setDraft] = useState<LinkDraft>(EMPTY)
  const [tried, setTried] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!open) return
    setDraft(link ? { title: link.title, description: link.description ?? '', url: link.url } : EMPTY)
    setTried(false)
    setServerError(null)
  }, [open, link])

  const problems = linkProblems(draft)
  const show = (k: keyof LinkDraft) => (tried ? problems[k] : undefined)
  const set = (k: keyof LinkDraft, v: string) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setServerError(null)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.keys(problems).length) {
      shakeFirstInvalid(formRef.current)
      return
    }
    save.mutate(
      { id: link?.id, draft, position: nextPosition },
      {
        onSuccess: () => {
          toast.success(link ? 'Link saved.' : `${draft.title.trim()} is on everyone's profile.`)
          onOpenChange(false)
        },
        onError: () => setServerError("Couldn't save the link. Check the address and try again."),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[460px]">
        <form ref={formRef} onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{link ? 'Edit link' : 'Add a link'}</DialogTitle>
            <DialogDescription>Every member sees it on the home page of My profile.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-1">
            <FormField label="Name" htmlFor="link-title" error={show('title')}>
              <Input
                id="link-title"
                value={draft.title}
                maxLength={80}
                autoComplete="off"
                disabled={save.isPending}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Team handbook"
                aria-invalid={!!show('title') || undefined}
              />
            </FormField>
            <FormField
              label="Address"
              htmlFor="link-url"
              error={show('url')}
              helpText={!show('url') && draft.url.trim() && !/^https?:\/\//i.test(draft.url.trim()) ? `Opens ${normalUrl(draft.url)}` : undefined}
            >
              <Input
                id="link-url"
                type="url"
                inputMode="url"
                value={draft.url}
                autoComplete="off"
                spellCheck={false}
                disabled={save.isPending}
                onChange={(e) => set('url', e.target.value)}
                placeholder="https://"
                aria-invalid={!!show('url') || undefined}
              />
            </FormField>
            <FormField label="Description" htmlFor="link-description" error={show('description')}>
              <Textarea
                id="link-description"
                value={draft.description}
                rows={2}
                disabled={save.isPending}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Optional: a line about what it's for"
              />
            </FormField>
            <CharCounterLine count={draft.description.length} max={200} />
          </div>
          <p className="min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role={serverError ? 'alert' : undefined}>
            {serverError}
          </p>
          <DialogFooter className="mt-2">
            <Button type="button" variant="secondary" disabled={save.isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {link ? 'Save link' : 'Add link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
