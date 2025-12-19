import { useState } from 'react'
import { Users, UserCheck, Briefcase, Calendar, UserX, Download, Loader2 } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import { AnalyticsTimeFilter, TimePreset } from '@/components/analytics/AnalyticsTimeFilter'
import { ApplicationsTrendChart } from '@/components/analytics/ApplicationsTrendChart'
import { CandidateStatusPieChart } from '@/components/analytics/CandidateStatusPieChart'
import { StageDistributionChart } from '@/components/analytics/StageDistributionChart'
import { RecruitmentFunnelChart } from '@/components/analytics/RecruitmentFunnelChart'
import { useJobAnalyticsMetrics } from '@/hooks/useJobAnalyticsMetrics'
import { SalaryInsightsCard } from '@/components/jobs/SalaryInsightsCard'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { generateAnalyticsReport } from '@/utils/analyticsReportGenerator'

interface JobAnalyticsDashboardProps {
  jobId: string
  jobTitle?: string
  candidates?: any[]
  jobCurrency?: string
}

export function JobAnalyticsDashboard({ jobId, jobTitle, candidates = [], jobCurrency = 'USD' }: JobAnalyticsDashboardProps) {
  const { toast } = useToast()
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    endDate: new Date()
  })
  const [isExporting, setIsExporting] = useState(false)

  const {
    applications,
    activeCandidates,
    totalOffers,
    totalHires,
    scheduledInterviews,
    rejectedCandidates,
    statusDistribution,
    stageDistribution,
    trendData,
    isLoading
  } = useJobAnalyticsMetrics(jobId, dateRange)

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setDateRange({ startDate, endDate })
  }

  const handleExportReport = async () => {
    setIsExporting(true)
    try {
      await generateAnalyticsReport({
        data: {
          applications,
          activeCandidates,
          totalOffers,
          totalHires,
          scheduledInterviews,
          rejectedCandidates,
          statusDistribution,
          stageDistribution,
          trendData
        },
        dateRange,
        jobTitle
      })
      toast({
        title: 'Report exported',
        description: 'Your job analytics report has been downloaded.',
      })
    } catch (error) {
      console.error('[JobAnalytics] Export failed:', error)
      toast({
        title: 'Export failed',
        description: 'Failed to generate the report. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Time Filter and Export */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleExportReport}
          disabled={isExporting || isLoading}
          className="gap-2"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export Report
        </Button>
        <AnalyticsTimeFilter 
          onDateRangeChange={handleDateRangeChange}
          initialPreset="last30d"
        />
      </div>

      {/* Salary Insights - Keep existing component */}
      <SalaryInsightsCard 
        candidates={candidates}
        jobCurrency={jobCurrency}
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          title="Applications"
          value={isLoading ? '...' : applications}
          icon={<Users className="h-5 w-5" />}
          tooltip="New applications in selected period"
          backgroundColor="linear-gradient(135deg, hsl(var(--virgilio-purple) / 0.1), hsl(var(--virgilio-purple) / 0.05))"
          iconColor="hsl(var(--virgilio-purple))"
        />
        <MetricCard
          title="Active"
          value={isLoading ? '...' : activeCandidates}
          icon={<UserCheck className="h-5 w-5" />}
          tooltip="Currently active candidates"
          backgroundColor="linear-gradient(135deg, hsl(var(--info) / 0.1), hsl(var(--info) / 0.05))"
          iconColor="hsl(var(--info))"
        />
        <MetricCard
          title="Hires"
          value={isLoading ? '...' : totalHires}
          icon={<Briefcase className="h-5 w-5" />}
          tooltip="Candidates hired in selected period"
          backgroundColor="linear-gradient(135deg, hsl(var(--success) / 0.1), hsl(var(--success) / 0.05))"
          iconColor="hsl(var(--success))"
        />
        <MetricCard
          title="Interviews"
          value={isLoading ? '...' : scheduledInterviews}
          icon={<Calendar className="h-5 w-5" />}
          tooltip="Interviews scheduled in selected period"
          backgroundColor="linear-gradient(135deg, hsl(var(--warning) / 0.1), hsl(var(--warning) / 0.05))"
          iconColor="hsl(var(--warning))"
        />
        <MetricCard
          title="Rejected"
          value={isLoading ? '...' : rejectedCandidates}
          icon={<UserX className="h-5 w-5" />}
          tooltip="Total rejected candidates"
          backgroundColor="linear-gradient(135deg, hsl(var(--destructive) / 0.1), hsl(var(--destructive) / 0.05))"
          iconColor="hsl(var(--destructive))"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <ApplicationsTrendChart 
          data={trendData}
          isLoading={isLoading}
        />
        
        {/* Status Pie Chart */}
        <CandidateStatusPieChart 
          data={statusDistribution}
          isLoading={isLoading}
        />
        
        {/* Recruitment Funnel */}
        <RecruitmentFunnelChart 
          data={{
            applications: applications,
            activeCandidates: activeCandidates,
            offers: totalOffers,
            totalHires: totalHires
          }}
          isLoading={isLoading}
        />
        
        {/* Stage Distribution */}
        <StageDistributionChart 
          data={stageDistribution}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
