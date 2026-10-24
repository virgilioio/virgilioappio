import { useState } from 'react'
import { Archive, Link2, Plus } from 'lucide-react'

import { ListPage } from '@/components/layout/ListPage'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { ProfileCard } from '@/components/os/ProfileParts'
import { ArchivedLinks, LinkDialog, UsefulLinksEditor } from '@/components/os/UsefulLinks'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useTenant } from '@/hooks/useTenant'
import { useUsefulLinks, type UsefulLink } from '@/lib/os/usefulLinks'

/**
 * /os/links — Useful links (Allan, 2026-10-24): the links People & Access
 * admins pin for everyone, shown on the home page of My profile. Admins add,
 * edit, reorder and archive them here; archiving is undone from the toast or
 * with Restore, and nothing is ever erased.
 */
export default function UsefulLinksPage() {
  const { tenant } = useTenant()
  const links = useUsefulLinks(tenant?.id)
  const [editing, setEditing] = useState<UsefulLink | null>(null)
  const [open, setOpen] = useState(false)
  const [retry, setRetry] = useState(0)
  const timedOut = useLoadTimeout(links.isLoading, retry)

  const all = links.data ?? []
  const live = all.filter((l) => !l.archived_at)
  const archived = all.filter((l) => l.archived_at)
  const nextPosition = (live.reduce((m, l) => Math.max(m, l.position), 0) || 0) + 10
  const add = () => {
    setEditing(null)
    setOpen(true)
  }

  return (
    <ListPage
      title="Useful links"
      count={links.isSuccess ? live.length : undefined}
      meta={<span>Everyone in the workspace sees these on the home page of My profile, in this order.</span>}
      actions={
        <Button icon={Plus} onClick={add} disabled={!tenant?.id}>
          Add link
        </Button>
      }
    >
      {links.isError || timedOut ? (
        <div className="rounded-2xl border border-virgilio-border bg-white" style={{ padding: '56px 24px' }}>
          <LoadError
            what="the useful links"
            timedOut={timedOut && !links.isError}
            onRetry={() => {
              setRetry((n) => n + 1)
              void links.refetch()
            }}
          />
        </div>
      ) : (
        <div className="max-w-[760px] space-y-4">
          <ProfileCard title="On everyone's profile" icon={Link2} tone="blue">
            {links.isLoading ? (
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-[56px] w-full rounded-[10px]" />
                ))}
              </div>
            ) : live.length === 0 ? (
              <AnimatedEmpty
                scene="jobs"
                size="compact"
                onceKey="os-links-empty"
                title="No links yet"
                body="Pin the handbook, the payroll calendar or the team's drive, so everyone finds them on their profile."
                primary={{ label: 'Add link', icon: <Plus size={16} />, onClick: add }}
              />
            ) : (
              <UsefulLinksEditor
                tenantId={tenant!.id}
                links={live}
                onEdit={(l) => {
                  setEditing(l)
                  setOpen(true)
                }}
              />
            )}
          </ProfileCard>
          {archived.length > 0 && (
            <ProfileCard title={`Archived (${archived.length})`} icon={Archive} tone="neutral">
              <ArchivedLinks tenantId={tenant!.id} links={archived} />
            </ProfileCard>
          )}
        </div>
      )}
      {tenant?.id && <LinkDialog open={open} onOpenChange={setOpen} tenantId={tenant.id} link={editing} nextPosition={nextPosition} />}
    </ListPage>
  )
}
