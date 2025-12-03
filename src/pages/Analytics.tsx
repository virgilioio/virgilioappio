import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { useAnalyticsMetrics, DateRange } from '@/hooks/useAnalyticsMetrics'
import { AnalyticsTimeFilter } from '@/components/analytics/AnalyticsTimeFilter'
import { ApplicationsTrendChart } from '@/components/analytics/ApplicationsTrendChart'
import { CandidateStatusPieChart } from '@/components/analytics/CandidateStatusPieChart'
import { StageDistributionChart } from '@/components/analytics/StageDistributionChart'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Users, UserCheck, Calendar, BarChart3 } from 'lucide-react'
import { subDays } from 'date-fns'

export default function Analytics() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isPlatformAdmin } = usePermissions()

  // Redirect non-platform admins
  useEffect(() => {
    if (isPlatformAdmin === false) {
      toast({
        title: 'Access Denied',
        description: 'Analytics is only available to platform administrators.',
        variant: 'destructive'
      })
      navigate('/dashboard')
    }
  }, [isPlatformAdmin, navigate, toast])

  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: subDays(new Date(), 7),
    endDate: new Date()
  })

  const metrics = useAnalyticsMetrics(dateRange)

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setDateRange({ startDate, endDate })
  }

  // Don't render until we verify platform admin status
  if (isPlatformAdmin === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-virgilio-purple border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!isPlatformAdmin) {
    return null
  }

  const metricCards = [
    {
      title: 'Applications',
      value: metrics.applications,
      icon: FileText,
      bgColor: 'hsl(267 84% 87%)', // #d7c5fb
      iconColor: 'hsl(267 89% 60%)' // Purple
    },
    {
      title: 'Active Candidates',
      value: metrics.activeCandidates,
      icon: Users,
      bgColor: 'hsl(180 100% 88%)', // #c5f5fb
      iconColor: 'hsl(180 100% 35%)' // Cyan
    },
    {
      title: 'Total Hires',
      value: metrics.totalHires,
      icon: UserCheck,
      bgColor: 'hsl(120 100% 88%)', // #d2ffc2
      iconColor: 'hsl(120 100% 30%)' // Green
    },
    {
      title: 'Scheduled Interviews',
      value: metrics.scheduledInterviews,
      icon: Calendar,
      bgColor: 'hsl(48 100% 90%)', // #fffead
      iconColor: 'hsl(48 100% 35%)' // Yellow
    }
  ]

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
        <AnalyticsTimeFilter onDateRangeChange={handleDateRangeChange} />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => (
          <Card key={card.title} className="border-virgilio-border hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-poppins font-medium text-virgilio-muted">
                    {card.title}
                  </p>
                  <p className="text-3xl font-poppins font-bold text-virgilio-text mt-1">
                    {metrics.isLoading ? (
                      <span className="inline-block w-12 h-8 bg-virgilio-border/50 rounded animate-pulse" />
                    ) : (
                      card.value.toLocaleString()
                    )}
                  </p>
                </div>
                <div
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: card.bgColor }}
                >
                  <card.icon
                    className="h-5 w-5"
                    style={{ color: card.iconColor }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ApplicationsTrendChart data={metrics.trendData} isLoading={metrics.isLoading} />
        <CandidateStatusPieChart data={metrics.statusDistribution} isLoading={metrics.isLoading} />
      </div>

      {/* Charts Row 2 */}
      <StageDistributionChart data={metrics.stageDistribution} isLoading={metrics.isLoading} />
    </div>
  )
}
