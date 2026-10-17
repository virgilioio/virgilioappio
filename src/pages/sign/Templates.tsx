import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, RotateCcw, Search, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ListPage, MetaDot } from '@/components/layout/ListPage'
import { ListTabs } from '@/components/ui/list-tabs'
import { FilterChipPopover } from '@/components/ui/filter-chip-popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Loadable } from '@/components/ui/loadable'
import { AnimatedEmpty, EmptyCard } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { TemplateCard } from '@/components/sign/templates/TemplateCard'
import { TemplateWizard, type WizardMode } from '@/components/sign/templates/TemplateWizard'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { undoToast } from '@/lib/undoToast'
import { duplicateDraft, KIND_LABEL, newDraft, setTemplateArchived, useTemplates, type TemplateRow, type TplDraft } from '@/lib/sign/templates'
import type { SignKind } from '@/lib/sign/api'

type Tab = 'all' | 'ats' | 'sales' | 'archived'
const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ats', label: 'Gio ATS' },
  { value: 'sales', label: 'Gio Sales' },
  { value: 'archived', label: 'Archived' },
]
const inTab = (tab: Tab, t: TemplateRow) =>
  tab === 'archived' ? !!t.archived_at : !t.archived_at && (tab === 'all' || t.app === tab)

const TAB_EMPTY: Record<Tab, { title: string; body: string }> = {
  all: {
    title: 'No templates yet',
    body: 'A template holds the PDFs, who signs them and where. TAs pick ATS templates on a candidate; Sales reps pick Gio Sales templates on a deal.',
  },
  ats: { title: 'No ATS templates', body: 'Offer letters and member agreements used from the ATS show up here.' },
  sales: { title: 'No Gio Sales templates', body: 'Customer agreements Sales reps send from a deal show up here.' },
  archived: { title: 'Nothing archived', body: 'Archived templates are hidden from senders. Restore one to use it again.' },
}

