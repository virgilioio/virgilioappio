import { useState, useMemo } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PageHeader } from '@/components/layout/PageHeader';
import { Section } from '@/components/layout/Section';
import { MetricCard } from '@/components/ui/metric-card';
import { MetricCardGroup } from '@/components/ui/metric-card-group';
import { FilterCard } from '@/components/pipeline/FilterCard';
import { JobRow } from '@/components/pipeline/JobRow';
import { usePipelineGlobalMetrics, PipelineFilters } from '@/hooks/usePipelineGlobalMetrics';
import { usePipelineJobMetrics } from '@/hooks/usePipelineJobMetrics';
import { useJobs } from '@/hooks/useJobs';
import { useMembers } from '@/hooks/useMembers';
import { useOrganizations } from '@/hooks/useOrganizations';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserAssignedJobIds } from '@/hooks/useUserAssignedJobIds';
import { jobMatchesUsers } from '@/utils/jobInvolvement';
import { Briefcase } from 'lucide-react';
import { Accordion } from '@/components/ui/accordion';

export default function Pipeline() {
  const permissions = usePermissions();
  const { jobs, isLoading: jobsLoading } = useJobs();
  const { members } = useMembers();
  const { organizations } = useOrganizations();

  // Filters
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [jobStatus, setJobStatus] = useState<string>('open');
  const [searchTerm, setSearchTerm] = useState('');

  const filters: PipelineFilters = useMemo(() => ({
    userIds: selectedUsers.length > 0 ? selectedUsers : undefined,
    jobStatuses: jobStatus !== 'all' ? [jobStatus] : undefined,
    search: searchTerm.trim() || undefined,
  }), [selectedUsers, jobStatus, searchTerm]);

  const { data: globalMetrics, isLoading: metricsLoading } = usePipelineGlobalMetrics(filters);
  const { assignedJobIds, isLoading: assignmentsLoading } = useUserAssignedJobIds(selectedUsers);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (jobStatus !== 'all' && job.status !== jobStatus) return false;
      if (searchTerm && !job.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (!jobMatchesUsers(job, selectedUsers, assignedJobIds)) return false;
      if (selectedDepartments.length > 0 && !selectedDepartments.includes(job.organization_id)) return false;
      return true;
    });
  }, [jobs, jobStatus, searchTerm, selectedUsers, assignedJobIds, selectedDepartments]);

  const isFilteringUsers = selectedUsers.length > 0 && assignmentsLoading;

  const jobIds = filteredJobs.map(j => j.id);
  const { data: jobMetrics } = usePipelineJobMetrics(jobIds);

  const metricsMap = useMemo(() => {
    if (!jobMetrics) return new Map();
    return new Map(jobMetrics.map(m => [m.job_id, m]));
  }, [jobMetrics]);

  const userOptions = useMemo(() => {
    return members
      .filter(m => m.user_status === 'active' && m.user_id)
      .map(m => ({
        value: m.user_id!,
        label: `${m.user_first_name || ''} ${m.user_last_name || ''}`.trim() || m.user_email || m.invited_email || 'Unknown',
      }));
  }, [members]);

  const departmentOptions = useMemo(() => {
    return organizations
      .filter(org => org.status === 'active')
      .map(org => ({
        value: org.id,
        label: org.name,
      }));
  }, [organizations]);

  const showUserFilter = permissions.isAdmin || permissions.isPlatformAdmin || permissions.isWorkspaceOwner;

  return (
    <AuthGate>
      <PermissionGate permission="canViewJobs">
        <div>
          <Section variant="default" banded container className="animate-fade-in">
            <PageHeader title="Pipeline" subtitle="Aggregate hiring pipeline across all jobs" />
          </Section>

          <Section container className="animate-fade-in">
            <div className="space-y-12">
              <FilterCard
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                jobStatus={jobStatus}
                onJobStatusChange={setJobStatus}
                selectedUsers={selectedUsers}
                onSelectedUsersChange={setSelectedUsers}
                userOptions={userOptions}
                showUserFilter={showUserFilter}
                selectedDepartments={selectedDepartments}
                onSelectedDepartmentsChange={setSelectedDepartments}
                departmentOptions={departmentOptions}
              />

              {/* Top Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <MetricCard
                  variant="hero"
                  title="Active Jobs"
                  value={metricsLoading ? 0 : globalMetrics?.active_jobs || 0}
                  icon={Briefcase}
                  tooltip="Number of open jobs"
                  isLoading={metricsLoading}
                />
                <MetricCardGroup title="Pipeline" className="md:col-span-3">
                  <MetricCard
                    variant="inline"
                    title="In App Review"
                    value={globalMetrics?.application_review_count || 0}
                    tooltip="Candidates in Application Review"
                    isLoading={metricsLoading}
                  />
                  <MetricCard
                    variant="inline"
                    title="Avg Days in Review"
                    value={globalMetrics?.avg_days_in_application_review !== null && globalMetrics?.avg_days_in_application_review !== undefined ? globalMetrics.avg_days_in_application_review : 'N/A'}
                    suffix={globalMetrics?.avg_days_in_application_review != null ? 'd' : undefined}
                    tooltip="Average time in Application Review"
                    isLoading={metricsLoading}
                  />
                  <MetricCard
                    variant="inline"
                    title="Active Candidates"
                    value={globalMetrics?.active_candidates_count || 0}
                    tooltip="Candidates in Recruiting Process stages"
                    isLoading={metricsLoading}
                  />
                </MetricCardGroup>
              </div>

              {/* Job List */}
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
