import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Search, UserPlus } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  AccessChips,
  GoogleStatus,
  JobCounts,
  PersonAvatar,
  PersonStateBadge,
} from '@/components/os/PeopleBits'
import { AddPersonDialog } from '@/components/os/AddPersonDialog'

const ALL = '__all__'
const NO_ROLE = '__none__'

const STATES: [PersonState, string][] = [
  ['active', 'Active'],
  ['invited', 'Invited'],
  ['deactivated', 'Deactivated'],
]

function FilterPill({
  label,
  value,
  options,
  onSelect,
}: {
  label: string
  value: string
  options: { id: string; label: string }[]
  onSelect: (id: string) => void
}) {
  const active = value !== ALL
  const current = options.find((o) => o.id === value)?.label ?? 'All'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-[8px] border px-[11px] font-inter text-[12px] font-medium"
          style={{
            height: 30,
            borderColor: active ? '#0d0d09' : '#E0DDD3',
            background: active ? '#0d0d09' : '#fff',
            color: active ? '#fffcf9' : '#1F2230',
          }}
        >
          <span style={{ color: active ? 'rgba(255,252,249,0.6)' : '#6B7080' }}>{label}:</span>
          <span className="max-w-[140px] truncate">{current}</span>
          <ChevronDown size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onSelect(ALL)}>All</DropdownMenuItem>
        {options.map((o) => (
          <DropdownMenuItem key={o.id} onClick={() => onSelect(o.id)}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** /os/people — everyone at Virgilio and what they can open. */
export default function PeoplePage() {
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const people = usePeople(tenant?.id)
  const bundles = useBundles(tenant?.id)
  const [state, setState] = useState<PersonState>('active')
  const [jobRole, setJobRole] = useState(ALL)
  const [app, setApp] = useState(ALL)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const segRef = useSegmentLayer<HTMLDivElement>()

  const all = people.data ?? []
  const bundleName = useMemo(() => {
    const map = new Map((bundles.data ?? []).map((b) => [b.id, b.name]))
    return (id: string | null) => (id ? map.get(id) ?? null : null)
  }, [bundles.data])

  const counts = useMemo(() => {
    const c: Record<PersonState, number> = { active: 0, invited: 0, deactivated: 0 }
    for (const p of all) c[personState(p)]++
    return c
  }, [all])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all
      .filter((p) => personState(p) === state)
      .filter((p) => jobRole === ALL || (jobRole === NO_ROLE ? !p.bundle_id : p.bundle_id === jobRole))
      .filter(
        (p) =>
          app === ALL ||
          (app === 'ats' ? true : p.grants.some((g) => g.app === app)),
      )
      .filter((p) => !q || personName(p).toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q))
      .sort((a, b) => personName(a).localeCompare(personName(b)))
  }, [all, state, jobRole, app, search])

  const filtered = jobRole !== ALL || app !== ALL || search.trim() !== ''

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        title="People"
        kicker
        count={counts.active}
        meta={<span>Everyone at Virgilio and what they can open in Gio.</span>}
        actions={
          <Button variant="primary" size="md" icon={UserPlus} onClick={() => setAdding(true)}>
            Add person
          </Button>
        }
      />

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <div
          ref={segRef}
          className="gio-seg inline-flex"
          style={{ gap: 3, padding: 3, background: '#F1F0EC', borderRadius: 9 }}
        >
          {STATES.map(([id, label]) => {
            const active = state === id
            return (
              <button
                key={id}
                type="button"
                data-seg-option
                data-active={active || undefined}
                onClick={() => setState(id)}
                className="inline-flex items-center gap-1.5 rounded-[7px] border-none bg-transparent px-[11px] py-1.5 font-poppins text-[12px]"
                style={{ fontWeight: active ? 600 : 500, color: active ? '#1F2230' : '#5A6072' }}
              >
                {label}
                <span
                  className="rounded-full px-[5px] font-inter text-[10.5px] tabular-nums text-[#5A6072]"
                  style={{ background: active ? '#F1F0EC' : 'rgba(13,13,9,0.06)' }}
                >
                  {counts[id]}
                </span>
              </button>
            )
          })}
          <SegmentLayer fill="#fff" shadow="0 1px 2px rgba(13,13,9,0.06)" />
        </div>

        <span aria-hidden className="h-[22px] w-px bg-[#E0DDD3]" />

        <FilterPill
          label="Job role"
          value={jobRole}
          options={[
            ...(bundles.data ?? []).map((b) => ({ id: b.id, label: b.name })),
            { id: NO_ROLE, label: 'No job role' },
          ]}
          onSelect={setJobRole}
        />
        <FilterPill
          label="App"
          value={app}
          options={APPS.map((a) => ({ id: a.key, label: a.name }))}
          onSelect={setApp}
        />

        <label className="ml-auto inline-flex h-[30px] min-w-[220px] items-center gap-[7px] rounded-[8px] border border-[#E0DDD3] bg-white px-[11px]">
          <Search size={13} color="#6B7080" aria-hidden />
          <span className="sr-only">Search people</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="min-w-0 flex-1 bg-transparent font-inter text-[12px] text-[#1F2230] outline-none"
          />
        </label>
      </div>

      <div className="overflow-clip rounded-[12px] border border-[#E7E8EE] bg-white">
        {people.isError ? (
          <div className="px-5 py-8 text-center">
            <p className="font-poppins text-[13.5px] font-semibold text-[#1F2230]">Couldn't load people</p>
            <p className="mt-1 font-inter text-[12px] text-[#6B7080]">Check your connection and try again.</p>
            <Button className="mt-3" variant="secondary" size="sm" onClick={() => people.refetch()}>
              Retry
            </Button>
          </div>
        ) : people.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-poppins text-[13.5px] font-semibold text-[#1F2230]">
              {filtered ? 'No one matches these filters' : `No ${state} people`}
            </p>
            <p className="mt-1 font-inter text-[12px] text-[#6B7080]">
              {filtered
                ? 'Clear a filter or try another name.'
                : state === 'invited'
                  ? 'People you add appear here until they accept their invitation.'
                  : state === 'deactivated'
                    ? 'People who lose access stay here, with their history.'
                    : 'Add the first person to give them access.'}
            </p>
            {filtered && (
              <Button
                className="mt-3"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setJobRole(ALL)
                  setApp(ALL)
                  setSearch('')
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <Table>
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
              {rows.map((p: Person) => (
                <TableRow
                  key={p.member_id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/os/people/${p.member_id}`)}
                >
                  <TableCell>
                    <a
                      href={`/os/people/${p.member_id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        navigate(`/os/people/${p.member_id}`)
                      }}
                      className="flex min-w-0 items-center gap-2.5 rounded-[6px]"
                    >
                      <PersonAvatar person={p} />
                      <span className="min-w-0">
                        <span className="block truncate font-inter text-[13px] font-medium text-[#1F2230]">
                          {personName(p)}
                        </span>
                        {p.email && personName(p) !== p.email && (
                          <span className="block truncate font-inter text-[11.5px] text-[#6B7080]">{p.email}</span>
                        )}
                      </span>
                    </a>
                  </TableCell>
                  <TableCell>
                    <span className="font-inter text-[12px] text-[#1F2230]">
                      {bundleName(p.bundle_id) ?? <span className="text-[#6B7080]">No job role</span>}
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
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AddPersonDialog open={adding} onOpenChange={setAdding} bundles={bundles.data ?? []} />
    </div>
  )
}
