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
  ArrowRight,
  Send,
  MoreHorizontal,
  Calendar,
  Clock,
  User as UserIcon,
  AlertTriangle,
  Building2,
  DollarSign,
  StickyNote,
  LayoutGrid,
  Receipt,
  FileText,
  X,
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
        <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto p-0 [&>button]:hidden bg-[#FAFAF7]">
          {/* ===== Header ===== */}
          <div className="px-6 pt-6 pb-5 bg-[#FAFAF7]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-poppins font-semibold tracking-[-0.04em] text-[24px] leading-tight text-virgilio-text truncate">
                  {deal.title}
                </h2>
                {deal.organization_name && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-500 text-white text-[10px] font-poppins font-semibold">
                      {(deal.organization_name[0] ?? '?').toUpperCase()}
                    </span>
                    <span className="text-[13px] text-virgilio-text/80 truncate">
                      {deal.organization_name}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)} icon={Pencil}>
                  Edit
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
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  aria-label="Close"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Amount + Stage + Created */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="font-poppins font-semibold tracking-[-0.03em] text-[26px] leading-none text-virgilio-text tabular-nums">
                {formatAmount(total, deal.currency)}
                <span className="ml-1.5 text-[12px] font-normal text-virgilio-muted tracking-normal align-middle">
                  {deal.currency}
                </span>
              </div>
              {stage && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDE4FF] px-2.5 py-1 text-[11.5px] font-poppins font-medium text-virgilio-purple">
                  <span className="h-1.5 w-1.5 rounded-full bg-virgilio-purple" />
                  {stage.name}
                </span>
              )}
              <span className="text-[11.5px] text-virgilio-muted">
                Created {ageInDays(deal.created_at)}d ago
              </span>
            </div>
          </div>

          {/* ===== Tabs ===== */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DealTab)} className="w-full">
            <div className="px-6 bg-[#FAFAF7]">
              <TabsList className="bg-[#F1F0EC] h-auto p-1 gap-1 rounded-xl w-full grid grid-cols-3">
                <TabTrigger value="overview" icon={LayoutGrid}>Deal Overview</TabTrigger>
                <TabTrigger value="billing" icon={Receipt}>Billing &amp; Invoices</TabTrigger>
                <TabTrigger value="notes" icon={FileText}>
                  Notes
                  {(notes.data ?? []).length > 0 && (
                    <span className="ml-1 text-[10.5px] text-virgilio-muted tabular-nums">
                      {(notes.data ?? []).length}
                    </span>
                  )}
                </TabTrigger>
              </TabsList>
            </div>

            {/* ===== Overview ===== */}
            <TabsContent value="overview" className="m-0 px-6 py-4 space-y-4">
              {/* Stage Actions */}
              <div className="flex items-center gap-2">
                {nextOpenStage && (
                  <Button
                    variant="secondary"
                    size="md"
                    className="flex-1 justify-center"
                    iconRight={ArrowRight}
                    onClick={() =>
                      moveDeal.mutate({
                        id: deal.id,
                        stage_id: nextOpenStage.id,
                        stage_type: 'open',
                      })
                    }
                  >
                    Move to <span className="font-poppins font-semibold ml-1">{nextOpenStage.name}</span>
                  </Button>
                )}
                {lostStage && stage?.stage_type !== 'lost' && (
                  <Button
                    variant="danger"
                    size="md"
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
                    Lost
                  </Button>
                )}
                {wonStage && stage?.stage_type !== 'won' && (
                  <Button
                    variant="success"
                    size="md"
                    icon={Trophy}
                    onClick={() =>
                      moveDeal.mutate({
                        id: deal.id,
                        stage_id: wonStage.id,
                        stage_type: 'won',
                      })
                    }
                  >
                    Won
                  </Button>
                )}
              </div>

              {/* Deal Details */}
              <Card className="bg-surface-primary border-border rounded-xl">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-[14px] font-poppins font-semibold tracking-[-0.02em] text-virgilio-text">
                    Deal Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4 space-y-3.5">
                  <DetailRow icon={UserIcon} label="Owner">
                    {deal.owner_name ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          {deal.owner_avatar_url && (
                            <AvatarImage src={deal.owner_avatar_url} alt={deal.owner_name} />
                          )}
                          <AvatarFallback className="bg-sky-400 text-white text-[9px] font-poppins font-semibold">
                            {initials(deal.owner_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[13px] text-virgilio-text">{deal.owner_name}</span>
                      </div>
                    ) : (
                      <span className="text-[13px] text-virgilio-muted">Unassigned</span>
                    )}
                  </DetailRow>
                  {deal.organization_name && (
                    <DetailRow icon={Building2} label="Company">
                      <span className="text-[13px] text-virgilio-text">{deal.organization_name}</span>
                    </DetailRow>
                  )}
                  <DetailRow icon={DollarSign} label="Deal value">
                    <span className="text-[13px] text-virgilio-text font-poppins font-medium tabular-nums">
                      {formatAmount(total, deal.currency)} {deal.currency}
                    </span>
                  </DetailRow>
                  <DetailRow icon={Calendar} label="Expected close">
                    <span className="text-[13px] text-virgilio-text">
                      {formatDate(deal.expected_close_date)}
                    </span>
                  </DetailRow>
                  {deal.notes && (
                    <DetailRow icon={StickyNote} label="Notes">
                      <span className="text-[13px] text-virgilio-text line-clamp-3">{deal.notes}</span>
                    </DetailRow>
                  )}
                  {deal.lost_reason && (
                    <DetailRow icon={AlertTriangle} label="Lost reason">
                      <span className="text-[13px] text-virgilio-text">{deal.lost_reason}</span>
                    </DetailRow>
                  )}
                </CardContent>
              </Card>

              {/* Pipeline Stages */}
              <Card className="bg-surface-primary border-border rounded-xl">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-[14px] font-poppins font-semibold tracking-[-0.02em] text-virgilio-text">
                    Pipeline Stages
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-2 pb-2 space-y-0.5">
                  {sortedStages.length ? (
                    sortedStages.map((s, idx) => {
                      const isPast = currentIdx >= 0 && idx < currentIdx
                      const isCurrent = currentIdx >= 0 && idx === currentIdx
                      const status = isCurrent ? 'current' : isPast ? 'done' : 'open'
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            !isCurrent &&
                            moveDeal.mutate({
                              id: deal.id,
                              stage_id: s.id,
                              stage_type: s.stage_type,
                            })
                          }
                          disabled={isCurrent || moveDeal.isPending}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 h-11 rounded-lg text-left transition-colors',
                            isCurrent
                              ? 'bg-[#FAF8FF]'
                              : 'hover:bg-[#F1F0EC] cursor-pointer',
                          )}
                        >
                          {isPast ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
                              <CheckCircle2 className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                            </span>
                          ) : isCurrent ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-virgilio-purple">
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            </span>
                          ) : (
                            <Circle className="h-5 w-5 text-virgilio-muted/50" strokeWidth={1.5} />
                          )}
                          <span className="text-[13px] font-poppins font-medium text-virgilio-text flex-1">
                            {s.name}
                          </span>
                          {status === 'current' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDE4FF] px-2 py-0.5 text-[11px] font-poppins font-medium text-virgilio-purple">
                              <span className="h-1.5 w-1.5 rounded-full bg-virgilio-purple" />
                              current
                            </span>
                          ) : (
                            <span className="text-[11px] font-poppins font-medium text-virgilio-muted">
                              {status}
                            </span>
                          )}
                        </button>
                      )
                    })
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