/** Sign › Templates (admins only): every template as a card, by app, with the template wizard. */
export default function SignTemplates() {
  const q = useTemplates()
  const qc = useQueryClient()
  const timedOut = useLoadTimeout(q.isLoading, q.dataUpdatedAt)
  const [params, setParams] = useSearchParams()
  const rawTab = params.get('tab') as Tab | null
  const tab: Tab = rawTab && TABS.some((t) => t.value === rawTab) ? rawTab : 'all'
  const setTab = (t: Tab) =>
    setParams(
      (p) => {
        if (t === 'all') p.delete('tab')
        else p.set('tab', t)
        return p
      },
      { replace: true },
    )

  const [search, setSearch] = useState('')
  const [kinds, setKinds] = useState<string[]>([])
  const filtered = !!search.trim() || kinds.length > 0
  const clearAll = () => {
    setSearch('')
    setKinds([])
  }

  const [wizard, setWizard] = useState<{ open: boolean; init: TplDraft | null; mode: WizardMode }>({ open: false, init: null, mode: 'new' })
  const openWizard = (init: TplDraft, mode: WizardMode) => setWizard({ open: true, init, mode })

  const all = useMemo(() => q.data ?? [], [q.data])
  const live = all.filter((t) => !t.archived_at)
  const base = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return all.filter(
      (t) =>
        (!kinds.length || kinds.includes(t.kind)) &&
        (!needle || [t.name, t.description, ...t.docs.map((d) => d.name), ...t.written.map((w) => w.name)].join(' ').toLowerCase().includes(needle)),
    )
  }, [all, search, kinds])
  const cards = base.filter((t) => inTab(tab, t))

  const refresh = () => qc.invalidateQueries({ queryKey: ['sign'] })
  const archive = async (t: TemplateRow, archived: boolean) => {
    try {
      await setTemplateArchived(t.id, archived)
      await refresh()
      if (archived) {
        undoToast(`${t.name} archived`, async () => {
          try {
            await setTemplateArchived(t.id, false)
            await refresh()
          } catch {
            toast.error(`Couldn’t restore ${t.name}`)
          }
        }, 'Senders no longer see it. Envelopes already sent aren’t affected.')
      } else {
        toast.success(`${t.name} restored`, { description: 'Senders can pick it again.' })
      }
    } catch {
      toast.error(archived ? `Couldn’t archive ${t.name}` : `Couldn’t restore ${t.name}`)
    }
  }

  const kindCount = (k: SignKind) => live.filter((t) => t.kind === k).length
  const kindOptions = (Object.keys(KIND_LABEL) as SignKind[]).map((k) => ({ value: k, label: KIND_LABEL[k], count: all.filter((t) => t.kind === k).length }))

  const empty = () =>
    all.length === 0 ? (
      <AnimatedEmpty
        scene="jobs"
        onceKey="sign-templates"
        title={TAB_EMPTY.all.title}
        body={TAB_EMPTY.all.body}
        primary={{ label: 'New template', icon: <Plus size={16} strokeWidth={2} />, onClick: () => openWizard(newDraft(), 'new') }}
      />
    ) : filtered ? (
      <AnimatedEmpty
        scene="search"
        onceKey="sign-templates"
        title="No templates match these filters"
        body={`${all.filter((t) => inTab(tab, t)).length} template${all.filter((t) => inTab(tab, t)).length === 1 ? ' is' : 's are'} hidden by the search or filters.`}
        primary={{ label: 'Clear filters', icon: <RotateCcw size={16} strokeWidth={2} />, onClick: clearAll }}
      />
    ) : (
      <AnimatedEmpty scene="jobs" onceKey="sign-templates" title={TAB_EMPTY[tab].title} body={TAB_EMPTY[tab].body} />
    )

  return (
    <ListPage
      title="Templates"
      count={q.data ? live.length : undefined}
      meta={
        q.data && (
          <>
            <MetaDot color="#6F3FF5">{kindCount('candidate')} candidate</MetaDot>
            <MetaDot color="#12B886">{kindCount('member')} member</MetaDot>
            <MetaDot color="#0d0d09">{kindCount('customer')} customer</MetaDot>
            <span className="tabular-nums">{live.reduce((a, t) => a + t.uses, 0)} envelopes sent from templates</span>
          </>
        )
      }
      actions={
        <Button icon={Plus} onClick={() => openWizard(newDraft(), 'new')}>
          New template
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-virgilio-border bg-white">
          <ListTabs
            label="Templates by app"
            value={tab}
            onChange={setTab}
            tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: q.data ? base.filter((x) => inTab(t.value, x)).length : undefined }))}
          />
          <div className="flex flex-wrap items-center gap-3 p-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by template or document name…"
                aria-label="Search templates"
                className="h-10 rounded-xl border-transparent bg-[#FAFAF7] pl-10 pr-9 text-[13.5px] focus-visible:bg-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="gio-search-clear absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary hover:text-text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FilterChipPopover label="Type" options={kindOptions} selectedValues={kinds} onSelectionChange={setKinds} />
              {filtered && (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </div>

        {q.isError || timedOut ? (
          <EmptyCard>
            <LoadError what="templates" timedOut={timedOut && !q.isError} onRetry={() => q.refetch()} />
          </EmptyCard>
        ) : (
          <Loadable
            loading={q.isLoading}
            skeleton={
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-[268px] rounded-[14px]" />
                ))}
              </div>
            }
          >
            {cards.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
                {cards.map((t) => (
                  <TemplateCard
                    key={t.id}
                    t={t}
                    onEdit={() => openWizard(t, 'edit')}
                    onDuplicate={() => openWizard(duplicateDraft(t), 'duplicate')}
                    onArchive={() => void archive(t, true)}
                    onRestore={() => void archive(t, false)}
                  />
                ))}
              </div>
            ) : (
              <EmptyCard>{empty()}</EmptyCard>
            )}
          </Loadable>
        )}
      </div>

      <TemplateWizard open={wizard.open} init={wizard.init} mode={wizard.mode} onClose={() => setWizard((w) => ({ ...w, open: false }))} />
    </ListPage>
  )
}
