import { useMemo, useState } from 'react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableSkeleton } from '@/components/ui/table-states'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { OsPage } from '@/components/os/OsPage'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useTenant } from '@/hooks/useTenant'
import { appName, describeAudit, personName, useAudit, usePeople } from '@/lib/os/peopleAccess'

const COLS = 4

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
  const [retry, setRetry] = useState(0)
  const timedOut = useLoadTimeout(audit.isLoading, retry)
  const nameOf = useMemo(() => {
    const map = new Map((people.data ?? []).filter((p) => p.user_id).map((p) => [p.user_id!, personName(p)]))
    return (id: string | null) => (id ? map.get(id) ?? 'Someone' : 'Gio')
  }, [people.data])

  const rows = audit.data ?? []
  const loadError: 'failed' | 'timeout' | null = audit.isError ? 'failed' : timedOut ? 'timeout' : null

  return (
    <OsPage
      title="History"
      count={audit.data ? rows.length : undefined}
      meta={<span>Every access change in People &amp; Access, recorded by the database. The latest 300 are shown.</span>}
    >
      <div className="rounded-2xl border border-virgilio-border bg-white overflow-clip">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[190px]">When</TableHead>
              <TableHead>What happened</TableHead>
              <TableHead className="w-[140px]">App</TableHead>
              <TableHead className="w-[180px]">By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {audit.isLoading && !loadError ? (
              <TableSkeleton rows={8} columns={COLS} />
            ) : loadError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLS} style={{ padding: '56px 24px' }}>
                  <LoadError
                    what="the history"
                    timedOut={loadError === 'timeout'}
                    onRetry={() => {
                      setRetry((n) => n + 1)
                      void audit.refetch()
                    }}
                  />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLS} style={{ padding: '48px 24px' }}>
                  <AnimatedEmpty
                    scene="scheduling"
                    onceKey="os-history"
                    title="No changes yet"
                    body="Grants, role changes and job roles show up here."
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-[12px] text-text-tertiary">{when(r.created_at)}</TableCell>
                  <TableCell className="text-[12.5px] text-text-primary">{describeAudit(r, nameOf)}</TableCell>
                  <TableCell className="text-[12px] text-text-primary">{r.app_key ? appName(r.app_key) : '—'}</TableCell>
                  <TableCell className="max-w-[180px] truncate text-[12px] text-text-primary">{nameOf(r.actor_id)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </OsPage>
  )
}
