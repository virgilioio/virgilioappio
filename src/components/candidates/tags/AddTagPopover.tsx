import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ArrowLeft, Check, Minus, Plus, Search, Sparkles, Tag as TagIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { menuPanel, menuGroupLabel, menuSeparator } from '@/lib/menu-classes'
import { Button } from '@/components/ui/button'
import { useTags, useCandidateTagsMap, useTagMutations, tagColorClasses, TAG_COLOR_PRESETS, pushRecentTagId, getRecentTagIds, type Tag } from '@/hooks/useTags'
import { TagChip } from '@/components/candidates/tags/TagChip'
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
  const [mode, setMode] = useState<'list' | 'create'>('list')
  const [draftName, setDraftName] = useState('')
  const [draftColor, setDraftColor] = useState<string>(TAG_COLOR_PRESETS[0])
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)
  const sessionChanges = useRef<{ added: Set<string>; removed: Set<string> }>({ added: new Set(), removed: new Set() })

  // Reset transient state when popover closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setMode('list')
      setDraftName('')
      setDraftColor(TAG_COLOR_PRESETS[0])
      setJustCreatedId(null)
    }
  }, [open])

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

  // Hide the just-created tag from the main list to avoid double rendering
  const filteredWithoutJustCreated = useMemo(
    () => justCreatedId ? filtered.filter(t => t.id !== justCreatedId) : filtered,
    [filtered, justCreatedId],
  )

  const recent = useMemo(() => {
    if (trimmed) return [] as Tag[]
    const ids = getRecentTagIds()
    return ids
      .map(id => tags.find(t => t.id === id))
      .filter(Boolean)
      .filter(t => (t as Tag).id !== justCreatedId) as Tag[]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags, trimmed, open, justCreatedId])

  const justCreatedTag = useMemo(
    () => justCreatedId ? tags.find(t => t.id === justCreatedId) ?? null : null,
    [tags, justCreatedId],
  )

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
        await applyTags.mutateAsync({ candidateIds, addTagIds: [tag.id] })
        sessionChanges.current.added.add(tag.id)
        sessionChanges.current.removed.delete(tag.id)
        pushRecentTagId(tag.id)
      }
    } catch (e: any) {
      toast({ title: "Couldn't update tag", description: e?.message, variant: 'destructive' })
    }
  }

  function openCreatePanel(prefill?: string) {
    setDraftName((prefill ?? trimmed) || '')
    setDraftColor(TAG_COLOR_PRESETS[0])
    setMode('create')
  }

  async function submitCreate() {
    const n = draftName.trim()
    if (!n) return
    try {
      const created = await createTag.mutateAsync({ name: n, color: draftColor })
      await applyTags.mutateAsync({ candidateIds, addTagIds: [created.id] })
      sessionChanges.current.added.add(created.id)
      pushRecentTagId(created.id)
      setJustCreatedId(created.id)
      setQuery('')
      setMode('list')
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
            {mode === 'create' ? (
              <>
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  aria-label="Back"
                  className="-ml-1 h-6 w-6 inline-flex items-center justify-center rounded-md text-text-tertiary hover:bg-[#F1F0EC]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <TagIcon className="h-3.5 w-3.5 text-virgilio-purple" />
                Create new tag
              </>
            ) : (
              <>
                <TagIcon className="h-3.5 w-3.5 text-virgilio-purple" />
                Tag {headerLabel}
              </>
            )}
          </div>
          {mode === 'list' && headerNames && (
            <div className="mt-0.5 text-[11.5px] text-text-tertiary truncate">{headerNames}</div>
          )}
          {mode === 'create' && (
            <div className="mt-0.5 text-[11.5px] text-text-tertiary truncate">
              Will apply to {candidateIds.length} selected candidate{candidateIds.length === 1 ? '' : 's'}
            </div>
          )}
        </div>

        {mode === 'list' ? (
          <>
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
                      openCreatePanel()
                    }
                  }}
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-[300px] overflow-y-auto px-1 pb-1">
              {/* Just created */}
              {justCreatedTag && (
                <>
                  <div className={cn(menuGroupLabel, 'flex items-center gap-1')}>
                    <Sparkles className="h-2.5 w-2.5 text-virgilio-purple" />
                    Just created
                  </div>
                  <TagRow tag={justCreatedTag} state={stateByTagId[justCreatedTag.id] ?? 'none'} onToggle={() => toggle(justCreatedTag)} isNew />
                  <div className={menuSeparator} />
                </>
              )}

              {tags.length === 0 && !trimmed && !justCreatedTag && (
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

              {filteredWithoutJustCreated.length > 0 && (
                <>
                  {!trimmed && <div className={menuGroupLabel}>All tags · {tags.length}</div>}
                  {trimmed && <div className={menuGroupLabel}>{filteredWithoutJustCreated.length} match{filteredWithoutJustCreated.length === 1 ? '' : 'es'}</div>}
                  {filteredWithoutJustCreated.map(t => (
                    <TagRow key={t.id} tag={t} state={stateByTagId[t.id] ?? 'none'} onToggle={() => toggle(t)} />
                  ))}
                </>
              )}

              {/* No-matches empty state */}
              {trimmed && filteredWithoutJustCreated.length === 0 && !exactMatch && (
                <div className="px-3 py-6 text-center">
                  <div className="mx-auto mb-2 h-9 w-9 rounded-full bg-[#F1F0EC] inline-flex items-center justify-center">
                    <Search className="h-4 w-4 text-text-tertiary" />
                  </div>
                  <div className="text-[12px] text-text-primary font-poppins font-medium">No existing tag matches</div>
                  <div className="text-[11px] text-text-tertiary">Create one below to use it on these candidates.</div>
                </div>
              )}
            </div>

            {/* Pinned Create CTA */}
            {trimmed && !exactMatch && (
              <button
                type="button"
                onClick={() => openCreatePanel()}
                className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-virgilio-border bg-[#0d0d09] text-[12.5px] font-poppins font-medium text-white hover:bg-[#1a1a14] transition-colors"
              >
                <span className="h-5 w-5 rounded-md bg-virgilio-purple inline-flex items-center justify-center">
                  <Plus className="h-3 w-3 text-white" />
                </span>
                Create <span className="font-semibold">"{trimmed}"</span> as a new tag
              </button>
            )}

            {/* Footer */}
            {(!trimmed || exactMatch) && (
              <div className="border-t border-virgilio-border px-3 py-2 text-[11px] text-text-tertiary">
                Changes apply instantly
              </div>
            )}
          </>
        ) : (
          /* Create panel */
          <div className="px-3 pb-3 pt-1">
            <label className="block text-[10.5px] font-poppins font-semibold uppercase tracking-[0.06em] text-[#8B8F9E] mb-1">
              Tag name
            </label>
            <input
              autoFocus
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitCreate() } }}
              placeholder="Tag name…"
              className="w-full h-8 px-2 rounded-md border border-virgilio-border bg-white text-[12.5px] font-inter outline-none focus:ring-2 focus:ring-virgilio-purple/30"
            />

            <div className="mt-3">
              <label className="block text-[10.5px] font-poppins font-semibold uppercase tracking-[0.06em] text-[#8B8F9E] mb-1.5">
                Color
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TAG_COLOR_PRESETS.map(c => {
                  const cls = tagColorClasses(c)
                  const selected = c === draftColor
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraftColor(c)}
                      aria-label={`Color ${c}`}
                      className={cn(
                        'h-7 w-7 rounded-md inline-flex items-center justify-center transition',
                        cls.dot,
                        selected ? 'ring-2 ring-offset-1 ring-virgilio-purple' : 'opacity-90 hover:opacity-100',
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-[10.5px] font-poppins font-semibold uppercase tracking-[0.06em] text-[#8B8F9E] mb-1.5">
                Preview
              </label>
              <div className="min-h-[26px] flex items-center">
                {draftName.trim()
                  ? <TagChip name={draftName.trim()} color={draftColor} size="md" />
                  : <span className="text-[11.5px] text-text-tertiary italic">Tag will appear in your library</span>}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setMode('list')} disabled={createTag.isPending}>
                Back
              </Button>
              <Button size="sm" onClick={submitCreate} disabled={!draftName.trim() || createTag.isPending}>
                {createTag.isPending ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function TagRow({ tag, state, onToggle, isNew }: { tag: Tag; state: AppliedState; onToggle: () => void; isNew?: boolean }) {
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
      {isNew && (
        <span className="text-[9.5px] font-poppins font-semibold uppercase tracking-[0.06em] text-virgilio-purple bg-virgilio-purple/10 px-1.5 py-0.5 rounded">
          New
        </span>
      )}
      {!isNew && typeof tag.usage_count === 'number' && tag.usage_count > 0 && (
        <span className="text-[10.5px] text-text-tertiary tabular-nums">{tag.usage_count}</span>
      )}
    </button>
  )
}
