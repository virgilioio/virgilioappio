import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'

import { ListPage } from '@/components/layout/ListPage'
import { RoleDialog } from '@/components/os/CommissionDialogs'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTenant } from '@/hooks/useTenant'
import { useCommissionRoles } from '@/lib/os/commissionRules'
import { useBundles } from '@/lib/os/peopleAccess'
import { CommissionsPanel } from '@/pages/os/CommissionRules'
import { BundleDialog, JobRolesPanel } from '@/pages/os/JobRoles'

type Tab = 'jobs' | 'commissions'

const META: Record<Tab, string> = {
  jobs: 'What each person can open. Apply one from their page.',
  commissions: "Who earns what on a deal or a hire. Gio Sales works out each invoice's commissions from these.",
}

/**
 * /os/roles — Roles (Allan, 2026-10-26): job roles (what a person can open,
 * one per person) and commission roles (what a seat on a deal or a hire
 * earns) on one page, as two tabs. They stay separate things: pay never
 * follows a job role. ?tab=commissions opens the second tab; /os/job-roles
 * and /os/commissions land here.
 */
export default function RolesPage() {
  const { tenant } = useTenant()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'commissions' ? 'commissions' : 'jobs'
  const bundles = useBundles(tenant?.id)
  const roles = useCommissionRoles(tenant?.id)
  const [newJobRole, setNewJobRole] = useState(false)
  const [newCommissionRole, setNewCommissionRole] = useState(false)

  const setTab = (next: Tab) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'jobs') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )

  return (
    <ListPage
      title="Roles"
      meta={<span>{META[tab]}</span>}
      actions={
        tab === 'jobs' ? (
          <Button variant="primary" size="md" icon={Plus} onClick={() => setNewJobRole(true)}>
            New job role
          </Button>
        ) : (
          <Button variant="primary" size="md" icon={Plus} onClick={() => setNewCommissionRole(true)} disabled={!tenant?.id}>
            New commission role
          </Button>
        )
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList aria-label="Roles">
          <TabsTrigger value="jobs">
            Job roles
            {bundles.data && <span className="ml-1.5 tabular-nums">{bundles.data.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="commissions">
            Commissions
            {roles.data && <span className="ml-1.5 tabular-nums">{roles.data.length}</span>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="jobs" className="mt-4">
          <JobRolesPanel />
        </TabsContent>
        <TabsContent value="commissions" className="mt-4">
          <CommissionsPanel />
        </TabsContent>
      </Tabs>

      <BundleDialog open={newJobRole} onOpenChange={setNewJobRole} bundle={null} tenantId={tenant?.id} />
      {tenant?.id && (
        <RoleDialog open={newCommissionRole} onOpenChange={setNewCommissionRole} tenantId={tenant.id} role={null} />
      )}
    </ListPage>
  )
}
