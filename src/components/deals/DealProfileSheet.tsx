import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Textarea } from '@/components/ui/textarea'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDeal, useDealMutations } from '@/hooks/useDeals'
import { useDealStages, type DealStageType } from '@/hooks/useDealStages'
import { useDealNotes } from '@/hooks/useDealNotes'
import { CURRENCY_SYMBOLS } from '@/constants/currencies'
import { DealFormSheet } from './DealFormSheet'
import { DealDetailsCollapsible } from './DealDetailsCollapsible'
import CandidateNameCard from '@/components/candidates/CandidateNameCard'
import { GioEmptyState } from '@/components/ui/GioEmptyState'

function formatAmount(amount: number | null, currency: string) {
  if (amount === null || amount === undefined) return '—'
  const symbol = CURRENCY_SYMBOLS[currency] ?? ''
  return `${symbol}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`
}

function ageInDays(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
  return `${days}d`
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
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [activeTab, setActiveTab] = useState<DealTab>('overview')
  const [openStageId, setOpenStageId] = useState<string | null>(null)

  if (!deal && open) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl">
          <div className="py-16">
            <GioEmptyState title="Loading deal" />
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

          {/* Quick actions */}
          <div className="px-6 py-3 border-b border-virgilio-border/40 flex items-center gap-2">
            {wonStage && stage?.stage_type !== 'won' && (
              <Button
                size="sm"
                variant="outline"
                className="text-virgilio-success border-virgilio-success/30 hover:bg-virgilio-success/10"
                onClick={() => moveDeal.mutate({ id: deal.id, stage_id: wonStage.id })}
              >
                <Trophy className="h-3.5 w-3.5 mr-1.5" /> Mark won
              </Button>
            )}
            {lostStage && stage?.stage_type !== 'lost' && (
              <Button
                size="sm"
                variant="outline"
                className="text-virgilio-error border-virgilio-error/30 hover:bg-virgilio-error/10"
                onClick={() => moveDeal.mutate({ id: deal.id, stage_id: lostStage.id })}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" /> Mark lost
              </Button>
            )}
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
                                      onClick={() => moveDeal.mutate({ id: deal.id, stage_id: s.id })}
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
                      <div className="text-sm text-text-secondary">No deal stages configured.</div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === 'billing' && (
              <Card className="bg-surface-primary border-border">
                <CardHeader>
                  <CardTitle>Billing & Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  <GioEmptyState
                    title="No invoices yet"
                    description="Invoices linked to this deal will appear here."
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'notes' && (
              <Card className="bg-surface-primary border-border">
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Textarea
                      rows={3}
                      placeholder="Add a note…"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="focus-visible:ring-virgilio-purple"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        disabled={!draft.trim() || notes.addNote.isPending}
                        className="bg-virgilio-purple hover:bg-virgilio-purple/90"
                        onClick={async () => {
                          await notes.addNote.mutateAsync(draft.trim())
                          setDraft('')
                        }}
                      >
                        {notes.addNote.isPending ? 'Adding…' : 'Add note'}
                      </Button>
                    </div>
                  </div>

                  {notes.isLoading ? (
                    <div className="text-sm text-virgilio-muted">Loading…</div>
                  ) : (notes.data ?? []).length === 0 ? (
                    <GioEmptyState title="No notes yet" description="Capture context as the deal progresses." />
                  ) : (
                    <ul className="space-y-3">
                      {(notes.data ?? []).map((n) => {
                        const initials = n.author_name
                          ? n.author_name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
                          : '?'
                        return (
                          <li key={n.id} className="rounded-lg border border-virgilio-border/40 p-3 bg-card">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  {n.author_avatar_url && <AvatarImage src={n.author_avatar_url} alt={n.author_name ?? ''} />}
                                  <AvatarFallback className="bg-virgilio-purple/10 text-virgilio-purple text-[9px] font-semibold">
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium text-virgilio-text">{n.author_name}</span>
                              </div>
                              <span className="text-[10px] text-virgilio-muted">{ageInDays(n.created_at)}</span>
                            </div>
                            <p className="text-sm text-virgilio-text whitespace-pre-wrap leading-relaxed">{n.body}</p>
                          </li>
                        )
                      })}
                    </ul>
                  )}
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
