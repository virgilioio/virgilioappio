import { useMemo } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useTenant } from '@/hooks/useTenant'
import { appName, describeAudit, personName, useAudit, usePeople } from '@/lib/os/peopleAccess'

function when(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** /os/history — every access change, newest first. Written by the database; nobody edits it. */
export default function AccessHistoryPage() {
  const { tenant } = useTenant()
  const audit = useAudit(tenant?.id)
  const people = usePeople(tenant?.id)
  const nameOf = useMemo(() => {
    const map = new Map((people.data ?? []).filter((p) => p.user_id).map((p) => [p.user_id!, personName(p)]))
    return (id: string | null) => (id ? map.get(id) ?? 'Someone' : 'Gio')
  }, [people.data])

  const rows = audit.data ?? []

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <PageHeader
        title="History"
        kicker
        meta={<span>Every access change in People &amp; Access, recorded by the database. The latest 300 are shown.</span>}
      />
      <div className="overflow-clip rounded-[12px] border border-[#E7E8EE] bg-white">
        {audit.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : audit.isError ? (
          <div className="px-5 py-8 text-center">
            <p className="font-poppins text-[13.5px] font-semibold text-[#1F2230]">Couldn't load the history</p>
            <Button className="mt-3" variant="secondary" size="sm" onClick={() => audit.refetch()}>
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-poppins text-[13.5px] font-semibold text-[#1F2230]">No changes yet</p>
            <p className="mt-1 font-inter text-[12px] text-[#6B7080]">Grants, role changes and job roles show up here.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">When</TableHead>
                <TableHead>What happened</TableHead>
                <TableHead className="w-[140px]">App</TableHead>
                <TableHead className="w-[180px]">By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-[12px] text-[#6B7080]">{when(r.created_at)}</TableCell>
                  <TableCell className="text-[12.5px] text-[#1F2230]">{describeAudit(r, nameOf)}</TableCell>
                  <TableCell className="text-[12px] text-[#1F2230]">{r.app_key ? appName(r.app_key) : '—'}</TableCell>
                  <TableCell className="truncate text-[12px] text-[#1F2230]">{nameOf(r.actor_id)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
