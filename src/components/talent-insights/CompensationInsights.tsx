import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Switch } from '@/components/ui/switch'
import { TalentInsightEmptyState } from './TalentInsightEmptyState'
import type { SalaryStats } from '@/hooks/useTalentInsightsData'

interface CompensationInsightsProps {
  salaryStats: SalaryStats | null
  salaryValues: number[]
}

function generateHistogram(salaries: number[], numBins = 12) {
  const min = Math.min(...salaries)
  const max = Math.max(...salaries)
  const range = max - min || 1
  const binWidth = range / numBins

  const bins: { salary: number; count: number }[] = []
  for (let i = 0; i < numBins; i++) {
    const binStart = min + i * binWidth
    const binCenter = binStart + binWidth / 2
    const count = salaries.filter(s => s >= binStart && (i === numBins - 1 ? s <= binStart + binWidth : s < binStart + binWidth)).length
    bins.push({ salary: Math.round(binCenter), count })
  }
  return bins
}

function generateKDE(salaries: number[], points = 60) {
  const min = Math.min(...salaries)
  const max = Math.max(...salaries)
  const range = max - min || 1
  const bandwidth = range * 0.15 || 1
  const padding = range * 0.2
  const start = min - padding
  const end = max + padding
  const step = (end - start) / (points - 1)

  const data: { salary: number; density: number }[] = []
  for (let i = 0; i < points; i++) {
    const x = start + i * step
    let density = 0
    for (const s of salaries) {
      const z = (x - s) / bandwidth
      density += Math.exp(-0.5 * z * z)
    }
    density /= salaries.length * bandwidth * Math.sqrt(2 * Math.PI)
    data.push({ salary: Math.round(x), density })
  }
  return data
}

function mergeChartData(histogram: { salary: number; count: number }[], kde: { salary: number; density: number }[]) {
  const maxCount = Math.max(...histogram.map(h => h.count), 1)
  const maxDensity = Math.max(...kde.map(k => k.density), 0.0001)
  const scale = maxCount / maxDensity

  const merged: { salary: number; count?: number; density?: number }[] = []
  for (const bin of histogram) {
    merged.push({ salary: bin.salary, count: bin.count })
  }
  for (const point of kde) {
    merged.push({ salary: point.salary, density: point.density * scale })
  }
  merged.sort((a, b) => a.salary - b.salary)
  return merged
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCurrencyShort(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return formatCurrency(value)
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const salary = payload[0].payload.salary
    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-foreground">{formatCurrency(salary)}</p>
        <p className="text-xs text-muted-foreground">Salary estimate</p>
      </div>
    )
  }
  return null
}

export function CompensationInsights({ salaryStats, salaryValues }: CompensationInsightsProps) {
  const [showMonthly, setShowMonthly] = useState(false)

  const chartData = useMemo(() => {
    if (!salaryValues || salaryValues.length < 3) return null

    const displaySalaries = showMonthly
      ? salaryValues.map(s => s / 12)
      : salaryValues

    const minSalary = Math.min(...displaySalaries)
    const maxSalary = Math.max(...displaySalaries)
    const avgSalary = displaySalaries.reduce((sum, s) => sum + s, 0) / displaySalaries.length

    const histogramData = generateHistogram(displaySalaries)
    const kdeData = generateKDE(displaySalaries)
    const merged = mergeChartData(histogramData, kdeData)

    return {
      chartData: merged,
      count: salaryValues.length,
      minSalary: Math.round(minSalary),
      maxSalary: Math.round(maxSalary),
      avgSalary: Math.round(avgSalary),
    }
  }, [salaryValues, showMonthly])

  if (!chartData) {
    return (
      <Card className="border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
            Compensation Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TalentInsightEmptyState message="No salary data available yet" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-virgilio-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
            Compensation Insights
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${!showMonthly ? 'text-virgilio-text font-medium' : 'text-virgilio-muted'}`}>
              Annual
            </span>
            <Switch
              checked={showMonthly}
              onCheckedChange={setShowMonthly}
              aria-label="Toggle between annual and monthly view"
            />
            <span className={`text-xs ${showMonthly ? 'text-virgilio-text font-medium' : 'text-virgilio-muted'}`}>
              Monthly
            </span>
          </div>
        </div>
        <p className="text-xs text-virgilio-muted">
          {chartData.count} candidate{chartData.count !== 1 ? 's' : ''} with salary data
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData.chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
            >
              <defs>
                <linearGradient id="compensationGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(267 100% 62%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(267 100% 62%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="salary"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrencyShort(v)}
                tickCount={5}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                x={chartData.minSalary}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: 'Low', position: 'top', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <ReferenceLine
                x={chartData.avgSalary}
                stroke="hsl(267 100% 62%)"
                strokeWidth={2}
                label={{ value: 'Average', position: 'top', fill: 'hsl(267 100% 62%)', fontSize: 12, fontWeight: 600 }}
              />
              <ReferenceLine
                x={chartData.maxSalary}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: 'High', position: 'top', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <Bar
                dataKey="count"
                fill="hsl(267 100% 62% / 0.15)"
                stroke="hsl(267 100% 62% / 0.4)"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
              <Area
                type="monotone"
                dataKey="density"
                stroke="hsl(267 100% 62%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#compensationGradient)"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center mt-4">
          <div className="space-y-1">
            <div className="text-lg font-bold text-virgilio-text">{formatCurrency(chartData.minSalary)}</div>
            <div className="text-xs text-virgilio-muted">Low ({showMonthly ? 'Monthly' : 'Annual'})</div>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-virgilio-purple">{formatCurrency(chartData.avgSalary)}</div>
            <div className="text-xs text-virgilio-muted">Average ({showMonthly ? 'Monthly' : 'Annual'})</div>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-virgilio-text">{formatCurrency(chartData.maxSalary)}</div>
            <div className="text-xs text-virgilio-muted">High ({showMonthly ? 'Monthly' : 'Annual'})</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
