import { useMemo, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow } from 'date-fns';
import { Plus, GripVertical, MoreHorizontal, Pencil, Copy, History, Trash2, Sparkles, Zap, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { EmptyState, EmptyAction } from '@/components/ui/empty-state';
import { SoftEnvelope } from '@/components/ui/EmptyIllustrations';
import { menuItemDanger } from '@/lib/menu-classes';
import { cn } from '@/lib/utils';
import { useStageAutomations, type StageAutomation, type AutomationRunStats, type AutomationInput } from '@/hooks/useStageAutomations';
import { ACTION_BY_KEY, triggerPhrase, timingPhrase, isEmailAction } from '@/lib/automations';
import { AutomationBuilderSheet } from './AutomationBuilderSheet';
import { AutomationRunsDialog } from './AutomationRunsDialog';

interface AutomationsTabProps {
  jhsId: string;
  jobId: string;
  organizationId: string;
  stageName?: string;
}

export function AutomationsTab({ jhsId, jobId, stageName = 'This stage' }: AutomationsTabProps) {
  const {
    automations, stats, isLoading, createAutomation, updateAutomation, toggleActive, reorder,
    duplicateAutomation, deleteAutomation, countScheduledRuns,
  } = useStageAutomations(jhsId, jobId);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<StageAutomation | null>(null);
  const [recipe, setRecipe] = useState<'screening' | null>(null);
  const [runsFor, setRunsFor] = useState<StageAutomation | null>(null);
  const [deleting, setDeleting] = useState<{ automation: StageAutomation; scheduled: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => automations.map((a) => a.id), [automations]);

  const openCreate = (r: 'screening' | null = null) => { setEditing(null); setRecipe(r); setBuilderOpen(true); };
  const openEdit = (a: StageAutomation) => { setEditing(a); setRecipe(null); setBuilderOpen(true); };

  const handleSubmit = async (input: AutomationInput) => {
    if (editing) await updateAutomation.mutateAsync({ id: editing.id, ...input });
    else await createAutomation.mutateAsync(input);
    setBuilderOpen(false);
    setEditing(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorder.mutate(arrayMove(ids, from, to));
  };

  const askDelete = async (a: StageAutomation) => {
    const scheduled = await countScheduledRuns(a.id).catch(() => 0);
    setDeleting({ automation: a, scheduled });
  };

  const activeCount = automations.filter((a) => a.is_active).length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[68px] w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="font-poppins font-semibold" style={{ fontSize: 12.5, color: '#8B8F9E', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Automations
          </h3>
          <p className="font-inter mt-1" style={{ fontSize: 12.5, color: '#5A6072' }}>
            {automations.length === 0
              ? 'When something happens in this stage, do something — with timing and guardrails.'
              : `${activeCount} of ${automations.length} running · runs in order, top to bottom.`}
          </p>
        </div>
        {automations.length > 0 && (
          <Button onClick={() => openCreate()} size="sm" icon={<Plus className="h-3.5 w-3.5" />}>New automation</Button>
        )}
      </div>

      {automations.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            size="card"
            illustration={<SoftEnvelope />}
            title="No automations yet"
            body="Send emails, nudge the team, or move candidates automatically when things happen in this stage."
            primary={<EmptyAction variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => openCreate()}>New automation</EmptyAction>}
          />
          <button
            type="button"
            onClick={() => openCreate('screening')}
            className="w-full text-left rounded-xl p-4 flex items-start gap-3 bg-white hover:bg-[#FAFAF7] transition-colors"
            style={{ border: '1px solid #E8E6E0' }}
          >
            <span className="h-8 w-8 rounded-lg shrink-0 inline-flex items-center justify-center" style={{ background: '#EFE9FE', color: '#6F3FF5' }}>
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block font-poppins" style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09' }}>Start from a recipe · Screening invite + nudge</span>
              <span className="block font-inter" style={{ fontSize: 11.5, color: '#8B8F9E' }}>
                When a candidate enters, send an invite with your scheduling link. If they don't book, nudge them three days later. You can edit everything before saving.
              </span>
            </span>
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {automations.map((a) => (
                <AutomationRow
                  key={a.id}
                  automation={a}
                  stats={stats[a.id]}
                  onToggle={(v) => toggleActive.mutate({ id: a.id, isActive: v })}
                  onEdit={() => openEdit(a)}
                  onDuplicate={() => duplicateAutomation.mutate(a)}
                  onRuns={() => setRunsFor(a)}
                  onDelete={() => askDelete(a)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <AutomationBuilderSheet
        open={builderOpen}
        onOpenChange={(o) => { setBuilderOpen(o); if (!o) { setEditing(null); setRecipe(null); } }}
        jobId={jobId}
        jhsId={jhsId}
        stageName={stageName}
        automation={editing}
        recipe={recipe}
        onSubmit={handleSubmit}
        isSaving={createAutomation.isPending || updateAutomation.isPending}
      />

      <AutomationRunsDialog automation={runsFor} onClose={() => setRunsFor(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="z-[80]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.automation.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.scheduled
                ? `${deleting.scheduled} scheduled ${deleting.scheduled === 1 ? 'run' : 'runs'} will be cancelled. Past runs stay in the candidates' activity.`
                : 'Past runs stay in the candidates\' activity. This can\'t be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleting) deleteAutomation.mutate(deleting.automation.id); setDeleting(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AutomationRow({ automation: a, stats, onToggle, onEdit, onDuplicate, onRuns, onDelete }: {
  automation: StageAutomation;
  stats?: AutomationRunStats;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRuns: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: a.id });
  const def = ACTION_BY_KEY[a.action];
  const Icon = def?.icon ?? Zap;
  const emails = Array.isArray(a.config?.emails) ? a.config.emails.length : 0;
  const sentence = `When ${triggerPhrase(a.trigger, a.trigger_days)}, ${(def?.label || a.action).toLowerCase()}${a.action === 'sequence' && emails ? ` (${emails} emails)` : ''} ${timingPhrase(a.timing, a.delay_amount, a.delay_unit, a.send_at)}.`;
  const s = stats;
  const metrics: string[] = [];
  if (s) {
    if (s.sent) metrics.push(`${s.sent} ran`);
    if (isEmailAction(a.action) && s.opened) metrics.push(`${s.opened} opened`);
    if (s.scheduled) metrics.push(`${s.scheduled} scheduled`);
    if (s.skipped) metrics.push(`${s.skipped} skipped`);
    if (s.failed) metrics.push(`${s.failed} failed`);
  }

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform), transition,
        border: '1px solid #E8E6E0', opacity: isDragging ? 0.75 : a.is_active ? 1 : 0.7,
        boxShadow: isDragging ? '0 12px 32px -8px rgba(0,0,0,0.18)' : undefined,
      }}
      className={cn('group relative rounded-xl bg-white flex items-center gap-3 pl-1.5 pr-3 py-3 cursor-pointer hover:bg-[#FAFAF7] transition-colors', isDragging && 'z-10')}
      onClick={onEdit}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="h-7 w-5 shrink-0 inline-flex items-center justify-center rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 focus:opacity-100"
        style={{ color: '#8B8F9E' }}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="h-9 w-9 rounded-lg shrink-0 inline-flex items-center justify-center" style={{ background: def?.bg || '#F1F0EC', color: def?.fg || '#5A6072' }}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-poppins truncate" style={{ fontSize: 13, fontWeight: 600, color: '#0d0d09' }}>{a.name || def?.label || 'Automation'}</span>
          {!a.is_active && <span className="font-inter shrink-0 px-1.5 rounded" style={{ fontSize: 10.5, background: '#F1F0EC', color: '#8B8F9E' }}>Paused</span>}
          {s?.failed ? (
            <span className="inline-flex items-center gap-1 font-inter shrink-0" style={{ fontSize: 11, color: '#E0891A' }} title={s.lastFailure || undefined}>
              <AlertTriangle className="h-3 w-3" /> {s.lastFailure ? 'Last run failed' : 'Failures'}
            </span>
          ) : null}
        </div>
        <div className="font-inter truncate" style={{ fontSize: 12, color: '#5A6072' }}>{sentence}</div>
        <div className="font-inter truncate" style={{ fontSize: 11, color: '#8B8F9E' }}>
          {metrics.length ? metrics.join(' · ') : 'No runs yet'}
          {s?.lastRunAt ? ` · last ${formatDistanceToNow(new Date(s.lastRunAt))} ago` : ''}
          {(a.once_per_candidate || a.skip_if_replied) && (
            <> · {[a.once_per_candidate && 'once per candidate', a.skip_if_replied && 'skips if replied'].filter(Boolean).join(', ')}</>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Switch checked={a.is_active} onCheckedChange={onToggle} aria-label={a.is_active ? 'Pause automation' : 'Resume automation'} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="More actions" className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-[#F1F0EC]" style={{ color: '#5A6072' }}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="z-[80]">
            <DropdownMenuItem onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /> Duplicate</DropdownMenuItem>
            <DropdownMenuItem onClick={onRuns}><History className="h-3.5 w-3.5" /> Run history</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className={menuItemDanger}><Trash2 className="h-3.5 w-3.5" /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
