import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

interface TrendData {
  date: string
  applications: number
  active: number
  hires: number
  interviewsScheduled: number
}

interface ApplicationsTrendChartProps {
  data: TrendData[]
  isLoading?: boolean
}

export function ApplicationsTrendChart({ data, isLoading }: ApplicationsTrendChartProps) {
  if (isLoading) {
    return (
      <Card className="border-virgilio-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-poppins font-semibold text-virgilio-text" withPeriod={false}>
            Candidates Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="h-6 w-6 rounded-full border-2 border-virgilio-purple border-t-transparent animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-virgilio-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-poppins font-semibold text-virgilio-text" withPeriod={false}>
          Candidates Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--virgilio-border))" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: 'hsl(var(--virgilio-muted))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--virgilio-border))' }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: 'hsl(var(--virgilio-muted))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--virgilio-border))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--virgilio-border))',
                  borderRadius: '8px',
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '12px'
                }}
              />
              <Legend 
                wrapperStyle={{ fontFamily: 'Poppins, sans-serif', fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="applications"
                name="Applications"
                stroke="hsl(267 89% 60%)"
                strokeWidth={2}
                dot={{ fill: 'hsl(267 89% 60%)', r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="active"
                name="Active"
                stroke="hsl(180 100% 35%)"
                strokeWidth={2}
                dot={{ fill: 'hsl(180 100% 35%)', r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="hires"
                name="Hires"
                stroke="hsl(120 100% 30%)"
                strokeWidth={2}
                dot={{ fill: 'hsl(120 100% 30%)', r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="interviewsScheduled"
                name="Interviews Scheduled"
                stroke="hsl(45 100% 50%)"
                strokeWidth={2}
                dot={{ fill: 'hsl(45 100% 50%)', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
