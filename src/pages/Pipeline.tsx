import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useJobs } from '@/hooks/useJobs'
import { useMembers } from '@/hooks/useMembers'
import { useDepartments } from '@/hooks/useDepartments'
import { useUserAssignedJobIds } from '@/hooks/useUserAssignedJobIds'
import { jobMatchesUsers } from '@/utils/jobInvolvement'
import { usePipelineGlobalMetrics } from '@/hooks/usePipelineGlobalMetrics'
import { usePipelineJobMetrics } from '@/hooks/usePipelineJobMetrics'
import { MetricStrip, type MetricItem } from '@/components/ui/metric-strip'
import {
  PipelineFilterBar,
  type PipelineStatus,
  type PipelineSort,
} from '@/components/pipeline/PipelineFilterBar'
import { JobPipelineRow } from '@/components/pipeline/JobPipelineRow'
import { Briefcase, FileText, Users, Clock, Download, Plus } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'

const STATUS_LABEL: Record<PipelineStatus, string> = {
  all: 'jobs',
  open: 'open jobs',
  draft: 'draft jobs',
  closed: 'closed jobs',
  archived: 'archived jobs',
}

const SORT_LABEL: Record<PipelineSort, string> = {
  recent: 'recent activity',
  oldest: 'oldest activity',
  title: 'job title',
  active: 'active candidates',
}

