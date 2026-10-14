import { useEffect, useMemo, useState } from 'react'
import { MoreHorizontal, Pencil, Plus, Archive } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { Skeleton } from '@/components/ui/skeleton'
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

  useEffect(() => {
    if (!open) return
    setName(bundle?.name ?? '')
    setDescription(bundle?.description ?? '')
    const next: Record<AppKey, string> = { ats: 'member', sales: NO_ACCESS, docs: NO_ACCESS }
    for (const g of bundle?.grants ?? []) next[g.app] = g.role
    setRoles(next)
    setNameError(undefined)
    setFormError(null)
  }, [open, bundle])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (save.isPending) return
    if (!name.trim()) {
      setNameError('Give the job role a name.')
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
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
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
          <DialogFooter className="mt-2">
            <Button type="button" variant="secondary" size="md" disabled={save.isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={save.isPending}>
              {bundle ? 'Save job role' : 'Create job role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** /os/job-roles — the bundles that decide a new person's apps and roles. */
export default function JobRolesPage() {
  const { tenant } = useTenant()
  const bundles = useBundles(tenant?.id)
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
    <div className="mx-auto w-full max-w-[1080px]">
      <PageHeader
        title="Job roles"
        kicker
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
      />

      {bundles.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] w-full rounded-[12px]" />
          ))}
        </div>
      ) : bundles.isError ? (
        <div className="rounded-[12px] border border-[#E7E8EE] bg-white px-5 py-8 text-center">
          <p className="font-poppins text-[13.5px] font-semibold text-[#1F2230]">Couldn't load job roles</p>
          <Button className="mt-3" variant="secondary" size="sm" onClick={() => bundles.refetch()}>
            Retry
          </Button>
        </div>
      ) : (bundles.data ?? []).length === 0 ? (
        <div className="rounded-[12px] border border-[#E7E8EE] bg-white px-5 py-10 text-center">
          <p className="font-poppins text-[13.5px] font-semibold text-[#1F2230]">No job roles yet</p>
          <p className="mt-1 font-inter text-[12px] text-[#6B7080]">Create one to give new people the right apps in one step.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(bundles.data ?? []).map((b) => {
            const count = usage.get(b.id) ?? 0
            return (
              <article key={b.id} className="rounded-[12px] border border-[#E7E8EE] bg-white p-4">
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-poppins text-[14px] font-semibold tracking-[-0.02em] text-[#1F2230]">
                      {b.name}
                    </h2>
                    {b.description && (
                      <p className="mt-0.5 line-clamp-2 font-inter text-[12px] text-[#6B7080]">{b.description}</p>
                    )}
                  </div>
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
                </header>
                <ul className="mt-3 space-y-1">
                  {APPS.map((app) => {
                    const g = b.grants.find((x) => x.app === app.key)
                    const role = g?.role ?? (app.key === 'ats' ? 'member' : null)
                    return (
                      <li key={app.key} className="flex justify-between gap-3 font-inter text-[12px]">
                        <span className="text-[#1F2230]">{appName(app.key)}</span>
                        <span className={role ? 'text-[#1F2230]' : 'text-[#6B7080]'}>
                          {role ? roleLabel(app.key, role) : 'No access'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-3 font-inter text-[11.5px] tabular-nums text-[#6B7080]">
                  {count === 0 ? 'No one has this job role yet' : `${count} ${count === 1 ? 'person' : 'people'}`}
                </p>
              </article>
            )
          })}
        </div>
      )}

      <BundleDialog open={open} onOpenChange={setOpen} bundle={editing} tenantId={tenant?.id} />
    </div>
  )
}
