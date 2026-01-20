import { Badge } from '@/components/ui/badge';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PipelineOverview } from '@/components/jobs/PipelineOverview';
import { Job } from '@/hooks/useJobs';
import { PipelineJobMetric } from '@/hooks/usePipelineJobMetrics';
import { formatDistanceToNow } from 'date-fns';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface JobRowProps {
  job: Job;
  metrics: PipelineJobMetric | undefined;
}

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  open: 'success',
  paused: 'warning',
  filled: 'secondary',
  closed: 'destructive',
  draft: 'default',
};

export function JobRow({ job, metrics }: JobRowProps) {
  const lastActivity = job.updated_at 
    ? formatDistanceToNow(new Date(job.updated_at), { addSuffix: true })
    : 'No activity';

  // Calculate stage-to-stage conversions from metrics.stages
  const stageConversions = metrics?.stages && metrics.stages.length > 1
    ? metrics.stages.slice(0, -1).map((stage, idx) => {
        const nextStage = metrics.stages[idx + 1];
        return {
          from: stage.stage_name,
          to: nextStage.stage_name,
          fromCount: stage.count_in_stage,
          toCount: nextStage.count_in_stage,
        };
      })
    : [];

  return (
    <AccordionItem value={job.id} className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline group">
        <div className="flex items-center justify-between w-full pr-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-base truncate">{job.title}</h3>
                <Badge variant={statusVariants[job.status] || 'default'} className="capitalize">
                  {job.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/jobs/${job.id}`, '_blank');
                  }}
                  title="Open job in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span>Active candidates: {metrics?.active_candidates || 0}</span>
                <span>•</span>
                <span>Last activity {lastActivity}</span>
              </div>
              {metrics && metrics.stages && metrics.stages.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  {metrics.stages.map((stage, idx) => (
                    <span key={stage.stage_id}>
                      {stage.stage_name.substring(0, 12)} {stage.count_in_stage}
                      {idx < metrics.stages.length - 1 && <ChevronRight className="inline h-3 w-3 mx-1" />}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {/* Job metrics strip above Kanban */}
        {metrics && (
          <div className="flex items-center gap-6 py-3 px-2 border-b text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Active Candidates:</span> {metrics.active_candidates}
            </div>
            {stageConversions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Stage Conversion:</span>
                {stageConversions.map((conv, idx) => (
                  <span key={idx}>
                    {conv.from.substring(0, 10)}→{conv.to.substring(0, 10)}: {conv.fromCount}→{conv.toCount}
                    {idx < stageConversions.length - 1 && <span className="mx-1">•</span>}
                  </span>
                ))}
              </div>
            )}
            <div>
              <span className="font-medium">Overall Conversion:</span> Start→Hired: {metrics.overall_start_count}→{metrics.overall_hired_count}
            </div>
          </div>
        )}
        
        {/* Embedded Kanban */}
        <div className="mt-4">
          <PipelineOverview jobId={job.id} showHeader={false} externalScroll={true} />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
