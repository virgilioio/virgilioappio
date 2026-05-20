import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, Minus, Plus, Search, Tag as TagIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { menuPanel, menuGroupLabel, menuSeparator } from '@/lib/menu-classes'
import { useTags, useCandidateTagsMap, useTagMutations, tagColorClasses, TAG_COLOR_PRESETS, pushRecentTagId, getRecentTagIds, type Tag } from '@/hooks/useTags'
import { toast } from '@/hooks/use-toast'

interface AddTagPopoverProps {
  candidateIds: string[]
  candidateNames?: string[]
  trigger: ReactNode
  align?: 'start' | 'center' | 'end'
  open?: boolean
  onOpenChange?: (o: boolean) => void
}

type AppliedState = 'none' | 'partial' | 'all'

export function AddTagPopover({
  candidateIds, candidateNames, trigger, align = 'end', open: controlledOpen, onOpenChange,
}: AddTagPopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = (o: boolean) => { isControlled ? onOpenChange?.(o) : setUncontrolledOpen(o); if (!o) onOpenChange?.(o) }

  const { tags } = useTags()
  const { data: mapByCand } = useCandidateTagsMap(candidateIds)
  const { applyTags, createTag } = useTagMutations()

  const [query, setQuery] = useState('')
  const [colorIdx, setColorIdx] = useState(0)
  const sessionChanges = useRef<{ added: Set<string>; removed: Set<string> }>({ added: new Set(), removed: new Set() })

  // Compute applied state per tag from the current map
  const stateByTagId = useMemo(() => {
    const out: Record<string, AppliedState> = {}
    if (!mapByCand || candidateIds.length === 0) return out
    for (const t of tags) {
      let withTag = 0
      for (const cid of candidateIds) {
        if (mapByCand[cid]?.includes(t.id)) withTag++
      }
      if (withTag === 0) out[t.id] = 'none'
      else if (withTag === candidateIds.length) out[t.id] = 'all'
      else out[t.id] = 'partial'
    }
    return out
  }, [tags, mapByCand, candidateIds])

  const trimmed = query.trim()
  const filtered = useMemo(() => {
    if (!trimmed) return tags
    const q = trimmed.toLowerCase()
    return tags.filter(t => t.name.toLowerCase().includes(q))
  }, [tags, trimmed])

  const recent = useMemo(() => {
    if (trimmed) return [] as Tag[]
    const ids = getRecentTagIds()
    return ids.map(id => tags.find(t => t.id === id)).filter(Boolean) as Tag[]
  }, [tags, trimmed, open])

  const exactMatch = useMemo(
    () => trimmed && tags.some(t => t.name.toLowerCase() === trimmed.toLowerCase()),
    [tags, trimmed],
  )

  const headerLabel = candidateIds.length === 1
    ? (candidateNames?.[0] ?? '1 candidate')
    : `${candidateIds.length} candidates`

  const headerNames = (candidateNames ?? []).slice(0, 3).join(', ') +
    ((candidateNames?.length ?? 0) > 3 ? ` +${(candidateNames!.length - 3)}` : '')

  async function toggle(tag: Tag) {
    const state = stateByTagId[tag.id] ?? 'none'
    try {
      if (state === 'all') {
        await applyTags.mutateAsync({ candidateIds, removeTagIds: [tag.id] })
        sessionChanges.current.removed.add(tag.id)
        sessionChanges.current.added.delete(tag.id)
      } else {
        // none or partial → apply to all
        await applyTags.mutateAsync({ candidateIds, addTagIds: [tag.id] })
        sessionChanges.current.added.add(tag.id)
        sessionChanges.current.removed.delete(tag.id)
        pushRecentTagId(tag.id)
      }
    } catch (e: any) {
      toast({ title: "Couldn't update tag", description: e?.message, variant: 'destructive' })
    }
  }

  async function handleCreate() {
    if (!trimmed) return
    try {
      const created = await createTag.mutateAsync({
        name: trimmed,
        color: TAG_COLOR_PRESETS[colorIdx % TAG_COLOR_PRESETS.length],
      })
      setColorIdx(i => i + 1)
      await applyTags.mutateAsync({ candidateIds, addTagIds: [created.id] })
      sessionChanges.current.added.add(created.id)
      pushRecentTagId(created.id)
      setQuery('')
    } catch (e: any) {
      toast({ title: "Couldn't create tag", description: e?.message, variant: 'destructive' })
    }
  }

  // On close, fire consolidated toast with undo
  useEffect(() => {
    if (open) return
    const { added, removed } = sessionChanges.current
    if (added.size === 0 && removed.size === 0) return
    const addedIds = Array.from(added)
    const removedIds = Array.from(removed)
    sessionChanges.current = { added: new Set(), removed: new Set() }
    const total = addedIds.length + removedIds.length
    toast({
      title: `${total} tag${total === 1 ? '' : 's'} updated · ${candidateIds.length} candidate${candidateIds.length === 1 ? '' : 's'}`,
      action: (
        <button
          type="button"
          className="ml-2 inline-flex items-center h-7 px-2 rounded-md text-[11.5px] font-poppins font-medium border border-white/20 text-white hover:bg-white/10"
          onClick={async () => {
            // Inverse: remove what we added, re-add what we removed
            try {
              if (addedIds.length) await applyTags.mutateAsync({ candidateIds, removeTagIds: addedIds })
              if (removedIds.length) await applyTags.mutateAsync({ candidateIds, addTagIds: removedIds })
            } catch {}
          }}
        >
          Undo
        </button>
      ) as any,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} sideOffset={8} className={cn(menuPanel, 'w-[320px] p-0 overflow-hidden')}>
        {/* Header */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 text-[12.5px] font-poppins font-medium text-text-primary">
            <TagIcon className="h-3.5 w-3.5 text-virgilio-purple" />
            Tag {headerLabel}
          </div>
          {headerNames && (
            <div className="mt-0.5 text-[11.5px] text-text-tertiary truncate">{headerNames}</div>
          )}
        </div>

        {/* Search */}
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Find or create a tag…"
              className="w-full h-8 pl-7 pr-2 rounded-md border border-virgilio-border bg-white text-[12.5px] font-inter outline-none focus:ring-2 focus:ring-virgilio-purple/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && trimmed && !exactMatch) {
                  e.preventDefault()
                  handleCreate()
                }
              }}
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-[300px] overflow-y-auto px-1 pb-1">
          {tags.length === 0 && !trimmed && (
            <div className="px-3 py-6 text-center text-[12px] text-text-tertiary">
              No tags yet. Start typing to create one.
            </div>
          )}

          {!trimmed && recent.length > 0 && (
            <>
              <div className={menuGroupLabel}>Recently used</div>
              {recent.map(t => (
                <TagRow key={`r-${t.id}`} tag={t} state={stateByTagId[t.id] ?? 'none'} onToggle={() => toggle(t)} />
              ))}
              <div className={menuSeparator} />
            </>
          )}

          {filtered.length > 0 && (
            <>
              {!trimmed && <div className={menuGroupLabel}>All tags · {tags.length}</div>}
              {trimmed && <div className={menuGroupLabel}>{filtered.length} match{filtered.length === 1 ? '' : 'es'}</div>}
              {filtered.map(t => (
                <TagRow key={t.id} tag={t} state={stateByTagId[t.id] ?? 'none'} onToggle={() => toggle(t)} />
              ))}
            </>
          )}

          {trimmed && !exactMatch && (
            <>
              {filtered.length > 0 && <div className={menuSeparator} />}
              <button
                type="button"
                onClick={handleCreate}
                className="w-full flex items-center gap-2 h-[30px] px-2 rounded-md text-[12.5px] font-inter text-text-primary hover:bg-[#F1F0EC]"
              >
                <Plus className="h-3.5 w-3.5 text-virgilio-purple" />
                Create <span className="font-medium">"{trimmed}"</span> as a new tag
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-virgilio-border px-3 py-2 text-[11px] text-text-tertiary">
          Changes apply instantly
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TagRow({ tag, state, onToggle }: { tag: Tag; state: AppliedState; onToggle: () => void }) {
  const c = tagColorClasses(tag.color)
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-2 h-[30px] px-2 rounded-md text-[12.5px] font-inter text-text-primary hover:bg-[#F1F0EC]"
    >
      <span className={cn(
        'h-[14px] w-[14px] rounded-[3px] border inline-flex items-center justify-center shrink-0',
        state === 'all' ? 'bg-virgilio-purple border-virgilio-purple text-white' :
        state === 'partial' ? 'bg-virgilio-purple/15 border-virgilio-purple/40 text-virgilio-purple' :
        'border-virgilio-border bg-white text-transparent',
      )}>
        {state === 'all' && <Check className="h-2.5 w-2.5" />}
        {state === 'partial' && <Minus className="h-2.5 w-2.5" />}
      </span>
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
      <span className="flex-1 text-left truncate">{tag.name}</span>
      {typeof tag.usage_count === 'number' && tag.usage_count > 0 && (
        <span className="text-[10.5px] text-text-tertiary tabular-nums">{tag.usage_count}</span>
      )}
    </button>
  )
}
