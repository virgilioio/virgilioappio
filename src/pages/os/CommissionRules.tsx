import { useMemo, useState } from 'react'
import { History as HistoryIcon, MoreHorizontal, Pencil, Plus, Power, RefreshCw, Users } from 'lucide-react'
import { toast } from 'sonner'

import { ListPage } from '@/components/layout/ListPage'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { IconTip } from '@/components/ui/tooltip'
import { LoadError } from '@/components/empty/LoadError'
import { ProfileCard } from '@/components/os/ProfileParts'
import { RoleDialog, RuleDialog } from '@/components/os/CommissionDialogs'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useTenant } from '@/hooks/useTenant'
import { personName, usePeople } from '@/lib/os/peopleAccess'
import { sendRatesNow, useCommissionRates, type CommissionRate } from '@/lib/os/commissions'
import {
  dayText,
  payableText,
  ruleSentence,
  seriesFor,
  sourceLabel,
  useCommissionRoles,
  useCommissionRuleVersions,
  useSetRoleActive,
  type CommissionRole,
  type CommissionRule,
} from '@/lib/os/commissionRules'

/** Where a built-in role's rate got to in Gio Sales. */
function Delivery({ rate, builtIn }: { rate: CommissionRate | undefined; builtIn: boolean }) {
  // A built-in role's version always has its rate (the database copies it); until the list catches up it is on its way.
  if (!rate && !builtIn) return <span className="text-[#8B8F9E]">Not used by Gio Sales yet</span>
  if (rate?.sync_status === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[#0B7A52]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#12B886]" aria-hidden />
        In Gio Sales
      </span>
    )
  }
  if (rate?.sync_status === 'refused') {
    return (
      <span className="block text-[#B91C1C]">
        Gio Sales refused it
        {rate?.sync_error && <span className="block text-[11.5px] text-[#6B7080]">{rate.sync_error}</span>}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[#B45309]">
      <span className="gio-spinner h-3 w-3" aria-hidden />
      Sending to Gio Sales
    </span>
  )
}

function Chip({ children, tone }: { children: React.ReactNode; tone: 'neutral' | 'off' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-[2px] font-inter text-[11px] font-medium ${
        tone === 'off' ? 'bg-[#F1F0EC] text-[#8B8F9E]' : 'bg-[#F1F0EC] text-[#5A6072]'
      }`}
    >
      {children}
    </span>
  )
}

type Dialog =
  | { kind: 'role'; role: CommissionRole | null }
  | { kind: 'rule'; role: CommissionRole; rule: CommissionRule | null; mode: 'add' | 'change' | 'stop' }
  | null

/**
 * /os/commissions — Commission rules (Allan, 2026-10-23; roles and rules as
 * configuration 2026-10-26). Each role says where its person comes from on a
 * deal; its rules say what it's paid, on what, when and for how long. Rules
 * are never edited: a change is a new version from a date, and every version
 * stays in the history.
 */
export default function CommissionRulesPage() {
  const { tenant } = useTenant()
  const roles = useCommissionRoles(tenant?.id)
  const versions = useCommissionRuleVersions(tenant?.id)
  const rates = useCommissionRates(tenant?.id)
  const people = usePeople(tenant?.id)
  const setActive = useSetRoleActive(tenant?.id)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [sending, setSending] = useState(false)
  const [retry, setRetry] = useState(0)
  const loading = roles.isLoading || versions.isLoading
  const timedOut = useLoadTimeout(loading, retry)
  const failed = roles.isError || versions.isError || timedOut

  const nameOf = useMemo(() => {
    const map = new Map((people.data ?? []).filter((p) => p.user_id).map((p) => [p.user_id!, personName(p)]))
    return (id: string | null) => (id ? map.get(id) ?? 'Someone' : 'Gio')
  }, [people.data])

  const roleRows = [...(roles.data ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.position - b.position)
  const roleById = new Map(roleRows.map((r) => [r.id, r]))
  const all = versions.data ?? []
  const rateOf = (v: CommissionRule) => {
    const role = roleById.get(v.role_id)
    if (!role?.built_in) return undefined
    return (rates.data ?? []).find((r) => r.role_key === role.key && r.effective_from === v.effective_from)
  }
  const waiting = (rates.data ?? []).filter((r) => r.sync_status === 'pending').length

  const toggle = async (role: CommissionRole) => {
    try {
      await setActive.mutateAsync({ id: role.id, active: !role.active })
      toast(role.active ? `${role.label} is off. Its rules stop applying.` : `${role.label} is back on.`, {
        action: { label: 'Undo', onClick: () => void setActive.mutateAsync({ id: role.id, active: role.active }) },
      })
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const sendNow = async () => {
    if (!tenant?.id) return
    setSending(true)
    try {
      await sendRatesNow(tenant.id)
    } finally {
      setSending(false)
      void rates.refetch()
    }
  }

  return (
    <ListPage
      title="Commission rules"
      meta={<span>Who earns what, on what and when. Gio Sales works out each invoice's commissions from these.</span>}
      actions={
        <Button icon={Plus} onClick={() => setDialog({ kind: 'role', role: null })} disabled={!tenant?.id}>
          Add role
        </Button>
      }
    >
      {failed ? (
        <div className="rounded-2xl border border-virgilio-border bg-white" style={{ padding: '56px 24px' }}>
          <LoadError
            what="the commission rules"
            timedOut={timedOut && !roles.isError && !versions.isError}
            onRetry={() => {
              setRetry((n) => n + 1)
              void roles.refetch()
              void versions.refetch()
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <ProfileCard title="Roles" icon={Users} flush>
            {loading ? (
              <div className="space-y-2 px-5 pb-5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-[92px] w-full rounded-[12px]" />
                ))}
              </div>
            ) : (
              <ul className="border-t border-[#F1F0EC]">
                {roleRows.map((role) => {
                  const series = seriesFor(all, role.id)
                  return (
                    <li key={role.id} className="border-b border-[#F1F0EC] px-5 py-4 last:border-b-0">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className={`truncate font-poppins text-[14px] font-semibold ${role.active ? 'text-[#1F2230]' : 'text-[#8B8F9E]'}`}>
                              {role.label}
                            </h3>
                            {role.built_in && <Chip tone="neutral">Built in</Chip>}
                            {!role.active && <Chip tone="off">Off</Chip>}
                          </div>
                          <p className="mt-0.5 truncate font-inter text-[12px] text-[#6B7080]">
                            {sourceLabel(role.person_source)}
                            {role.description ? ` · ${role.description}` : ''}
                          </p>
                        </div>
                        <DropdownMenu>
                          <IconTip label={`${role.label} actions`}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" aria-label={`${role.label} actions`} icon={MoreHorizontal} />
                            </DropdownMenuTrigger>
                          </IconTip>
                          <DropdownMenuContent align="end" className="w-[272px]">
                            <DropdownMenuItem onSelect={() => setDialog({ kind: 'role', role })}>
                              <Pencil />
                              <span className="truncate">Edit name and description</span>
                            </DropdownMenuItem>
                            {!role.built_in && role.active && (
                              <DropdownMenuItem onSelect={() => setDialog({ kind: 'rule', role, rule: null, mode: 'add' })}>
                                <Plus />
                                <span className="truncate">Add rule</span>
                              </DropdownMenuItem>
                            )}
                            {!role.built_in && (
                              <DropdownMenuItem onSelect={() => void toggle(role)}>
                                <Power />
                                <span className="truncate">{role.active ? 'Turn off' : 'Turn on'}</span>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="mt-3 space-y-2">
                        {series.map((s) => {
                          const shown = s.current ?? s.next!
                          const upcoming = !s.current
                          return (
                            <div key={s.series_id} className="flex flex-wrap items-start gap-x-3 gap-y-1.5 rounded-[10px] bg-[#F7F6F2] px-3 py-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="font-inter text-[13px] font-medium text-[#1F2230] [text-wrap:pretty]">
                                  {ruleSentence(shown)}
                                </p>
                                <p className="mt-0.5 font-inter text-[11.5px] text-[#6B7080]">
                                  {upcoming ? `Starts ${dayText(shown.effective_from)}` : `Since ${dayText(shown.effective_from)}`} · {payableText(shown)}
                                </p>
                                {s.current && s.next && (
                                  <p className="mt-0.5 font-inter text-[11.5px] font-medium text-[#6F3FF5]">
                                    {s.next.stopped
                                      ? `Stops on ${dayText(s.next.effective_from)}`
                                      : `From ${dayText(s.next.effective_from)}: ${ruleSentence(s.next)}`}
                                  </p>
                                )}
                              </div>
                              {role.active && (
                                <div className="flex shrink-0 gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: 'rule', role, rule: s.latest, mode: 'change' })}>
                                    {role.built_in ? 'Change rate' : 'Change'}
                                  </Button>
                                  {!role.built_in && !s.latest.stopped && (
                                    <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: 'rule', role, rule: s.latest, mode: 'stop' })}>
                                      Stop
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {series.length === 0 && (
                          <p className="font-inter text-[12.5px] text-[#6B7080]">
                            No rule yet, so {role.label} earns nothing.
                            {role.active && !role.built_in && (
                              <button
                                type="button"
                                onClick={() => setDialog({ kind: 'rule', role, rule: null, mode: 'add' })}
                                className="ml-1.5 font-medium text-[#6F3FF5] hover:underline"
                              >
                                Add rule
                              </button>
                            )}
                          </p>
                        )}
                        {series.length > 0 && role.active && !role.built_in && (
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: 'rule', role, rule: null, mode: 'add' })}
                            className="inline-flex items-center gap-1 font-inter text-[12.5px] font-medium text-[#6F3FF5] hover:underline"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            Add another rule
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </ProfileCard>

          <ProfileCard
            title="History"
            icon={HistoryIcon}
            flush
            aside={
              waiting > 0 ? (
                <Button variant="ghost" size="sm" icon={RefreshCw} loading={sending} onClick={() => void sendNow()}>
                  Send now
                </Button>
              ) : undefined
            }
          >
            <Table density="comfortable">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Applies from</TableHead>
                  <TableHead className="w-[180px]">Role</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead className="hidden w-[150px] md:table-cell">Added by</TableHead>
                  <TableHead className="w-[190px]">Gio Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 5 }, (_, i) => (
                      <TableRow key={i} className="hover:bg-transparent">
                        <TableCell colSpan={5}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : all.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="whitespace-nowrap">{dayText(v.effective_from)}</TableCell>
                        <TableCell className="max-w-[180px] truncate font-medium text-[#1F2230]">{roleById.get(v.role_id)?.label ?? ''}</TableCell>
                        <TableCell className="text-[#3A3D48]">
                          {v.stopped ? <span className="text-[#B91C1C]">Stopped: {ruleSentence(v)}</span> : ruleSentence(v)}
                          {v.note && <span className="block truncate text-[11.5px] text-[#8B8F9E]">{v.note}</span>}
                        </TableCell>
                        <TableCell className="hidden max-w-[150px] truncate text-[#5A6072] md:table-cell">{nameOf(v.created_by)}</TableCell>
                        <TableCell className="text-[12.5px]">
                          <Delivery rate={rateOf(v)} builtIn={!!roleById.get(v.role_id)?.built_in} />
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </ProfileCard>
        </div>
      )}

      {tenant?.id && (
        <>
          <RoleDialog
            open={dialog?.kind === 'role'}
            onOpenChange={(o) => !o && setDialog(null)}
            tenantId={tenant.id}
            role={dialog?.kind === 'role' ? dialog.role : null}
          />
          {dialog?.kind === 'rule' && (
            <RuleDialog open onOpenChange={(o) => !o && setDialog(null)} tenantId={tenant.id} role={dialog.role} rule={dialog.rule} mode={dialog.mode} />
          )}
        </>
      )}
    </ListPage>
  )
}
