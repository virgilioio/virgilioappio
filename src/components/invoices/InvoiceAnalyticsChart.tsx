import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    { value: '1week', label: '1W' },
    { value: '1month', label: '1M' },
    { value: '3months', label: '3M' },
    { value: '6months', label: '6M' },
    { value: '1year', label: '1Y' },
    { value: 'all', label: 'All' },
  ]

  const { chartData, totalInvoiced } = useMemo(() => {
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

    // Calculate total amount of all invoices issued in the selected period
    const totalAmount = filteredInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)

    // Determine grouping strategy based on period
    const shouldGroupByMonth = ['3months', '6months', '1year', 'all'].includes(selectedPeriod)
    
    // Group invoices by period
    const periodGroups: { [key: string]: { amount: number; date: Date; displayDate: string } } = {}
    
    filteredInvoices.forEach(invoice => {
      const invoiceDate = new Date(invoice.issued_at)
      let periodKey: string
      let displayDate: string
      
      if (shouldGroupByMonth) {
        // Group by month for longer periods
        periodKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`
        displayDate = invoiceDate.toLocaleDateString('en-US', { 
          month: 'short', 
          year: selectedPeriod === '1year' || selectedPeriod === 'all' ? 'numeric' : undefined
        })
      } else {
        // Group by day for shorter periods
        periodKey = invoiceDate.toISOString().split('T')[0]
        displayDate = invoiceDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        })
      }
      
      if (!periodGroups[periodKey]) {
        periodGroups[periodKey] = {
          amount: 0,
          date: invoiceDate,
          displayDate
        }
      }
      
      periodGroups[periodKey].amount += invoice.amount
    })

    // Convert to chart data sorted by date
    const data = Object.entries(periodGroups)
      .map(([periodKey, { amount, date, displayDate }]) => ({
        periodKey,
        amount,
        date: date.toISOString().split('T')[0],
        displayDate,
        fullDate: date.toLocaleDateString('en-US', { 
          weekday: 'short',
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        })
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // If no data, show at least one point at zero
    if (data.length === 0) {
      return {
        chartData: [{
          periodKey: now.toISOString().split('T')[0],
          amount: 0,
          date: now.toISOString().split('T')[0],
          displayDate: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: now.toLocaleDateString('en-US', { 
            weekday: 'short',
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          })
        }],
        totalInvoiced: 0
      }
    }

    return {
      chartData: data,
      totalInvoiced: totalAmount
    }
  }, [invoices, selectedPeriod])

  const currency = invoices[0]?.currency || 'USD'

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-black px-3 py-2 rounded-lg shadow-lg">
          <p className="text-sm text-white mb-1">
            {formatCurrency(payload[0].value)}
          </p>
          <p className="text-xs text-gray-300">
            {data.fullDate}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="h-full" style={{ backgroundColor: '#c5f5fb' }}>
      <CardHeader className="pb-2">
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="text-3xl font-bold text-black">
              {formatCurrency(totalInvoiced)}
            </div>
          </div>
          
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Total Invoiced
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="h-[160px] w-full mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 20,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#e2e8f0" 
                opacity={0.5}
              />
              <XAxis 
                dataKey="displayDate"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#007c91"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#007c91",
                  stroke: "#ffffff",
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Time Period Filter - Moved to bottom */}
        <div className="flex justify-center">
          <div className="flex gap-4">
            {timePeriodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedPeriod(option.value)}
                className={`text-xs px-1 py-0.5 cursor-pointer transition-colors ${
                  selectedPeriod === option.value 
                    ? 'text-cyan-700 font-medium' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
