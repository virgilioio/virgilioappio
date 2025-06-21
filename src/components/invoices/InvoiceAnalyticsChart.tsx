
import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'
import { Invoice } from '@/hooks/useInvoices'
import { TrendingUp, Calendar } from 'lucide-react'

interface InvoiceAnalyticsChartProps {
  invoices: Invoice[]
}

type TimePeriod = '1week' | '1month' | '3months' | '6months' | '1year' | 'all'

export function InvoiceAnalyticsChart({ invoices }: InvoiceAnalyticsChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('6months')

  const timePeriodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1week', label: '1 Week' },
    { value: '1month', label: '1 Month' },
    { value: '3months', label: '3 Months' },
    { value: '6months', label: '6 Months' },
    { value: '1year', label: '1 Year' },
    { value: 'all', label: 'All Time' },
  ]

  const chartData = useMemo(() => {
    const now = new Date()
    let startDate = new Date()

    // Calculate start date based on selected period
    switch (selectedPeriod) {
      case '1week':
        startDate.setDate(now.getDate() - 7)
        break
      case '1month':
        startDate.setMonth(now.getMonth() - 1)
        break
      case '3months':
        startDate.setMonth(now.getMonth() - 3)
        break
      case '6months':
        startDate.setMonth(now.getMonth() - 6)
        break
      case '1year':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      case 'all':
        startDate = new Date('2020-01-01') // Far back date for all time
        break
    }

    // Filter invoices by date range
    const filteredInvoices = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.issued_at)
      return invoiceDate >= startDate && invoiceDate <= now
    })

    // Group invoices by date and calculate cumulative total
    const dateGroups: { [key: string]: number } = {}
    
    filteredInvoices
      .sort((a, b) => new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime())
      .forEach(invoice => {
        const date = new Date(invoice.issued_at).toISOString().split('T')[0]
        dateGroups[date] = (dateGroups[date] || 0) + invoice.amount
      })

    // Convert to chart data with cumulative totals
    let cumulativeTotal = 0
    const data = Object.entries(dateGroups).map(([date, amount]) => {
      cumulativeTotal += amount
      return {
        date,
        total: cumulativeTotal,
        amount,
        formattedDate: new Date(date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          ...(selectedPeriod === '1year' || selectedPeriod === 'all' ? { year: 'numeric' } : {})
        })
      }
    })

    // If no data, show at least one point at zero
    if (data.length === 0) {
      return [{
        date: now.toISOString().split('T')[0],
        total: 0,
        amount: 0,
        formattedDate: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }]
    }

    return data
  }, [invoices, selectedPeriod])

  const totalInvoiced = chartData[chartData.length - 1]?.total || 0
  const currency = invoices[0]?.currency || 'USD'

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm" style={{ color: '#0891b2' }}>
            Total: {formatCurrency(payload[0].value)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="col-span-5">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <TrendingUp className="h-5 w-5" />
              Invoice Analytics
            </CardTitle>
            <div className="text-2xl font-bold" style={{ color: '#0891b2' }}>
              {formatCurrency(totalInvoiced)}
            </div>
            <p className="text-sm text-muted-foreground">
              Total invoiced in selected period
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground mr-2">Period:</span>
            {timePeriodOptions.map((option) => (
              <Button
                key={option.value}
                variant={selectedPeriod === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod(option.value)}
                className={selectedPeriod === option.value ? 'bg-cyan-100 text-cyan-900 border-cyan-200' : ''}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 10,
                right: 30,
                left: 20,
                bottom: 10,
              }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#e2e8f0" 
                opacity={0.5}
              />
              <XAxis
                dataKey="formattedDate"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#0891b2"
                strokeWidth={3}
                dot={{
                  fill: "#0891b2",
                  strokeWidth: 2,
                  r: 4,
                }}
                activeDot={{
                  r: 6,
                  fill: "#0891b2",
                  stroke: "#ffffff",
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
