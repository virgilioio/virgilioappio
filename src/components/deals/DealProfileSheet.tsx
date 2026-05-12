import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Pencil, Trash2, Trophy, XCircle } from 'lucide-react'
import { useDeal, useDealMutations, type Deal } from '@/hooks/useDeals'
import { useDealStages } from '@/hooks/useDealStages'
import { useDealNotes } from '@/hooks/useDealNotes'
import { CURRENCY_SYMBOLS } from '@/constants/currencies'
import { DealFormSheet } from './DealFormSheet'
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

interface DealProfileSheetProps {
  dealId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DealProfileSheet({ dealId, open, onOpenChange }: DealProfileSheetProps) {
  const { data: deal } = useDeal(dealId)
  const { data: stages = [] } = useDealStages()
  const { updateDeal, deleteDeal, moveDeal } = useDealMutations()
  const notes = useDealNotes(dealId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

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
  const ownerInitials = deal.owner_name
    ? deal.owner_name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
    : '?'

  const wonStage = stages.find((s) => s.stage_type === 'won')
  const lostStage = stages.find((s) => s.stage_type === 'lost')

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
                  <Badge
                    variant="secondary"
                    className={
                      stage.stage_type === 'won'
                        ? 'bg-virgilio-success/10 text-virgilio-success border-0'
                        : stage.stage_type === 'lost'
                        ? 'bg-virgilio-error/10 text-virgilio-error border-0'
                        : 'bg-muted text-virgilio-text border-0'
                    }
                  >
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
          <div className="px-6 py-4">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Owner">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {deal.owner_avatar_url && <AvatarImage src={deal.owner_avatar_url} alt={deal.owner_name ?? ''} />}
                        <AvatarFallback className="bg-virgilio-purple/10 text-virgilio-purple text-[10px] font-semibold">
                          {ownerInitials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-virgilio-text">{deal.owner_name ?? '—'}</span>
                    </div>
                  </Field>
                  <Field label="Company">
                    <span className="text-sm text-virgilio-text">{deal.organization_name ?? '—'}</span>
                  </Field>
                  <Field label="Amount">
                    <span className="text-sm font-poppins font-semibold tracking-[-0.02em]">
                      {formatAmount(deal.amount, deal.currency)}{' '}
                      <span className="text-xs text-virgilio-muted font-normal">{deal.currency}</span>
                    </span>
                  </Field>
                  <Field label="Expected close">
                    <span className="text-sm text-virgilio-text">
                      {deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : '—'}
                    </span>
                  </Field>
                </div>

                {deal.notes && (
                  <Field label="Description">
                    <p className="text-sm text-virgilio-text whitespace-pre-wrap leading-relaxed">{deal.notes}</p>
                  </Field>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-4 space-y-4">
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
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      <DealFormSheet open={editing} onOpenChange={setEditing} deal={deal} />
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wider text-virgilio-muted">{label}</p>
      {children}
    </div>
  )
}
