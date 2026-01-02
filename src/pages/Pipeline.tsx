import { useState, useMemo } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PageHeader } from '@/components/layout/PageHeader';
import { Section } from '@/components/layout/Section';
import { PipelineMetricCard } from '@/components/pipeline/PipelineMetricCard';
import { FilterCard } from '@/components/pipeline/FilterCard';
import { JobRow } from '@/components/pipeline/JobRow';
import { usePipelineGlobalMetrics, PipelineFilters } from '@/hooks/usePipelineGlobalMetrics';
import { usePipelineJobMetrics } from '@/hooks/usePipelineJobMetrics';
import { useJobs } from '@/hooks/useJobs';
import { useMembers } from '@/hooks/useMembers';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserAssignedJobIds } from '@/hooks/useUserAssignedJobIds';
import { jobMatchesUsers } from '@/utils/jobInvolvement';
import { Briefcase, Users, Clock, TrendingUp } from 'lucide-react';
import { Accordion } from '@/components/ui/accordion';
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

  // Fetch job assignments for selected users
  const { assignedJobIds, isLoading: assignmentsLoading } = useUserAssignedJobIds(selectedUsers);

  // Client-side filter to apply status, search & user filters
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Status filter
      if (jobStatus !== 'all' && job.status !== jobStatus) return false;
      
      // Search filter
      if (searchTerm && !job.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      // User filter - check if any selected user is in the hiring_team OR job_assignments
      if (!jobMatchesUsers(job, selectedUsers, assignedJobIds)) return false;
      
      return true;
    });
  }, [jobs, jobStatus, searchTerm, selectedUsers, assignedJobIds]);

  const isFilteringUsers = selectedUsers.length > 0 && assignmentsLoading;

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
      <PermissionGate permission="canViewJobs">
        <div>
          <Section variant="default" banded container className="animate-fade-in">
            <PageHeader title="Pipeline" subtitle="Aggregate hiring pipeline across all jobs" />
          </Section>

          <Section container className="animate-fade-in">
            <div className="space-y-12">
              {/* Filters Card */}
              <FilterCard
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                jobStatus={jobStatus}
                onJobStatusChange={setJobStatus}
                selectedUsers={selectedUsers}
                onSelectedUsersChange={setSelectedUsers}
                userOptions={userOptions}
                showUserFilter={showUserFilter}
              />

              {/* Top Metrics Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <PipelineMetricCard
                  title="Active Jobs"
                  value={metricsLoading ? '...' : globalMetrics?.active_jobs || 0}
                  icon={Briefcase}
                  tooltip="Number of open jobs"
                  backgroundColor="#c5f5fb"
                  iconColor="#0891b2"
                />
                <PipelineMetricCard
                  title="In Application Review"
                  value={metricsLoading ? '...' : globalMetrics?.application_review_count || 0}
                  icon={Users}
                  tooltip="Candidates in Application Review (not yet in pipeline stages)"
                  backgroundColor="#d7c5fb"
                  iconColor="#7c3aed"
                />
                <PipelineMetricCard
                  title="Avg Days in App Review"
                  value={metricsLoading ? '...' : globalMetrics?.avg_days_in_application_review !== null ? `${globalMetrics.avg_days_in_application_review}d` : 'N/A'}
                  icon={Clock}
                  tooltip="Average time candidates spend in Application Review"
                  backgroundColor="#fffead"
                  iconColor="#ca8a04"
                />
                <PipelineMetricCard
                  title="Active Candidates"
                  value={metricsLoading ? '...' : globalMetrics?.active_candidates_count || 0}
                  icon={TrendingUp}
                  tooltip="Candidates currently in Recruiting Process stages"
                  backgroundColor="#d2ffc2"
                  iconColor="#16a34a"
                />
              </div>

              {/* Job List with Embedded Kanban */}
              {jobsLoading || isFilteringUsers ? (
                <div className="text-center py-8 text-muted-foreground">Loading jobs...</div>
              ) : filteredJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No jobs found matching your filters.
                </div>
              ) : (
                <Accordion type="multiple" defaultValue={[]} className="space-y-4">
                  {filteredJobs.map(job => (
                    <JobRow key={job.id} job={job} metrics={metricsMap.get(job.id)} />
                  ))}
                </Accordion>
              )}
            </div>
          </Section>
        </div>
      </PermissionGate>
    </AuthGate>
  );
}
