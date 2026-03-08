import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { useAnalyticsMetrics, DateRange } from '@/hooks/useAnalyticsMetrics'
import { AnalyticsTimeFilter } from '@/components/analytics/AnalyticsTimeFilter'
import { AnalyticsFiltersBar, AnalyticsFilters } from '@/components/analytics/AnalyticsFiltersBar'
import { ApplicationsTrendChart } from '@/components/analytics/ApplicationsTrendChart'
import { CandidateStatusPieChart } from '@/components/analytics/CandidateStatusPieChart'
import { StageDistributionChart } from '@/components/analytics/StageDistributionChart'
import { RecruitmentFunnelChart } from '@/components/analytics/RecruitmentFunnelChart'
import { PipelineOverviewTable } from '@/components/analytics/PipelineOverviewTable'
import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { AnalyticsKpiCard } from '@/components/analytics/shared/AnalyticsKpiCard'
import { AnalyticsEmptyState } from '@/components/analytics/shared/AnalyticsEmptyState'
import { Button } from '@/components/ui/button'
import {
  BarChart3, Download, Loader2,
  FileText, Users, UserCheck, CalendarPlus, CalendarCheck, UserX, Clock,
  GitBranch, Activity, Layers, Globe, Stethoscope
} from 'lucide-react'
import { subDays } from 'date-fns'
import { generateAnalyticsReport } from '@/utils/analyticsReportGenerator'

/*
 * ══════════════════════════════════════════════════════════════════
 * ANALYTICS DASHBOARD — IMPLEMENTATION STATUS
 * ══════════════════════════════════════════════════════════════════
 *
 * ✅ LIVE (existing metrics):
 *   - Applications, Active, Hires, Scheduled, Completed, Rejected, Avg Time to Hire
 *   - Status Distribution (pie), Stage Distribution (bar), Trend (line), Funnel
 *   - Pipeline Overview Table (per-job stage counts)
 *
 * 🔜 PHASE 1 — derivable from existing data (no schema changes):
 *   - Stage conversion rates (from job_candidate_stage_history)
 *   - Time in stage / stuck candidates (from entered_stage_at, stage_history)
 *   - Source effectiveness (from candidates.source joined with associations)
 *   - Recruiter workload (from job_candidate_associations.added_by)
 *   - Rejection reason breakdown (from rejection_reason_id)
 *   - Interview load per interviewer (from scheduled_bookings.interviewer_id)
 *   - Scorecard completion rate (from job_stage_scorecards)
 *
 * 🔮 FUTURE — requires schema additions:
 *   - Offer details (salary offered, acceptance/decline tracking)
 *   - DEI/diversity metrics
 *   - Candidate activity log (engagement tracking)
 *   - Passthrough rate (explicit stage pass/fail)
 * ══════════════════════════════════════════════════════════════════
 */

