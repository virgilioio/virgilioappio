import { useState, useMemo, useCallback, useEffect } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PageHeader } from '@/components/layout/PageHeader';
import { Section } from '@/components/layout/Section';
import { MetricCard } from '@/components/ui/metric-card';
import { MetricCardGroup } from '@/components/ui/metric-card-group';
import { FilterCard } from '@/components/pipeline/FilterCard';
import { JobRow } from '@/components/pipeline/JobRow';
import { SavedViewSelector } from '@/components/filters/SavedViewSelector';
import { usePipelineGlobalMetrics, PipelineFilters } from '@/hooks/usePipelineGlobalMetrics';
import { usePipelineJobMetrics } from '@/hooks/usePipelineJobMetrics';
import { useJobs } from '@/hooks/useJobs';
import { useMembers } from '@/hooks/useMembers';
import { useOrganizations } from '@/hooks/useOrganizations';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserAssignedJobIds } from '@/hooks/useUserAssignedJobIds';
import { usePersistentFilters } from '@/hooks/usePersistentFilters';
import { useSavedViews } from '@/hooks/useSavedViews';
import { jobMatchesUsers } from '@/utils/jobInvolvement';
import { Briefcase, FileText, Clock, Users } from 'lucide-react';
import { Accordion } from '@/components/ui/accordion';
import { TableSkeleton } from '@/components/ui/skeleton';

interface PipelinePageFilters {
  selectedUsers: string[]
  selectedDepartments: string[]
  jobStatus: string
  searchTerm: string
}

const DEFAULT_FILTERS: PipelinePageFilters = {
  selectedUsers: [],
  selectedDepartments: [],
  jobStatus: 'open',
  searchTerm: '',
}

export default function Pipeline() {
  const permissions = usePermissions();
  const { jobs, isLoading: jobsLoading } = useJobs();
  const { members } = useMembers();
  const { organizations } = useOrganizations();

  // Filters
  const [pageFilters, setPageFilters] = useState<PipelinePageFilters>(DEFAULT_FILTERS);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const { setActiveViewId: persistViewId, getActiveViewId } = usePersistentFilters(
    'pipeline',
    pageFilters,
    setPageFilters,
    DEFAULT_FILTERS,
  );

  const { defaultView } = useSavedViews('pipeline');

  // On mount, restore active view or apply default
  useEffect(() => {
    const storedViewId = getActiveViewId();
    if (storedViewId) {
      setActiveViewId(storedViewId);
    } else if (defaultView) {
      setActiveViewId(defaultView.id);
      setPageFilters(defaultView.filters as unknown as PipelinePageFilters);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultView?.id]);

  const handleActiveViewChange = useCallback((viewId: string | null) => {
    setActiveViewId(viewId);
    persistViewId(viewId);
  }, [persistViewId]);

  const handleApplyView = useCallback((filters: Record<string, unknown>) => {
    setPageFilters(filters as unknown as PipelinePageFilters);
  }, []);

  const { selectedUsers, selectedDepartments, jobStatus, searchTerm } = pageFilters;

  const setSelectedUsers = useCallback((v: string[]) => setPageFilters(p => ({ ...p, selectedUsers: v })), []);
  const setSelectedDepartments = useCallback((v: string[]) => setPageFilters(p => ({ ...p, selectedDepartments: v })), []);
  const setJobStatus = useCallback((v: string) => { setPageFilters(p => ({ ...p, jobStatus: v })); setActiveViewId(null); persistViewId(null); }, [persistViewId]);
  const setSearchTerm = useCallback((v: string) => setPageFilters(p => ({ ...p, searchTerm: v })), []);

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
            <PageHeader title="Pipeline" />
          </Section>

          <Section container className="animate-fade-in">
            <div className="space-y-12">
              <div className="flex flex-wrap items-center gap-2">
                <SavedViewSelector
                  pageContext="pipeline"
                  currentFilters={pageFilters as unknown as Record<string, unknown>}
                  onApplyView={handleApplyView}
                  activeViewId={activeViewId}
                  onActiveViewChange={handleActiveViewChange}
                />
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
              </div>

              {/* Row 1: Hero KPIs */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <MetricCard
                    variant="hero"
                    title="Active Jobs"
                    value={metricsLoading ? 0 : globalMetrics?.active_jobs || 0}
                    icon={Briefcase}
                    iconColor="text-primary"
                    tooltip="Number of open jobs"
                    isLoading={metricsLoading}
                  />
                  <MetricCard
                    variant="hero"
                    title="In App Review"
                    value={globalMetrics?.application_review_count || 0}
                    icon={FileText}
                    iconColor="text-warning"
                    tooltip="Candidates in Application Review"
                    isLoading={metricsLoading}
                  />
                  <MetricCard
                    variant="hero"
                    title="Active Candidates"
                    value={globalMetrics?.active_candidates_count || 0}
                    icon={Users}
                    iconColor="text-virgilio-success"
                    tooltip="Candidates in Recruiting Process stages"
                    isLoading={metricsLoading}
                  />
                </div>

                {/* Row 2: Grouped strip */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MetricCardGroup title="Pipeline Health" direction="vertical">
                    <MetricCard
                      variant="inline"
                      title="Avg Days in Review"
                      value={globalMetrics?.avg_days_in_application_review !== null && globalMetrics?.avg_days_in_application_review !== undefined ? globalMetrics.avg_days_in_application_review : 'N/A'}
                      suffix={globalMetrics?.avg_days_in_application_review != null ? 'd' : undefined}
                      tooltip="Average time in Application Review"
                      isLoading={metricsLoading}
                    />
                  </MetricCardGroup>
                </div>
              </div>

              {/* Job List */}
              {jobsLoading || isFilteringUsers ? (
                <TableSkeleton rows={5} />
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
