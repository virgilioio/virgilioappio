
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { MetricCard } from '@/components/invoices/MetricCard'
import { ChartContainer, ChartTooltipContent, ChartTooltip } from '@/components/ui/chart'
import { TrendingUp } from 'lucide-react'

interface Candidate {
  id: string
  candidate_name: string
  salary_amount: number | null
  salary_currency: string | null
  salary_period: string | null
}

interface SalaryInsightsCardProps {
  candidates: Candidate[]
  jobCurrency?: string
  className?: string
}

export function SalaryInsightsCard({ candidates, jobCurrency = 'USD', className }: SalaryInsightsCardProps) {
  const salaryData = useMemo(() => {
    // Filter candidates with salary data
    const candidatesWithSalary = candidates.filter(
      candidate => candidate.salary_amount && candidate.salary_amount > 0
    )

    if (candidatesWithSalary.length === 0) {
      return null
    }

    // Normalize all salaries to annual amounts
    const annualSalaries = candidatesWithSalary.map(candidate => {
      let annualAmount = candidate.salary_amount!
      
      // Convert to annual based on period
      switch (candidate.salary_period) {
        case 'hourly':
          annualAmount = annualAmount * 40 * 52 // 40 hours/week * 52 weeks/year
          break
        case 'monthly':
          annualAmount = annualAmount * 12
          break
        case 'annually':
        default:
          // Already annual
          break
      }
      
      return annualAmount
    })

    // Calculate insights
    const minSalary = Math.min(...annualSalaries)
    const maxSalary = Math.max(...annualSalaries)
    const avgSalary = annualSalaries.reduce((sum, salary) => sum + salary, 0) / annualSalaries.length

    // Format data for chart with better structure
    const chartData = [
      {
        name: 'Minimum',
        salary: Math.round(minSalary),
      },
      {
        name: 'Average',
        salary: Math.round(avgSalary),
      },
      {
        name: 'Maximum',
        salary: Math.round(maxSalary),
      }
    ]

    return {
      chartData,
      count: candidatesWithSalary.length,
      minSalary: Math.round(minSalary),
      maxSalary: Math.round(maxSalary),
      avgSalary: Math.round(avgSalary)
    }
  }, [candidates])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: jobCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (!salaryData) {
    return (
      <MetricCard
        title="Salary Insights"
        value="No salary data available"
        icon={<TrendingUp />}
        tooltip="Add candidate salary expectations to see insights"
      />
    )
  }

  return (
    <div className={`bg-background border border-border rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">Salary Insights</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          {salaryData.count} candidate{salaryData.count !== 1 ? 's' : ''} with salary data
        </div>
      </div>

      <div className="h-64 w-full mb-6">
        <ChartContainer
          config={{
            salary: {
              label: "Annual Salary",
              color: "hsl(var(--primary))",
            },
          }}
        >
          <BarChart 
            data={salaryData.chartData} 
            margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
            barCategoryGap="30%"
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${jobCurrency} ${(value / 1000).toFixed(0)}k`}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              formatter={(value: number) => [formatCurrency(value), "Annual Salary"]}
            />
            <Bar 
              dataKey="salary" 
              fill="hsl(var(--primary))" 
              radius={[4, 4, 0, 0]}
              maxBarSize={80}
            />
          </BarChart>
        </ChartContainer>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="space-y-1">
          <div className="text-lg font-bold text-foreground">{formatCurrency(salaryData.minSalary)}</div>
          <div className="text-xs text-muted-foreground">Minimum</div>
        </div>
        <div className="space-y-1">
          <div className="text-lg font-bold text-foreground">{formatCurrency(salaryData.avgSalary)}</div>
          <div className="text-xs text-muted-foreground">Average</div>
        </div>
        <div className="space-y-1">
          <div className="text-lg font-bold text-foreground">{formatCurrency(salaryData.maxSalary)}</div>
          <div className="text-xs text-muted-foreground">Maximum</div>
        </div>
      </div>
    </div>
  )
}
