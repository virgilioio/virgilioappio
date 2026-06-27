import { useRef, useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Pencil,
  Trash2,
  Trophy,
  XCircle,
  CheckCircle2,
  Circle,
  MoveRight,
  Send,
  MoreHorizontal,
  Calendar,
  Percent,
  Clock,
  User as UserIcon,
  AlertTriangle,
} from 'lucide-react'
import { InlineEmpty } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { useDeal, useDealMutations } from '@/hooks/useDeals'
import { useDealStages, type DealStageType } from '@/hooks/useDealStages'
import { useDealNotes } from '@/hooks/useDealNotes'
import { useDealPayments } from '@/hooks/useDealPayments'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useSubmitShortcut } from '@/hooks/useSubmitShortcut'
import { CURRENCY_SYMBOLS } from '@/constants/currencies'
import { DealFormSheet } from './DealFormSheet'
import { DealBillingSummary } from './billing/DealBillingSummary'
import { DealInvoicesCard } from './billing/DealInvoicesCard'
import { DealPaymentsCard } from './billing/DealPaymentsCard'

function formatAmount(amount: number | null | undefined, currency: string) {
  if (amount === null || amount === undefined) return '—'
  const symbol = CURRENCY_SYMBOLS[currency] ?? ''
  return `${symbol}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`
}

function ageInDays(iso: string | null | undefined): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatNoteDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function initials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

const stageTypeBadgeVariant: Record<DealStageType, BadgeProps['variant']> = {
  open: 'pastel-blue',
  won: 'success',
  lost: 'secondary',
}

function stageHeaderTint(type: DealStageType): string {
  switch (type) {
    case 'won':
      return 'bg-success/15'
    case 'lost':
      return 'bg-muted'
    case 'open':
    default:
      return 'bg-pastel-blue/15'
  }
}

