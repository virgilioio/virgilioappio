import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface StageData {
  name: string
  count: number
}

interface StageDistributionChartProps {
  data: StageData[]
  isLoading?: boolean
}

export function StageDistributionChart({ data, isLoading }: StageDistributionChartProps) {
  if (isLoading) {
    return (
      <Card className="border-virgilio-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-poppins font-semibold text-virgilio-text" withPeriod={false}>
            Candidates by Stage
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
          Candidates by Stage
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
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--virgilio-border))" />
                <XAxis 
                  type="number"
                  tick={{ fontSize: 11, fill: 'hsl(var(--virgilio-muted))' }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--virgilio-border))' }}
                />
                <YAxis 
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11, fill: 'hsl(var(--virgilio-muted))' }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--virgilio-border))' }}
                  width={75}
                />
                <Tooltip
                  formatter={(value: number) => [value, 'Candidates']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--virgilio-border))',
                    borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: '12px'
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="hsl(267 89% 60%)"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
