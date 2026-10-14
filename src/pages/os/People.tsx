import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RotateCcw, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterChipPopover } from '@/components/ui/filter-chip-popover'
import { ListTabs } from '@/components/ui/list-tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableSkeleton } from '@/components/ui/table-states'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useTenant } from '@/hooks/useTenant'
import {
  APPS,
  personName,
  personState,
  useBundles,
  usePeople,
  type Person,
  type PersonState,
} from '@/lib/os/peopleAccess'
import { AccessChips, GoogleStatus, JobCounts, PersonAvatar, PersonStateBadge } from '@/components/os/PeopleBits'
import { AddPersonDialog } from '@/components/os/AddPersonDialog'
import { MetaDot, ListPage } from '@/components/layout/ListPage'

const NO_ROLE = '__none__'
const COLS = 6

const EMPTY: Record<PersonState, { title: string; body: string }> = {
  active: { title: 'No active people', body: 'Add the first person to give them access.' },
  invited: { title: 'No open invitations', body: 'People you add show up here until they accept their invitation.' },
  deactivated: { title: 'No deactivated people', body: 'People who lose access stay here, with their history.' },
}

/** /os/people — everyone at Virgilio and what they can open. Laid out like the Jobs list. */
export default function PeoplePage() {
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const people = usePeople(tenant?.id)
  const bundles = useBundles(tenant?.id)
  const [state, setState] = useState<PersonState>('active')
  const [jobRoles, setJobRoles] = useState<string[]>([])
  const [apps, setApps] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [retry, setRetry] = useState(0)
  const timedOut = useLoadTimeout(people.isLoading, retry)

  const all = useMemo(() => people.data ?? [], [people.data])
  const bundleName = useMemo(() => {
    const map = new Map((bundles.data ?? []).map((b) => [b.id, b.name]))
    return (id: string | null) => (id ? map.get(id) ?? null : null)
  }, [bundles.data])

  const counts = useMemo(() => {
    const c: Record<PersonState, number> = { active: 0, invited: 0, deactivated: 0 }
    for (const p of all) c[personState(p)]++
    return c
  }, [all])

  const inTab = useMemo(() => all.filter((p) => personState(p) === state), [all, state])

  const roleOptions = useMemo(
    () => [
      ...(bundles.data ?? []).map((b) => ({
        value: b.id,
        label: b.name,
        count: inTab.filter((p) => p.bundle_id === b.id).length,
      })),
      { value: NO_ROLE, label: 'No job role', count: inTab.filter((p) => !p.bundle_id).length },
    ],
    [bundles.data, inTab],
  )
  const appOptions = useMemo(
    () =>
      APPS.map((a) => ({
        value: a.key,
        label: a.name,
        count: a.key === 'ats' ? inTab.length : inTab.filter((p) => p.grants.some((g) => g.app === a.key)).length,
      })),
    [inTab],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inTab
      .filter((p) => jobRoles.length === 0 || jobRoles.includes(p.bundle_id ?? NO_ROLE))
      .filter((p) => apps.length === 0 || apps.some((a) => a === 'ats' || p.grants.some((g) => g.app === a)))
      .filter((p) => !q || personName(p).toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q))
      .sort((a, b) => personName(a).localeCompare(personName(b)))
  }, [inTab, jobRoles, apps, search])

  const filtered = jobRoles.length > 0 || apps.length > 0 || search.trim() !== ''
  const hidden = inTab.length - rows.length
  const clearFilters = () => {
    setJobRoles([])
    setApps([])
    setSearch('')
  }
  const loadError: 'failed' | 'timeout' | null = people.isError ? 'failed' : timedOut ? 'timeout' : null

  const open = (p: Person) => navigate(`/os/people/${p.member_id}`)

  return (
    <ListPage
      title="People"
      count={counts.active}
      meta={
        <>
          <MetaDot color="#12B886">{counts.active} active</MetaDot>
          <MetaDot color="#1C7ED6">{counts.invited} invited</MetaDot>
          <MetaDot color="#B5B9C4">{counts.deactivated} deactivated</MetaDot>
        </>
      }
      actions={
        <Button variant="primary" size="md" icon={Plus} onClick={() => setAdding(true)}>
          Add person
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Tabs + filters card */}
        <div className="rounded-2xl border border-virgilio-border bg-white overflow-hidden">
          <ListTabs
            label="Status"
            value={state}
            onChange={(v) => setState(v as PersonState)}
            tabs={[
              { value: 'active', label: 'Active', count: counts.active },
              { value: 'invited', label: 'Invited', count: counts.invited },
              { value: 'deactivated', label: 'Deactivated', count: counts.deactivated },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3 p-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                aria-label="Search people"
                className="h-10 pl-10 pr-3 bg-[#FAFAF7] border-transparent rounded-xl text-[13.5px] focus-visible:bg-white"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <FilterChipPopover
                label="Job role"
                options={roleOptions}
                selectedValues={jobRoles}
                onSelectionChange={setJobRoles}
                searchable={false}
              />
              <FilterChipPopover
                label="App"
                options={appOptions}
                selectedValues={apps}
                onSelectionChange={setApps}
                searchable={false}
              />
            </div>
          </div>
        </div>

        {/* Table card */}
        <div className="rounded-2xl border border-virgilio-border bg-white overflow-clip">
          <Table density="comfortable">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Person</TableHead>
                <TableHead>Job role</TableHead>
                <TableHead>Apps</TableHead>
                <TableHead>Google</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.isLoading && !loadError ? (
                <TableSkeleton rows={6} columns={COLS} />
              ) : loadError ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={COLS} style={{ padding: '56px 24px' }}>
                    <LoadError
                      what="people"
                      timedOut={loadError === 'timeout'}
                      onRetry={() => {
                        setRetry((n) => n + 1)
                        void people.refetch()
                      }}
                    />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={COLS} style={{ padding: '48px 24px' }}>
                    {filtered ? (
                      <AnimatedEmpty
                        scene="search"
                        onceKey="os-people"
                        title="No one matches these filters"
                        body={`${hidden} ${hidden === 1 ? 'person is' : 'people are'} hidden by your filters.`}
                        primary={{ label: 'Clear filters', icon: <RotateCcw size={16} strokeWidth={2} />, onClick: clearFilters }}
                      />
                    ) : (
                      <AnimatedEmpty
                        scene="candidates"
                        onceKey="os-people"
                        title={EMPTY[state].title}
                        body={EMPTY[state].body}
                        primary={
                          state === 'active'
                            ? { label: 'Add person', icon: <Plus size={16} />, onClick: () => setAdding(true) }
                            : undefined
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.member_id} className="cursor-pointer" onClick={() => open(p)}>
                    <TableCell>
                      <a
                        href={`/os/people/${p.member_id}`}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          open(p)
                        }}
                        className="flex min-w-0 items-center gap-2.5 rounded-[6px]"
                      >
                        <PersonAvatar person={p} />
                        <span className="min-w-0">
                          <span className="block truncate font-inter text-[13px] font-medium text-text-primary">
                            {personName(p)}
                          </span>
                          {p.email && personName(p) !== p.email && (
                            <span className="block truncate font-inter text-[11.5px] text-text-tertiary">{p.email}</span>
                          )}
                        </span>
                      </a>
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap font-inter text-[12.5px] text-text-primary">
                        {bundleName(p.bundle_id) ?? <span className="text-text-tertiary">No job role</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <AccessChips person={p} />
                    </TableCell>
                    <TableCell>
                      <GoogleStatus person={p} />
                    </TableCell>
                    <TableCell>
                      <JobCounts person={p} />
                    </TableCell>
                    <TableCell>
                      <PersonStateBadge person={p} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddPersonDialog open={adding} onOpenChange={setAdding} bundles={bundles.data ?? []} />
    </ListPage>
  )
}
