import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { useAutomationRuns, type StageAutomation, type AutomationRun } from '@/hooks/useStageAutomations';
import { TableSkeleton } from '@/components/ui/table';

const TONE: Record<AutomationRun['status'], any> = {
  sent: 'green', scheduled: 'blue', skipped: 'neutral', failed: 'red', cancelled: 'neutral',
};
const LABEL: Record<AutomationRun['status'], string> = {
  sent: 'Ran', scheduled: 'Scheduled', skipped: 'Skipped', failed: 'Failed', cancelled: 'Cancelled',
};

export function AutomationRunsDialog({ automation, onClose }: { automation: StageAutomation | null; onClose: () => void }) {
  const { data: runs = [], isLoading } = useAutomationRuns(automation?.id ?? null);
  return (
    <Dialog open={!!automation} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[640px] p-0 overflow-hidden z-[80]">
        <DialogHeader className="px-6 pt-5 pb-3" style={{ borderBottom: '1px solid #F1F0EC' }}>
          <DialogTitle className="font-poppins tracking-[-0.04em]" style={{ fontSize: 17, fontWeight: 600 }}>
            Run history · {automation?.name}
          </DialogTitle>
          <DialogDescription className="font-inter" style={{ fontSize: 12.5, color: '#8B8F9E' }}>
            Last 100 runs. Skipped runs show why they were skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={4} columns={3} /></div>
          ) : runs.length === 0 ? (
            <div className="px-6 py-10 text-center font-inter" style={{ fontSize: 12.5, color: '#8B8F9E' }}>
              Nothing yet. Runs appear here as candidates hit the trigger.
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: '#F1F0EC' }}>
              {runs.map((r) => {
                const when = r.executed_at || r.scheduled_for || r.created_at;
                return (
                  <li key={r.id} className="px-6 py-3 flex items-start gap-3">
                    <Badge tone={TONE[r.status]} size="xs" dot>{LABEL[r.status]}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="font-poppins truncate" style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09' }}>
                        {r.candidate_name || 'Candidate'}{automation?.action === 'sequence' && <span className="font-inter ml-1.5" style={{ fontWeight: 400, color: '#8B8F9E' }}>· email {r.step}</span>}
                      </div>
                      {r.reason && <div className="font-inter" style={{ fontSize: 12, color: '#5A6072' }}>{r.reason}</div>}
                    </div>
                    <div className="text-right font-inter shrink-0" style={{ fontSize: 11.5, color: '#8B8F9E' }} title={format(new Date(when), 'PPpp')}>
                      {r.status === 'scheduled' ? `in ${formatDistanceToNow(new Date(when))}` : `${formatDistanceToNow(new Date(when))} ago`}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