export default function Pipeline() {
  const navigate = useNavigate()
  const { jobs, isLoading: jobsLoading } = useJobs()
  const { members } = useMembers()
  const { departments } = useDepartments()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PipelineStatus>('open')
  const [selectedOwners, setSelectedOwners] = useState<string[]>([])
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<PipelineSort>('recent')
  const [grouped, setGrouped] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { assignedJobIds } = useUserAssignedJobIds(selectedOwners)

  const ownerOptions = useMemo(
    () =>
      (members ?? [])
        .filter((m) => m.user_status === 'active' && m.user_id)
        .map((m) => ({
          value: m.user_id as string,
          label:
            [m.user_first_name, m.user_last_name].filter(Boolean).join(' ') ||
            m.user_email ||
            'Unknown',
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [members],
  )

  const departmentOptions = useMemo(
    () => (departments ?? []).map((d) => ({ value: d.id, label: d.name })),
    [departments],
  )

  const statusFilteredJobs = useMemo(
    () => (status === 'all' ? jobs : jobs.filter((j) => j.status === status)),
    [jobs, status],
  )

  // Used for the "of N" denominator in the result count line — same status scope as filteredJobs.
  const baseJobs = statusFilteredJobs

  const filteredJobs = useMemo(() => {
    let list = [...statusFilteredJobs]

    if (selectedDepartments.length > 0) {
      const deptIds = new Set(selectedDepartments)
      const deptNames = new Set(
        (departments ?? [])
          .filter((d) => deptIds.has(d.id))
          .map((d) => d.name.toLowerCase()),
      )
      list = list.filter((j) => {
        if (j.department_id && deptIds.has(j.department_id)) return true
        if (j.department && deptNames.has(j.department.toLowerCase())) return true
        return false
      })
    }

    if (selectedOwners.length > 0) {
      list = list.filter((j) => jobMatchesUsers(j, selectedOwners, assignedJobIds))
    }

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          (j.department || '').toLowerCase().includes(q),
      )
    }

    return list
  }, [statusFilteredJobs, selectedDepartments, departments, selectedOwners, assignedJobIds, search])

  const { data: globalMetrics } = usePipelineGlobalMetrics({ jobStatuses: ['open'] })
  const jobIds = filteredJobs.map((j) => j.id)
  const { data: jobMetrics } = usePipelineJobMetrics(jobIds)
  const metricsMap = useMemo(() => new Map((jobMetrics ?? []).map((m) => [m.job_id, m])), [jobMetrics])

  const sortedJobs = useMemo(() => {
    const list = [...filteredJobs]
    switch (sortBy) {
      case 'oldest':
        list.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
        break
      case 'title':
        list.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'active':
        list.sort((a, b) => {
          const av = metricsMap.get(a.id)?.active_candidates ?? 0
          const bv = metricsMap.get(b.id)?.active_candidates ?? 0
          if (bv !== av) return bv - av
          return a.title.localeCompare(b.title)
        })
        break
      case 'recent':
      default:
        list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    }
    return list
  }, [filteredJobs, sortBy, metricsMap])

  const totalActive = useMemo(
    () => (jobMetrics ?? []).reduce((s, m) => s + (m.active_candidates || 0), 0),
    [jobMetrics],
  )

  const lastUpdate = useMemo(() => {
    if (statusFilteredJobs.length === 0) return null
    const maxT = Math.max(...statusFilteredJobs.map((j) => new Date(j.updated_at).getTime()))
    return new Date(maxT)
  }, [statusFilteredJobs])

  const metricItems: MetricItem[] = [
    {
      icon: Briefcase,
      tone: 'purple',
      label: 'Active jobs',
      value: globalMetrics?.active_jobs ?? 0,
    },
    {
      icon: FileText,
      tone: 'yellow',
      label: 'In application review',
      value: globalMetrics?.application_review_count ?? 0,
    },
    {
      icon: Users,
      tone: 'green',
      label: 'Active candidates',
      value: globalMetrics?.active_candidates_count ?? 0,
    },
    {
      icon: Clock,
      tone: 'blue',
      label: 'Avg days in review',
      value:
        globalMetrics?.avg_days_in_application_review != null
          ? Number(globalMetrics.avg_days_in_application_review).toFixed(1)
          : '—',
      unit: globalMetrics?.avg_days_in_application_review != null ? 'd' : undefined,
    },
  ]

  const toggleRow = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allExpanded = sortedJobs.length > 0 && sortedJobs.every((j) => expanded.has(j.id))
  const onToggleExpandAll = () => {
    setExpanded(allExpanded ? new Set() : new Set(sortedJobs.map((j) => j.id)))
  }

  // Grouped sections by department
  const groups = useMemo(() => {
    if (!grouped) return null
    const map = new Map<string, typeof sortedJobs>()
    for (const j of sortedJobs) {
      const key = j.department || 'Unassigned'
      const arr = map.get(key) ?? []
      arr.push(j)
      map.set(key, arr)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [sortedJobs, grouped])

  return (
    <AuthGate>
      <PermissionGate permission="canViewJobs">
        <div className="min-h-[100dvh] w-full" style={{ background: '#F6F5F1' }}>
          <div className="mx-auto max-w-[1400px] px-6 py-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1
                  className="font-poppins text-[#0d0d09]"
                  style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.1 }}
                >
                  Pipeline
                </h1>
                <div
                  className="mt-1.5 flex flex-wrap items-center font-inter"
                  style={{ fontSize: 12, color: '#8B8F9E', gap: 8 }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#12B886' }} />
                    {globalMetrics?.active_jobs ?? openJobs.length} open jobs
                  </span>
                  <span>·</span>
                  <span>{globalMetrics?.active_candidates_count ?? totalActive} active candidates</span>
                  {lastUpdate ? (
                    <>
                      <span>·</span>
                      <span>Updated {formatDistanceToNowStrict(lastUpdate, { addSuffix: true })}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 font-poppins text-[13px] font-medium text-[#0d0d09] hover:bg-[#FAFAF7]"
                  style={{ borderColor: '#E7E8EE' }}
                >
                  <Download size={14} strokeWidth={2} />
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/jobs?new=1')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 font-poppins text-[13px] font-medium text-white"
                  style={{ background: '#0d0d09' }}
                >
                  <Plus size={14} strokeWidth={2} />
                  New job
                </button>
              </div>
            </div>

            {/* Metric strip */}
            <div style={{ marginTop: 12 }}>
              <MetricStrip items={metricItems} />
            </div>

            {/* Filter bar */}
            <div style={{ marginTop: 10 }}>
              <PipelineFilterBar
                search={search}
                onSearchChange={setSearch}
                status="Open"
                owner="Anyone"
                department="All"
                grouped={grouped}
                onToggleGroup={() => setGrouped((g) => !g)}
                allExpanded={allExpanded}
                onToggleExpandAll={onToggleExpandAll}
              />
            </div>

            {/* Result count */}
            <div
              className="font-inter"
              style={{ marginTop: 12, fontSize: 11.5, color: '#8B8F9E' }}
            >
              Showing {filteredJobs.length} of {openJobs.length} open jobs · sorted by recent activity
            </div>

            {/* Job list */}
            <div style={{ marginTop: 12 }}>
              {jobsLoading ? (
                <div className="flex flex-col gap-2.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-[12px] bg-white"
                      style={{ border: '1px solid #E7E8EE', height: 68 }}
                    />
                  ))}
                </div>
              ) : filteredJobs.length === 0 ? (
                <div
                  className="rounded-[12px] bg-white px-6 py-10 text-center font-inter"
                  style={{ border: '1px solid #E7E8EE', color: '#5A6072', fontSize: 13 }}
                >
                  {search ? (
                    <>No jobs match &ldquo;{search}&rdquo;</>
                  ) : (
                    <>No open jobs yet</>
                  )}
                </div>
              ) : grouped && groups ? (
                <div className="flex flex-col gap-5">
                  {groups.map(([dept, list]) => (
                    <div key={dept}>
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className="font-inter uppercase"
                          style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#8B8F9E' }}
                        >
                          {dept}
                        </span>
                        <span
                          className="font-poppins tabular-nums"
                          style={{ fontSize: 11, color: '#B5B9C4' }}
                        >
                          {list.length}
                        </span>
                        <div className="ml-1 h-px flex-1" style={{ background: '#F1F0EC' }} />
                      </div>
                      <div className="flex flex-col" style={{ gap: 10 }}>
                        {list.map((job) => (
                          <JobPipelineRow
                            key={job.id}
                            job={job}
                            metrics={metricsMap.get(job.id)}
                            expanded={expanded.has(job.id)}
                            onToggle={() => toggleRow(job.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col" style={{ gap: 10 }}>
                  {filteredJobs.map((job) => (
                    <JobPipelineRow
                      key={job.id}
                      job={job}
                      metrics={metricsMap.get(job.id)}
                      expanded={expanded.has(job.id)}
                      onToggle={() => toggleRow(job.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
