import { useRef, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Pencil,
  Trash2,
  Trophy,
  XCircle,
  LayoutGrid,
  Receipt,
  StickyNote,
  CheckCircle2,
  Circle,
  MoveRight,
  MessageSquare,
  Send,
} from 'lucide-react'
import { EmptyState, InlineEmpty } from '@/components/ui/empty-state'
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
import { DealDetailsCollapsible } from './DealDetailsCollapsible'
import CandidateNameCard from '@/components/candidates/CandidateNameCard'

import { DealBillingSummary } from './billing/DealBillingSummary'
import { DealInvoicesCard } from './billing/DealInvoicesCard'
import { DealPaymentsCard } from './billing/DealPaymentsCard'

function formatAmount(amount: number | null, currency: string) {
  if (amount === null || amount === undefined) return '—'
  const symbol = CURRENCY_SYMBOLS[currency] ?? ''
  return `${symbol}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`
}

function ageInDays(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
  return `${days}d`
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

const stageTypeBadgeVariant: Record<DealStageType, BadgeProps['variant']> = {
  open: 'pastel-blue',
  won: 'success',
  lost: 'secondary',
}

function getStageHeaderBgClass(type: DealStageType): string {
  switch (type) {
    case 'won':
      return 'bg-success/20'
    case 'lost':
      return 'bg-muted'
    case 'open':
    default:
      return 'bg-pastel-blue/20'
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
        <SheetContent className="w-full sm:max-w-2xl">
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

  const tabs = [
    { value: 'overview', label: 'Deal Overview', Icon: LayoutGrid },
    { value: 'billing', label: 'Billing & Invoices', Icon: Receipt },
    { value: 'notes', label: 'Notes', Icon: StickyNote },
  ]

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-virgilio-border/40">
            <SheetHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="font-poppins font-bold tracking-[-0.04em] text-2xl text-virgilio-text leading-tight">
                    {deal.title}
                  </SheetTitle>
                  {deal.organization_name && (
                    <p className="text-sm text-virgilio-muted mt-1 truncate">{deal.organization_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-virgilio-error">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
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
                            onOpenChange(false)
                          }}
                          className="bg-virgilio-error hover:bg-virgilio-error/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-virgilio-purple/10 text-virgilio-purple border-0">
                  {formatAmount(deal.amount, deal.currency)} <span className="ml-1 text-[10px] opacity-70">{deal.currency}</span>
                </Badge>
                {stage && (
                  <Badge variant={stageTypeBadgeVariant[stage.stage_type] ?? 'secondary'}>
                    {stage.name}
                  </Badge>
                )}
                <span className="text-xs text-virgilio-muted">Created {ageInDays(deal.created_at)} ago</span>
              </div>
            </SheetHeader>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            <CandidateNameCard
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(v) => setActiveTab(v as DealTab)}
            />

            {activeTab === 'overview' && (
              <>
                {/* Controls Card — mirrors candidate sheet */}
                <Card className="bg-surface-primary border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between w-full">
                      <div className="overflow-x-auto scrollbar-none">
                        <div className="flex items-center gap-2 min-w-max">
                          {nextOpenStage && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                moveDeal.mutate({
                                  id: deal.id,
                                  stage_id: nextOpenStage.id,
                                  stage_type: 'open',
                                })
                              }
                            >
                              <MoveRight className="h-4 w-4 mr-2" />
                              {/^warranty$/i.test(nextOpenStage.name)
                                ? 'Start warranty'
                                : `Move to ${nextOpenStage.name}`}
                            </Button>
                          )}
                          {lostStage && stage?.stage_type !== 'lost' && (
                            <Button
                              variant="destructive"
                              size="sm"
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
                              <XCircle className="h-4 w-4 mr-2" />
                              Mark lost
                            </Button>
                          )}
                          {wonStage && stage?.stage_type !== 'won' && (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() =>
                                moveDeal.mutate({
                                  id: deal.id,
                                  stage_id: wonStage.id,
                                  stage_type: 'won',
                                })
                              }
                            >
                              <Trophy className="h-4 w-4 mr-2" />
                              Mark won
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <DealDetailsCollapsible deal={deal} />

                <Card className="bg-surface-primary border-border">
                  <CardHeader>
                    <CardTitle>Pipeline Stages</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
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
                            <AccordionItem key={s.id} value={s.id} className="border rounded-lg overflow-hidden">
                              <AccordionTrigger
                                className={cn('px-3 py-2 no-underline text-text-primary', getStageHeaderBgClass(s.stage_type))}
                              >
                                <div className="flex items-center gap-2">
                                  {isCurrent ? (
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                  ) : isPast ? (
                                    <CheckCircle2 className="h-4 w-4 text-primary/40" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-text-tertiary" />
                                  )}
                                  <div className="text-sm font-medium">{s.name}</div>
                                  <Badge variant={stageTypeBadgeVariant[s.stage_type] ?? 'secondary'}>
                                    {s.stage_type}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-3 pb-3">
                                {isCurrent ? (
                                  <div className="text-sm text-text-secondary">This is the current stage of the deal.</div>
                                ) : (
                                  <div className="mt-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-2"
                                      disabled={moveDeal.isPending}
                                      onClick={() => moveDeal.mutate({ id: deal.id, stage_id: s.id, stage_type: s.stage_type })}
                                    >
                                      <MoveRight className="h-4 w-4" />
                                      Move to this stage
                                    </Button>
                                  </div>
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
              </>
            )}

            {activeTab === 'billing' && (
              <>
                <DealBillingSummary
                  total={deal.amount ?? 0}
                  collected={collected}
                  currency={deal.currency}
                />
                <DealInvoicesCard dealId={deal.id} />
                <DealPaymentsCard dealId={deal.id} currency={deal.currency} />
              </>
            )}

            {activeTab === 'notes' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Notes ({(notes.data ?? []).length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Note Form — mirrors CandidateComments */}
                  <form ref={noteFormRef} onSubmit={handleSubmitNote} className="space-y-3">
                    <Textarea
                      placeholder="Add a note..."
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleNoteKeyDown}
                      rows={3}
                      className="resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">⌘↵ to submit</span>
                      <Button type="submit" disabled={!draft.trim() || isSubmittingNote}>
                        <Send className="h-4 w-4 mr-2" />
                        {isSubmittingNote ? 'Adding...' : 'Add Note'}
                      </Button>
                    </div>
                  </form>

                  <Separator />

                  {/* Notes List */}
                  <div className="space-y-4">
                    {notes.isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      </div>
                    ) : (notes.data ?? []).length === 0 ? (
                      <InlineEmpty text="No notes yet." />
                    ) : (
                      (notes.data ?? []).map((n) => (
                        <div key={n.id} className="bg-muted/20 rounded-lg p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Avatar className="h-5 w-5">
                                  {n.author_avatar_url && <AvatarImage src={n.author_avatar_url} alt={n.author_name ?? ''} />}
                                  <AvatarFallback className="bg-virgilio-purple/10 text-virgilio-purple text-[9px] font-semibold">
                                    {n.author_name
                                      ? n.author_name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
                                      : '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{n.author_name}</span>
                                <span>•</span>
                                <span>{formatNoteDate(n.created_at)}</span>
                              </div>
                              <p className="mt-2 text-sm whitespace-pre-wrap">{n.body}</p>
                            </div>
                            {canDeleteNote(n) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this note?')) {
                                    notes.deleteNote.mutate(n.id)
                                  }
                                }}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <DealFormSheet open={editing} onOpenChange={setEditing} deal={deal} />
    </>
  )
}
