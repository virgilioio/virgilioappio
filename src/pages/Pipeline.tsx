import { useState, useMemo } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { GuestRestriction } from '@/components/auth/GuestRestriction';
import { PageHeader } from '@/components/layout/PageHeader';
import { Section } from '@/components/layout/Section';
import { PipelineMetricCard } from '@/components/pipeline/PipelineMetricCard';
import { JobRow } from '@/components/pipeline/JobRow';
import { usePipelineGlobalMetrics, PipelineFilters } from '@/hooks/usePipelineGlobalMetrics';
import { usePipelineJobMetrics } from '@/hooks/usePipelineJobMetrics';
import { useJobs } from '@/hooks/useJobs';
import { useMembers } from '@/hooks/useMembers';
import { usePermissions } from '@/hooks/usePermissions';
import { Briefcase, Users, Clock, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion } from '@/components/ui/accordion';
import { MultiSelect } from '@/components/ui/multi-select';

export default function Pipeline() {
  const permissions = usePermissions();
  const { jobs, isLoading: jobsLoading } = useJobs();
  const { members } = useMembers();

  // Filters
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [jobStatus, setJobStatus] = useState<string>('open');
  const [searchTerm, setSearchTerm] = useState('');

  const filters: PipelineFilters = useMemo(() => ({
    userIds: selectedUsers.length > 0 ? selectedUsers : undefined,
    jobStatuses: jobStatus !== 'all' ? [jobStatus] : undefined,
    search: searchTerm.trim() || undefined,
  }), [selectedUsers, jobStatus, searchTerm]);

  // Fetch global metrics
  const { data: globalMetrics, isLoading: metricsLoading } = usePipelineGlobalMetrics(filters);

  // Filter jobs client-side based on same criteria
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Status filter
      if (jobStatus !== 'all' && job.status !== jobStatus) return false;
      
      // Search filter
      if (searchTerm && !job.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      // User filter (check job_assignments - simplified, assumes all jobs visible if admin)
      // In practice, useJobs already respects RLS, so we trust the backend filtering
      
      return true;
    });
  }, [jobs, jobStatus, searchTerm]);

  const jobIds = filteredJobs.map(j => j.id);
  const { data: jobMetrics } = usePipelineJobMetrics(jobIds);

  // Build metrics lookup
  const metricsMap = useMemo(() => {
    if (!jobMetrics) return new Map();
    return new Map(jobMetrics.map(m => [m.job_id, m]));
  }, [jobMetrics]);

  // User options for filter (only active members)
  const userOptions = useMemo(() => {
    return members
      .filter(m => m.user_status === 'active' && m.user_id)
      .map(m => ({
        value: m.user_id!,
        label: `${m.user_first_name || ''} ${m.user_last_name || ''}`.trim() || m.user_email || m.invited_email || 'Unknown',
      }));
  }, [members]);

  const showUserFilter = permissions.isAdmin || permissions.isPlatformAdmin || permissions.isWorkspaceOwner; // Only admins/owners see user filter

  return (
    <AuthGate>
      <PermissionGate
        permission="canViewJobs"
        fallback={
          <GuestRestriction
            action="view pipeline"
            suggestion="Contact your administrator to request access."
          />
        }
      >
        <div>
          <Section variant="default" banded container className="animate-fade-in">
            <PageHeader title="Pipeline" subtitle="Aggregate hiring pipeline across all jobs" />
          </Section>

          <Section container className="animate-fade-in space-y-6">
            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <PipelineMetricCard
                title="Active Jobs"
                value={metricsLoading ? '...' : globalMetrics?.active_jobs || 0}
                icon={Briefcase}
                tooltip="Number of open jobs"
              />
              <PipelineMetricCard
                title="In Application Review"
                value={metricsLoading ? '...' : globalMetrics?.application_review_count || 0}
                icon={Users}
                tooltip="Candidates in Application Review (not yet in pipeline stages)"
              />
              <PipelineMetricCard
                title="Avg Days in App Review"
                value={metricsLoading ? '...' : globalMetrics?.avg_days_in_application_review !== null ? `${globalMetrics.avg_days_in_application_review}d` : 'N/A'}
                icon={Clock}
                tooltip="Average time candidates spend in Application Review"
              />
              <PipelineMetricCard
                title="Active Candidates"
                value={metricsLoading ? '...' : globalMetrics?.active_candidates_count || 0}
                icon={TrendingUp}
                tooltip="Candidates currently in Recruiting Process stages"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Input
                placeholder="Search by job title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="sm:max-w-xs"
              />
              <Select value={jobStatus} onValueChange={setJobStatus}>
                <SelectTrigger className="sm:w-[180px]">
                  <SelectValue placeholder="Job Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="filled">Filled</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              {showUserFilter && userOptions.length > 0 && (
                <MultiSelect
                  options={userOptions}
                  selectedValues={selectedUsers}
                  onSelectionChange={setSelectedUsers}
                  placeholder="Filter by user..."
                  className="sm:w-[220px]"
                />
              )}
            </div>

            {/* Job List with Embedded Kanban */}
            {jobsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading jobs...</div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No jobs found matching your filters.
              </div>
            ) : (
              <Accordion type="multiple" defaultValue={filteredJobs.map(j => j.id)} className="space-y-3">
                {filteredJobs.map(job => (
                  <JobRow key={job.id} job={job} metrics={metricsMap.get(job.id)} />
                ))}
              </Accordion>
            )}
          </Section>
        </div>
      </PermissionGate>
    </AuthGate>
  );
}
