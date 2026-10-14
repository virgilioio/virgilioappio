import { useEffect, useMemo, useState } from 'react'
import { MoreHorizontal, Pencil, Plus, Archive } from 'lucide-react'

import { ListPage } from '@/components/layout/ListPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { UnsavedGuard } from '@/components/ui/unsaved-guard'
import { shakeFirstInvalid } from '@/lib/motion'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableSkeleton } from '@/components/ui/table-states'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { IconTip } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTenant } from '@/hooks/useTenant'
import { undoToast } from '@/lib/undoToast'
import { toast } from 'sonner'
import {
  APPS,
  accessErrorMessage,
  appName,
  roleLabel,
  useArchiveBundle,
  useBundles,
  usePeople,
  useSaveBundle,
  type AppKey,
  type Bundle,
  type BundleGrant,
} from '@/lib/os/peopleAccess'

const NO_ACCESS = '__none__'

function BundleDialog({
  open,
  onOpenChange,
  bundle,
  tenantId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bundle: Bundle | null
  tenantId: string | undefined
}) {
  const save = useSaveBundle(tenantId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [roles, setRoles] = useState<Record<AppKey, string>>({ ats: 'member', sales: NO_ACCESS, docs: NO_ACCESS })
  const [nameError, setNameError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [guard, setGuard] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(bundle?.name ?? '')
    setDescription(bundle?.description ?? '')
    const next: Record<AppKey, string> = { ats: 'member', sales: NO_ACCESS, docs: NO_ACCESS }
    for (const g of bundle?.grants ?? []) next[g.app] = g.role
    setRoles(next)
    setNameError(undefined)
    setFormError(null)
    setGuard(false)
  }, [open, bundle])

  // §13: a dirty dialog intercepts close and asks inline.
  const dirty = (() => {
    if (!open) return false
    const base: Record<AppKey, string> = { ats: 'member', sales: NO_ACCESS, docs: NO_ACCESS }
    for (const g of bundle?.grants ?? []) base[g.app] = g.role
    return (
      name !== (bundle?.name ?? '') ||
      description !== (bundle?.description ?? '') ||
      APPS.some((a) => roles[a.key] !== base[a.key])
    )
  })()
  const requestClose = () => {
    if (save.isPending) return
    if (dirty) setGuard(true)
    else onOpenChange(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (save.isPending) return
    if (!name.trim()) {
      setNameError('Give the job role a name.')
      shakeFirstInvalid(e.currentTarget as Element)
      return
    }
    const grants: BundleGrant[] = APPS.filter((a) => roles[a.key] !== NO_ACCESS).map((a) => ({
      app: a.key,
      role: roles[a.key],
    }))
    setFormError(null)
    try {
      await save.mutateAsync({ id: bundle?.id, name, description, grants })
      onOpenChange(false)
    } catch (err) {
      const code = (err as { code?: string })?.code
      setFormError(
        code === '23505' ? 'Another job role already has this name.' : accessErrorMessage(err, "Couldn't save the job role."),
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{bundle ? 'Edit job role' : 'New job role'}</DialogTitle>
            <DialogDescription>
              Choose what someone in this role can open. Changes apply to people when you apply the job role to them.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <FormField label="Name" error={nameError} required>
              <Input
                value={name}
                maxLength={60}
                aria-invalid={!!nameError}
                onChange={(e) => {
                  setName(e.target.value)
                  if (nameError && e.target.value.trim()) setNameError(undefined)
                }}
                placeholder="Engagement Specialist"
              />
            </FormField>
            <FormField label="What they do" helpText="Optional. Shown in the job role list.">
              <Textarea
                value={description}
                maxLength={280}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Owns the customer relationship from win to kick-off."
              />
            </FormField>
            <div className="rounded-[10px] border border-[#EFEEEA]">
              {APPS.map((app, i) => (
                <div
                  key={app.key}
                  className={`flex items-center justify-between gap-3 px-3 py-2 ${i > 0 ? 'border-t border-[#EFEEEA]' : ''}`}
                >
                  <span className="font-inter text-[13px] font-medium text-[#1F2230]">{app.name}</span>
                  <div className="w-[180px]">
                    <Select
                      value={roles[app.key]}
                      onValueChange={(v) => setRoles((r) => ({ ...r, [app.key]: v }))}
                    >
                      <SelectTrigger aria-label={`${app.name} role`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {app.key !== 'ats' && <SelectItem value={NO_ACCESS}>No access</SelectItem>}
                        {app.roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
            <p className="font-inter text-[11.5px] text-[#6B7080]">
              Everyone keeps an ATS membership. A Member sees only the jobs they are on.
            </p>
            <p className="min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role="alert">
              {formError}
            </p>
          </div>
          <DialogFooter className="relative mt-2">
            <Button type="button" variant="secondary" size="md" disabled={save.isPending} onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={save.isPending}>
              {bundle ? 'Save job role' : 'Create job role'}
            </Button>
            <UnsavedGuard open={guard} onKeep={() => setGuard(false)} onDiscard={() => onOpenChange(false)} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** /os/job-roles — the bundles that decide a new person's apps and roles. */
const COLS = APPS.length + 3

export default function JobRolesPage() {
  const { tenant } = useTenant()
  const bundles = useBundles(tenant?.id)
  const [retry, setRetry] = useState(0)
  const timedOut = useLoadTimeout(bundles.isLoading, retry)
  const loadError: 'failed' | 'timeout' | null = bundles.isError ? 'failed' : timedOut ? 'timeout' : null
  const people = usePeople(tenant?.id)
  const archive = useArchiveBundle(tenant?.id)
  const [editing, setEditing] = useState<Bundle | null>(null)
  const [open, setOpen] = useState(false)

  const usage = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of people.data ?? []) if (p.bundle_id) m.set(p.bundle_id, (m.get(p.bundle_id) ?? 0) + 1)
    return m
  }, [people.data])

  const doArchive = async (b: Bundle) => {
    try {
      await archive.mutateAsync({ id: b.id, archived: true })
      undoToast(`${b.name} archived`, async () => {
        await archive.mutateAsync({ id: b.id, archived: false })
      }, 'People who have it keep their access.')
    } catch {
      toast(`Couldn't archive ${b.name}. Try again.`)
    }
  }

  return (
    <ListPage
        title="Job roles"
        count={bundles.data?.length}
        meta={<span>Each job role grants a set of apps. Apply one to a person from their page.</span>}
        actions={
          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            New job role
          </Button>
        }
      >

      <div className="rounded-2xl border border-virgilio-border bg-white overflow-clip">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%]">Job role</TableHead>
              {APPS.map((app) => (
                <TableHead key={app.key}>{app.name}</TableHead>
              ))}
              <TableHead className="text-right">People</TableHead>
              <TableHead className="w-[32px] text-right" aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bundles.isLoading && !loadError ? (
              <TableSkeleton rows={5} columns={COLS} />
            ) : loadError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLS} style={{ padding: '56px 24px' }}>
                  <LoadError
                    what="job roles"
                    timedOut={loadError === 'timeout'}
                    onRetry={() => {
                      setRetry((n) => n + 1)
                      void bundles.refetch()
                    }}
                  />
                </TableCell>
              </TableRow>
            ) : (bundles.data ?? []).length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLS} style={{ padding: '48px 24px' }}>
                  <AnimatedEmpty
                    scene="candidates"
                    onceKey="os-job-roles"
                    title="No job roles yet"
                    body="Create one to give new people the right apps in one step."
                    primary={{ label: 'New job role', icon: <Plus size={16} />, onClick: () => { setEditing(null); setOpen(true) } }}
                  />
                </TableCell>
              </TableRow>
            ) : (
              (bundles.data ?? []).map((b) => {
                const count = usage.get(b.id) ?? 0
                return (
                  <TableRow
                    key={b.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setEditing(b)
                      setOpen(true)
                    }}
                  >
                    <TableCell>
                      <span className="block truncate font-inter text-[13px] font-medium text-text-primary">{b.name}</span>
                      {b.description && (
                        <span className="block truncate font-inter text-[11.5px] text-text-tertiary">{b.description}</span>
                      )}
                    </TableCell>
                    {APPS.map((app) => {
                      const g = b.grants.find((x) => x.app === app.key)
                      const role = g?.role ?? (app.key === 'ats' ? 'member' : null)
                      return (
                        <TableCell key={app.key} className="whitespace-nowrap font-inter text-[12.5px]">
                          {role ? (
                            <span className="text-text-primary">{roleLabel(app.key, role)}</span>
                          ) : (
                            <span className="text-text-tertiary">No access</span>
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-right font-inter text-[12.5px] tabular-nums text-text-primary">
                      {count === 0 ? <span className="text-text-tertiary">—</span> : count}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <IconTip label={`${b.name} actions`}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" iconOnly aria-label={`${b.name} actions`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                        </IconTip>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(b)
                              setOpen(true)
                            }}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => doArchive(b)}>
                            <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <BundleDialog open={open} onOpenChange={setOpen} bundle={editing} tenantId={tenant?.id} />
    </ListPage>
  )
}