interface DealProfileSheetProps {
  dealId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type DealTab = 'overview' | 'billing' | 'notes'

export function DealProfileSheet({ dealId, open, onOpenChange }: DealProfileSheetProps) {
  const { data: deal } = useDeal(dealId)
  const { data: stages = [] } = useDealStages()
  const { deleteDeal, moveDeal } = useDealMutations()
  const notes = useDealNotes(dealId)
  const payments = useDealPayments(dealId)
  const { user } = useAuth()
  const permissions = usePermissions()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft, setDraft] = useState('')
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)
  const [activeTab, setActiveTab] = useState<DealTab>('overview')
  const [openStageId, setOpenStageId] = useState<string | null>(null)
  const noteFormRef = useRef<HTMLFormElement>(null)

  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    setIsSubmittingNote(true)
    try {
      await notes.addNote.mutateAsync(draft.trim())
      setDraft('')
    } finally {
      setIsSubmittingNote(false)
    }
  }

  const handleNoteKeyDown = useSubmitShortcut(
    () => noteFormRef.current?.requestSubmit(),
    { disabled: !draft.trim() || isSubmittingNote }
  )

  const canDeleteNote = (n: { author_id: string | null }) =>
    n.author_id === user?.id || permissions.isPlatformAdmin

  if (!deal && open) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[600px] p-0">
          <div className="py-16 px-6">
            <InlineEmpty text="Loading deal…" />
          </div>
        </SheetContent>
      </Sheet>
    )
  }
  if (!deal) return null

  const stage = stages.find((s) => s.id === deal.stage_id)
  const sortedStages = [...stages].sort((a, b) => a.position - b.position)
  const currentIdx = stage ? sortedStages.findIndex((s) => s.id === stage.id) : -1
  const wonStage = stages.find((s) => s.stage_type === 'won')
  const lostStage = stages.find((s) => s.stage_type === 'lost')
  const nextOpenStage = sortedStages
    .slice(currentIdx + 1)
    .find((s) => s.stage_type === 'open')

  const collected = (payments.data ?? [])
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const total = deal.amount ?? 0
  const outstanding = Math.max(0, total - collected)
  const daysInStage = ageInDays(deal.stage_changed_at)
  const stageWarning = daysInStage >= 30

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto p-0">
          {/* ===== Header ===== */}
          <div className="px-6 pt-6 pb-4 border-b border-virgilio-border/40 bg-surface-primary">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-virgilio-purple font-inter">
                  CRM · Deal
                </div>
                <h2 className="mt-1 font-poppins font-semibold tracking-[-0.04em] text-[22px] leading-tight text-virgilio-text">
                  {deal.title}
                  <span className="text-virgilio-purple">.</span>
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {deal.organization_name && (
                    <span className="text-[13px] text-virgilio-text/80 truncate max-w-[260px]">
                      {deal.organization_name}
                    </span>
                  )}
                  {stage && (
                    <Badge variant={stageTypeBadgeVariant[stage.stage_type] ?? 'secondary'}>
                      {stage.name}
                    </Badge>
                  )}
                  <span className="text-[11.5px] text-virgilio-muted">
                    Created {ageInDays(deal.created_at)}d ago
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" iconOnly aria-label="More actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8}>
                    <DropdownMenuItem onClick={() => setEditing(true)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Edit deal
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setConfirmDelete(true)}
                      className="text-virgilio-error focus:text-virgilio-error"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete deal
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* KPI strip */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              <KpiTile
                label="Amount"
                value={formatAmount(total, deal.currency)}
                suffix={deal.currency}
              />
              <KpiTile
                label="Collected"
                value={formatAmount(collected, deal.currency)}
                tone="success"
              />
              <KpiTile
                label="Outstanding"
                value={formatAmount(outstanding, deal.currency)}
                tone={outstanding > 0 ? 'warning' : 'success'}
              />
              <KpiTile
                label="Days in stage"
                value={`${daysInStage}d`}
                tone={stageWarning ? 'warning' : 'default'}
                icon={<Clock className="h-3 w-3" />}
              />
            </div>
          </div>

          {/* ===== Tabs ===== */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DealTab)} className="w-full">
            <div className="px-6 pt-3 border-b border-virgilio-border/40 bg-surface-primary">
              <TabsList className="bg-transparent h-auto p-0 gap-1">
                <TabTrigger value="overview">Overview</TabTrigger>
                <TabTrigger value="billing">Billing</TabTrigger>
                <TabTrigger value="notes">
                  Notes
                  {(notes.data ?? []).length > 0 && (
                    <span className="ml-1.5 text-[10.5px] text-virgilio-muted tabular-nums">
                      {(notes.data ?? []).length}
                    </span>
                  )}
                </TabTrigger>
              </TabsList>
            </div>

            {/* ===== Overview ===== */}
            <TabsContent value="overview" className="m-0 px-6 py-4 space-y-4">
              {/* Stage Actions */}
              <Card className="bg-surface-primary border-border">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                    {nextOpenStage && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={MoveRight}
                        onClick={() =>
                          moveDeal.mutate({
                            id: deal.id,
                            stage_id: nextOpenStage.id,
                            stage_type: 'open',
                          })
                        }
                      >
                        {/^warranty$/i.test(nextOpenStage.name)
                          ? 'Start warranty'
                          : `Move to ${nextOpenStage.name}`}
                      </Button>
                    )}
                    {wonStage && stage?.stage_type !== 'won' && (
                      <Button
                        variant="success"
                        size="sm"
                        icon={Trophy}
                        onClick={() =>
                          moveDeal.mutate({
                            id: deal.id,
                            stage_id: wonStage.id,
                            stage_type: 'won',
                          })
                        }
                      >
                        Mark won
                      </Button>
                    )}
                    {lostStage && stage?.stage_type !== 'lost' && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={XCircle}
                        onClick={() => {
                          const reason = window.prompt('Reason for losing this deal? (optional)')
                          if (reason === null) return
                          moveDeal.mutate({
                            id: deal.id,
                            stage_id: lostStage.id,
                            stage_type: 'lost',
                            lost_reason: reason.trim() || null,
                          })
                        }}
                      >
                        Mark lost
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* About */}
              <Card className="bg-surface-primary border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-poppins font-semibold tracking-[-0.02em] text-virgilio-text">
                    About
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2.5">
                  <AboutRow icon={UserIcon} label="Owner">
                    {deal.owner_name ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          {deal.owner_avatar_url && (
                            <AvatarImage src={deal.owner_avatar_url} alt={deal.owner_name} />
                          )}
                          <AvatarFallback className="bg-virgilio-purple/10 text-virgilio-purple text-[9px] font-semibold">
                            {initials(deal.owner_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[13px] text-virgilio-text">{deal.owner_name}</span>
                      </div>
                    ) : (
                      <span className="text-[13px] text-virgilio-muted">Unassigned</span>
                    )}
                  </AboutRow>
                  <AboutRow icon={Calendar} label="Expected close">
                    <span className="text-[13px] text-virgilio-text">
                      {formatDate(deal.expected_close_date)}
                    </span>
                  </AboutRow>
                  <AboutRow icon={Percent} label="Probability">
                    <span className="text-[13px] text-virgilio-text tabular-nums">
                      {deal.probability !== null && deal.probability !== undefined
                        ? `${deal.probability}%`
                        : '—'}
                    </span>
                  </AboutRow>
                  <AboutRow icon={Clock} label="Last stage change">
                    <span className="text-[13px] text-virgilio-text">
                      {deal.stage_changed_at
                        ? `${daysInStage}d ago · ${formatDate(deal.stage_changed_at)}`
                        : '—'}
                    </span>
                  </AboutRow>
                  {deal.lost_reason && (
                    <AboutRow icon={AlertTriangle} label="Lost reason">
                      <span className="text-[13px] text-virgilio-text">{deal.lost_reason}</span>
                    </AboutRow>
                  )}
                </CardContent>
              </Card>

              {/* Pipeline Stages */}
              <Card className="bg-surface-primary border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-poppins font-semibold tracking-[-0.02em] text-virgilio-text">
                    Pipeline Stages
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {sortedStages.length ? (
                    <Accordion
                      type="single"
                      collapsible
                      value={openStageId ?? stage?.id ?? undefined}
                      onValueChange={(v) => setOpenStageId((v as string) || null)}
                      className="w-full space-y-2"
                    >
                      {sortedStages.map((s, idx) => {
                        const isPast = currentIdx >= 0 && idx < currentIdx
                        const isCurrent = currentIdx >= 0 && idx === currentIdx
                        return (
                          <AccordionItem
                            key={s.id}
                            value={s.id}
                            className="border border-virgilio-border/60 rounded-lg overflow-hidden"
                          >
                            <AccordionTrigger
                              className={cn(
                                'px-3 py-2 no-underline hover:no-underline text-virgilio-text',
                                stageHeaderTint(s.stage_type),
                              )}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {isCurrent ? (
                                  <CheckCircle2 className="h-4 w-4 text-virgilio-purple" />
                                ) : isPast ? (
                                  <CheckCircle2 className="h-4 w-4 text-virgilio-purple/40" />
                                ) : (
                                  <Circle className="h-4 w-4 text-virgilio-muted" />
                                )}
                                <div className="text-[13px] font-medium truncate">{s.name}</div>
                                <Badge
                                  variant={stageTypeBadgeVariant[s.stage_type] ?? 'secondary'}
                                  className="ml-auto mr-2"
                                >
                                  {s.stage_type}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-3 pb-3 pt-2">
                              {isCurrent ? (
                                <div className="text-[12.5px] text-virgilio-muted">
                                  This is the current stage of the deal.
                                </div>
                              ) : (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={MoveRight}
                                  disabled={moveDeal.isPending}
                                  onClick={() =>
                                    moveDeal.mutate({
                                      id: deal.id,
                                      stage_id: s.id,
                                      stage_type: s.stage_type,
                                    })
                                  }
                                >
                                  Move to this stage
                                </Button>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        )
                      })}
                    </Accordion>
                  ) : (
                    <InlineEmpty text="No deal stages configured." />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===== Billing ===== */}
            <TabsContent value="billing" className="m-0 px-6 py-4 space-y-4">
              <DealBillingSummary total={total} collected={collected} currency={deal.currency} />
              <DealInvoicesCard dealId={deal.id} />
              <DealPaymentsCard dealId={deal.id} currency={deal.currency} />
            </TabsContent>

            {/* ===== Notes ===== */}
            <TabsContent value="notes" className="m-0 px-6 py-4 space-y-4">
              <Card className="bg-surface-primary border-border">
                <CardContent className="p-4 space-y-3">
                  <form ref={noteFormRef} onSubmit={handleSubmitNote} className="space-y-3">
                    <Textarea
                      placeholder="Add a note…"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleNoteKeyDown}
                      rows={3}
                      className="resize-none text-[13.5px]"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] text-virgilio-muted">⌘↵ to submit</span>
                      <Button
                        type="submit"
                        size="sm"
                        icon={Send}
                        disabled={!draft.trim() || isSubmittingNote}
                        loading={isSubmittingNote}
                      >
                        Add note
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {notes.isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="h-5 w-5 rounded-full border-2 border-virgilio-purple border-t-transparent animate-spin" />
                  </div>
                ) : (notes.data ?? []).length === 0 ? (
                  <InlineEmpty text="No notes yet." />
                ) : (
                  (notes.data ?? []).map((n) => (
                    <Card key={n.id} className="bg-surface-primary border-border">
                      <CardContent className="p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-[11.5px] text-virgilio-muted">
                              <Avatar className="h-5 w-5">
                                {n.author_avatar_url && (
                                  <AvatarImage src={n.author_avatar_url} alt={n.author_name ?? ''} />
                                )}
                                <AvatarFallback className="bg-virgilio-purple/10 text-virgilio-purple text-[9px] font-semibold">
                                  {initials(n.author_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-poppins font-semibold text-[12.5px] text-virgilio-text">
                                {n.author_name}
                              </span>
                              <span>·</span>
                              <span>{formatNoteDate(n.created_at)}</span>
                            </div>
                            <p className="mt-2 text-[13.5px] text-virgilio-text whitespace-pre-wrap leading-relaxed">
                              {n.body}
                            </p>
                          </div>
                          {canDeleteNote(n) && (
                            <Button
                              variant="ghost"
                              size="xs"
                              iconOnly
                              aria-label="Delete note"
                              onClick={() => {
                                if (confirm('Delete this note?')) notes.deleteNote.mutate(n.id)
                              }}
                              className="text-virgilio-error hover:bg-virgilio-error/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <DealFormSheet open={editing} onOpenChange={setEditing} deal={deal} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete deal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the deal and its notes. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await deleteDeal.mutateAsync(deal.id)
                setConfirmDelete(false)
                onOpenChange(false)
              }}
              className="bg-virgilio-error hover:bg-virgilio-error/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ────────────── helpers ──────────────

function KpiTile({
  label,
  value,
  suffix,
  tone = 'default',
  icon,
}: {
  label: string
  value: string
  suffix?: string
  tone?: 'default' | 'success' | 'warning'
  icon?: React.ReactNode
}) {
  const toneClass =
    tone === 'success'
      ? 'text-virgilio-success'
      : tone === 'warning'
      ? 'text-virgilio-warning'
      : 'text-virgilio-text'
  return (
    <div className="rounded-lg border border-virgilio-border/60 bg-surface-primary px-3 py-2">
      <div className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-[0.06em] text-virgilio-muted font-inter">
        {icon}
        {label}
      </div>
      <div className={cn('mt-1 font-poppins font-semibold text-[15px] tabular-nums leading-tight', toneClass)}>
        {value}
        {suffix && (
          <span className="ml-1 text-[10px] font-normal text-virgilio-muted">{suffix}</span>
        )}
      </div>
    </div>
  )
}

function TabTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        'relative h-9 px-3 rounded-none bg-transparent text-[12.5px] font-poppins font-medium text-virgilio-muted',
        'data-[state=active]:text-virgilio-text data-[state=active]:shadow-none',
        'data-[state=active]:bg-transparent',
        'after:absolute after:left-2 after:right-2 after:-bottom-px after:h-[2px] after:rounded-full',
        'after:bg-transparent data-[state=active]:after:bg-virgilio-purple',
      )}
    >
      {children}
    </TabsTrigger>
  )
}

function AboutRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[12px] text-virgilio-muted min-w-0">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-right min-w-0">{children}</div>
    </div>
  )
}
