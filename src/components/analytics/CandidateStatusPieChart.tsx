import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

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
  'hsl(180 100% 35%)',  // Cyan - Active
  'hsl(120 100% 30%)',  // Green - Hired
  'hsl(0 70% 55%)',     // Red - Rejected
  'hsl(267 89% 60%)',   // Purple - Offer
  'hsl(220 13% 50%)',   // Gray - Withdrawn
]

export function CandidateStatusPieChart({ data, isLoading }: CandidateStatusPieChartProps) {
  if (isLoading) {
    return (
      <Card className="border-virgilio-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-poppins font-semibold text-virgilio-text" withPeriod={false}>
            Status Distribution
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

  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <Card className="border-virgilio-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-poppins font-semibold text-virgilio-text" withPeriod={false}>
          Status Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-virgilio-muted font-poppins">
              No data available
            </div>
          ) : (
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
                  {data.map((entry, index) => (
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
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontFamily: 'Poppins, sans-serif', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
