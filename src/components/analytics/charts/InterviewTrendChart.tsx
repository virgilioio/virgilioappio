import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { CalendarCheck } from 'lucide-react'
import type { InterviewTrendPoint } from '@/hooks/analytics/useInterviewHealthMetrics'

interface InterviewTrendChartProps {
  data: InterviewTrendPoint[]
  isLoading?: boolean
}

export function InterviewTrendChart({ data, isLoading }: InterviewTrendChartProps) {
  return (
    <AnalyticsChartCard
      title="Interview Trend"
      subtitle="Daily scheduled and completed interviews"
      icon={CalendarCheck}
      isLoading={isLoading}
      isEmpty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Line type="monotone" dataKey="scheduled" stroke="hsl(var(--virgilio-purple))" strokeWidth={2} dot={false} name="Scheduled" />
          <Line type="monotone" dataKey="completed" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="Completed" />
        </LineChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  )
}
