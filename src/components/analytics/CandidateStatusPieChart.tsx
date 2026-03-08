import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard'
import { PieChart as PieChartIcon } from 'lucide-react'

interface StatusData {
  name: string
  value: number
  color: string
}

interface CandidateStatusPieChartProps {
  data: StatusData[]
  isLoading?: boolean
}

const COLORS = [
  'hsl(180 100% 35%)',
  'hsl(120 100% 30%)',
  'hsl(0 70% 55%)',
  'hsl(267 89% 60%)',
  'hsl(220 13% 50%)',
]

export function CandidateStatusPieChart({ data, isLoading }: CandidateStatusPieChartProps) {
  return (
    <AnalyticsChartCard
      title="Status Distribution"
      icon={PieChartIcon}
      isLoading={isLoading}
      isEmpty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [value, 'Count']}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--virgilio-border))',
              borderRadius: '8px',
              fontFamily: 'Poppins, sans-serif',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontFamily: 'Poppins, sans-serif', fontSize: '12px' }} />
        </PieChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  )
}