export default function Analytics() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isPlatformAdmin, isWorkspaceOwner, isAdmin } = usePermissions()
  const canAccessAnalytics = isPlatformAdmin || isWorkspaceOwner || isAdmin

  useEffect(() => {
    if (canAccessAnalytics === false) {
      toast({
        title: 'Access Denied',
        description: 'Analytics is only available to administrators.',
        variant: 'destructive',
      })
      navigate('/dashboard')
    }
  }, [canAccessAnalytics, navigate, toast])

  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: subDays(new Date(), 7),
    endDate: new Date(),
  })

  const [advancedFilters, setAdvancedFilters] = useState<AnalyticsFilters>({
    recruiterIds: [],
    jobIds: [],
    organizationIds: [],
    jobStatus: 'open',
  })

  const metrics = useAnalyticsMetrics({ dateRange, ...advancedFilters })

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setDateRange({ startDate, endDate })
  }

  const handleFiltersChange = useCallback((filters: AnalyticsFilters) => {
    setAdvancedFilters(filters)
  }, [])

  const [isExporting, setIsExporting] = useState(false)

  const handleExportReport = async () => {
    setIsExporting(true)
    try {
      await generateAnalyticsReport({
        data: {
          applications: metrics.applications,
          activeCandidates: metrics.activeCandidates,
          totalOffers: metrics.totalOffers,
          totalHires: metrics.totalHires,
          interviewsScheduled: metrics.interviewsScheduled,
          interviewsCompleted: metrics.interviewsCompleted,
          rejectedCandidates: metrics.rejectedCandidates,
          statusDistribution: metrics.statusDistribution,
          stageDistribution: metrics.stageDistribution,
          trendData: metrics.trendData,
          interviewsByStage: [],
          stageConversions: [],
          avgTimePerStage: [],
        },
        dateRange,
      })
      toast({ title: 'Report exported', description: 'Your analytics report has been downloaded.' })
    } catch (error) {
      console.error('[Analytics] Export failed:', error)
      toast({ title: 'Export failed', description: 'Failed to generate the report. Please try again.', variant: 'destructive' })
    } finally {
      setIsExporting(false)
    }
  }

  if (canAccessAnalytics === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-virgilio-purple border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!canAccessAnalytics) return null

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-virgilio-purple/10">
            <BarChart3 className="h-6 w-6 text-virgilio-purple" />
          </div>
          <div>
            <h1 className="text-2xl font-poppins font-semibold text-virgilio-text">
              Analytics<span className="text-[hsl(var(--purple-period))]">.</span>
            </h1>
            <p className="text-sm text-virgilio-muted font-poppins">
              Platform-wide metrics and insights
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleExportReport}
            disabled={isExporting || metrics.isLoading}
            className="gap-2"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export Report
          </Button>
          <AnalyticsTimeFilter onDateRangeChange={handleDateRangeChange} />
        </div>
      </div>

      {/* Filter Chips */}
      <AnalyticsFiltersBar onFiltersChange={handleFiltersChange} />

      {/* ─── SECTION: Overview ─── */}
      {/* LIVE: All KPIs below are backed by real data */}
      <AnalyticsSection
        title="Overview"
        subtitle="Key recruiting metrics at a glance"
        icon={BarChart3}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <AnalyticsKpiCard title="Applications" value={metrics.applications} icon={FileText} tooltip="New applications in selected period" isLoading={metrics.isLoading} />
          <AnalyticsKpiCard title="Active" value={metrics.activeCandidates} icon={Users} tooltip="Currently active candidates (all time)" isLoading={metrics.isLoading} />
          <AnalyticsKpiCard title="Hires" value={metrics.totalHires} icon={UserCheck} tooltip="Candidates hired in selected period" isLoading={metrics.isLoading} />
          <AnalyticsKpiCard title="Scheduled" value={metrics.interviewsScheduled} icon={CalendarPlus} tooltip="Interviews scheduled in selected period" isLoading={metrics.isLoading} />
          <AnalyticsKpiCard title="Completed" value={metrics.interviewsCompleted} icon={CalendarCheck} tooltip="Interviews completed in selected period" isLoading={metrics.isLoading} />
          <AnalyticsKpiCard title="Rejected" value={metrics.rejectedCandidates} icon={UserX} tooltip="Total rejected candidates (all time)" isLoading={metrics.isLoading} />
          <AnalyticsKpiCard title="Avg Time to Hire" value={metrics.avgTimeToHire} icon={Clock} suffix="d" tooltip="Average days from candidate creation to hire" isLoading={metrics.isLoading} />
        </div>

        {/* Trend chart */}
        <ApplicationsTrendChart data={metrics.trendData} isLoading={metrics.isLoading} />
      </AnalyticsSection>

      {/* ─── SECTION: Pipeline Health ─── */}
      {/* LIVE: Pipeline table, funnel, and status distribution */}
      <AnalyticsSection
        title="Pipeline Health"
        subtitle="Current state of your hiring pipeline across all jobs"
        icon={GitBranch}
      >
        <PipelineOverviewTable jobIds={metrics.finalJobIds} isLoading={metrics.isLoading} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecruitmentFunnelChart
            data={{
              applications: metrics.applications,
              activeCandidates: metrics.activeCandidates,
              offers: metrics.totalOffers,
              totalHires: metrics.totalHires,
            }}
            isLoading={metrics.isLoading}
          />
          <CandidateStatusPieChart data={metrics.statusDistribution} isLoading={metrics.isLoading} />
        </div>
      </AnalyticsSection>

      {/* ─── SECTION: Stage Performance ─── */}
      {/* LIVE: Stage distribution chart */}
      {/* PHASE 1: Stage conversion rates, time in stage, stuck candidates (derivable from job_candidate_stage_history) */}
      <AnalyticsSection
        title="Stage Performance"
        subtitle="How candidates move through your pipeline stages"
        icon={Layers}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StageDistributionChart data={metrics.stageDistribution} isLoading={metrics.isLoading} />

          {/* PHASE 1: Stage conversion rates & time in stage will go here */}
          {/* Placeholder — will be replaced with real derived data in next phase */}
        </div>
      </AnalyticsSection>

      {/* ─── SECTION: Source Performance ─── */}
      {/* PHASE 1: Source breakdown (derivable from candidates.source joined with associations) */}
      <AnalyticsSection
        title="Source Performance"
        subtitle="Where your best candidates come from"
        icon={Globe}
        phase="phase1"
        defaultCollapsed
      >
        <AnalyticsEmptyState
          icon={Globe}
          title="Source analytics coming soon"
          description="Will show application volume, hire rate, and time-to-hire by candidate source"
        />
      </AnalyticsSection>

      {/* ─── SECTION: Interview Health ─── */}
      {/* PHASE 1: Interview load per interviewer, completion rate, cancellation rate (from scheduled_bookings) */}
      <AnalyticsSection
        title="Interview Health"
        subtitle="Interview scheduling, completion, and interviewer workload"
        icon={Stethoscope}
        phase="phase1"
        defaultCollapsed
      >
        <AnalyticsEmptyState
          icon={Stethoscope}
          title="Interview analytics coming soon"
          description="Will show interview completion rates, interviewer load, and cancellation trends"
        />
      </AnalyticsSection>

      {/* ─── SECTION: Recruiter Performance ─── */}
      {/* PHASE 1: Recruiter workload (from added_by), candidates per recruiter, hires per recruiter */}
      <AnalyticsSection
        title="Recruiter Performance"
        subtitle="Workload and effectiveness by team member"
        icon={Activity}
        phase="phase1"
        defaultCollapsed
      >
        <AnalyticsEmptyState
          icon={Activity}
          title="Recruiter analytics coming soon"
          description="Will show candidate volume, hire rate, and pipeline velocity per recruiter"
        />
      </AnalyticsSection>
    </div>
  )
}
