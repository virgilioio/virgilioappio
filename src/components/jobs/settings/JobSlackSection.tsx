import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Loadable } from '@/components/ui/loadable'
import { LoadError } from '@/components/empty/LoadError'
import { SlackLogo } from '@/components/icons/SlackLogo'
import { SectionCard } from '@/components/jobs/wizard/_parts'
import { SlackAutomationList } from '@/components/settings/slack/SlackAutomationList'
import { SlackAutomationSheet, type AutomationDraftSeed } from '@/components/settings/slack/SlackAutomationSheet'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useTenant } from '@/hooks/useTenant'
import { SLACK_EVENT, useSlackAutomations, useSlackStatus, type SlackAutomation } from '@/lib/slack'

/**
 * A job's Slack (Setup › Slack, 2026-10-27): its own automations, which its
 * Recruiter and admins add, edit and remove, and the workspace-wide ones that
 * also fire for it ("From workspace", read here, changed in Settings).
 */
export function JobSlackSection({ jobId, jobTitle, readOnly }: { jobId: string; jobTitle: string; readOnly: boolean }) {
  const { tenant } = useTenant()
  const tenantId = tenant?.id
  const status = useSlackStatus(tenantId)
  const connected = !!status.data?.connected
  const working = connected && status.data?.status !== 'broken'
  const list = useSlackAutomations(tenantId, jobId, connected && !readOnly)
  const timedOut = useLoadTimeout(list.isLoading, list.dataUpdatedAt)
  const [seed, setSeed] = useState<AutomationDraftSeed | null>(null)

  const rows = list.data ?? []
  const own = rows.filter((r) => r.job_id === jobId)
  const fromWorkspace = rows.filter((r) => !r.job_id)
  // The one reminder a job's own team can set up: offer reminders are admins' (Settings).
  const scorecardReminder = !rows.some((r) => r.event === 'scorecard.due')

  return (
    <SectionCard
      title="Slack"
      trailing={
        connected && !readOnly ? (
          <Button size="sm" variant="secondary" icon={Plus} disabled={!working} onClick={() => setSeed({ id: null, row: null })}>
            New automation
          </Button>
        ) : null
      }
    >
      {!connected ? (
        <div className="flex items-start gap-3">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#EFEEEA] bg-[#FAFAF7]">
            <SlackLogo size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-poppins text-[13.5px] font-medium text-text-primary">Slack isn&rsquo;t connected</p>
            <p className="mt-0.5 font-inter text-[12.5px] text-text-tertiary">
              {status.data?.is_admin ? (
                <>
                  Connect it in{' '}
                  <Link to="/settings?tab=integrations" className="text-[#6F3FF5] hover:underline">
                    Settings › Integrations
                  </Link>{' '}
                  to send this job&rsquo;s news to your channels and people.
                </>
              ) : (
                'An admin connects Slack in Settings › Integrations; then you can send this job’s news there.'
              )}
            </p>
          </div>
        </div>
      ) : readOnly ? (
        <p className="font-inter text-[12.5px] text-text-tertiary">Admins and this job&rsquo;s Recruiter set up its Slack messages.</p>
      ) : list.isError || timedOut ? (
        <LoadError what="Slack automations" compact timedOut={timedOut && !list.isError} onRetry={() => void list.refetch()} />
      ) : (
        <Loadable
          loading={list.isLoading}
          skeleton={<Skeleton className="h-[104px] rounded-xl" />}
        >
          <div className="flex flex-col gap-2.5">
            {own.length === 0 && (
              <p className="font-inter text-[12.5px] text-text-tertiary">Nothing from this job goes to Slack on its own yet.</p>
            )}
            {(own.length > 0 || fromWorkspace.length > 0) && (
              <SlackAutomationList
                tenantId={tenantId!}
                rows={own}
                connected={working}
                inJob
                more={{ label: 'Also sent for this job, from Settings › Integrations', rows: fromWorkspace }}
                onEdit={(row) => setSeed({ id: row.id, row })}
                onDuplicate={(row) =>
                  setSeed({
                    id: null,
                    row: row.job_id ? row : { ...row, job_id: jobId, job_title: jobTitle, filters: row.filters.every_days ? { every_days: row.filters.every_days } : {} },
                  })
                }
              />
            )}
            {scorecardReminder && working && (
              <button
                type="button"
                onClick={() => setSeed({ id: null, row: scorecardStarter(jobId, jobTitle) })}
                className="gio-pressable flex items-center gap-3 rounded-xl border border-dashed border-[#DCDAD3] px-3 py-2.5 text-left transition-colors duration-hover hover:border-[#C9C7BF] hover:bg-[#FAFAF7]"
              >
                <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#EDE4FF] text-[#6F3FF5]">
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="block font-inter text-[13px] font-medium text-text-primary">Remind interviewers about scorecards</span>
                  <span className="block font-inter text-[12px] text-text-tertiary">A DM when their scorecard is due, every day until it&rsquo;s in.</span>
                </span>
              </button>
            )}
          </div>
        </Loadable>
      )}
      {tenantId && (
        <SlackAutomationSheet
          open={!!seed}
          onOpenChange={(o) => !o && setSeed(null)}
          tenantId={tenantId}
          jobId={seed?.row?.job_id === null && seed?.id ? null : jobId}
          jobTitle={jobTitle}
          isAdmin={!!status.data?.is_admin}
          connected={working}
          seed={seed}
        />
      )}
    </SectionCard>
  )
}

function scorecardStarter(jobId: string, jobTitle: string): SlackAutomation {
  const def = SLACK_EVENT['scorecard.due']
  return {
    id: '', job_id: jobId, job_title: jobTitle, name: null, event: 'scorecard.due',
    filters: { every_days: def.repeats?.initial ?? 1 }, destinations: [{ type: 'role', role: 'interviewer' }],
    message: def.message, is_active: true, preset: null, created_by_name: null, updated_at: '',
    last_sent_at: null, last_error: null, last_error_at: null, can_edit: true,
  }
}
