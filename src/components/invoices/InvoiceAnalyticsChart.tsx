import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { Invoice } from '@/hooks/useInvoices';
import { TrendingUp, Calendar } from 'lucide-react';
interface InvoiceAnalyticsChartProps {
  invoices: Invoice[];
}
type TimePeriod = '1week' | '1month' | '3months' | '6months' | '1year' | 'all';
export function InvoiceAnalyticsChart({
  invoices
}: InvoiceAnalyticsChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('6months');
  const timePeriodOptions: {
    value: TimePeriod;
    label: string;
  }[] = [{
    value: '1week',
    label: '1W'
  }, {
    value: '1month',
    label: '1M'
  }, {
    value: '3months',
    label: '3M'
  }, {
    value: '6months',
    label: '6M'
  }, {
    value: '1year',
    label: '1Y'
  }, {
    value: 'all',
    label: 'All'
  }];
  const chartData = useMemo(() => {
    const now = new Date();
    let startDate = new Date();

    // Calculate start date based on selected period
    switch (selectedPeriod) {
      case '1week':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '3months':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6months':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date('2020-01-01'); // Far back date for all time
        break;
    }

    // Filter invoices by date range
    const filteredInvoices = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.issued_at);
      return invoiceDate >= startDate && invoiceDate <= now;
    });

    // Group invoices by date and calculate cumulative total
    const dateGroups: {
      [key: string]: number;
    } = {};
    filteredInvoices.sort((a, b) => new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime()).forEach(invoice => {
      const date = new Date(invoice.issued_at).toISOString().split('T')[0];
      dateGroups[date] = (dateGroups[date] || 0) + invoice.amount;
    });

    // Convert to chart data with cumulative totals
    let cumulativeTotal = 0;
    const data = Object.entries(dateGroups).map(([date, amount]) => {
      cumulativeTotal += amount;
      return {
        date,
        total: cumulativeTotal,
        amount,
        formattedDate: new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          ...(selectedPeriod === '1year' || selectedPeriod === 'all' ? {
            year: 'numeric'
          } : {})
        })
      };
    });

    // If no data, show at least one point at zero
    if (data.length === 0) {
      return [{
        date: now.toISOString().split('T')[0],
        total: 0,
        amount: 0,
        formattedDate: now.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
      }];
    }
    return data;
  }, [invoices, selectedPeriod]);
  const totalInvoiced = chartData[chartData.length - 1]?.total || 0;
  const currency = invoices[0]?.currency || 'USD';
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };
  const CustomTooltip = ({
    active,
    payload,
    label
  }: any) => {
    if (active && payload && payload.length) {
      return <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm" style={{
          color: '#007c91'
        }}>
            Total: {formatCurrency(payload[0].value)}
          </p>
        </div>;
    }
    return null;
  };
  return <Card className="h-full" style={{
    backgroundColor: '#c5f5fb'
  }}>
      <CardHeader className="pb-2">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Total Invoiced
          </CardTitle>
          
          <div className="space-y-1">
            <div className="text-3xl font-bold text-black">
              {formatCurrency(totalInvoiced)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total invoiced in selected period
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        {/* Chart Title */}
        <div className="mb-2 text-left text-[#0d0d09]">
          <h3 className="text-sm font-medium text-muted-foreground">Total Invoiced</h3>
        </div>
        
        <div className="h-[160px] w-full mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{
            top: 5,
            right: 20,
            left: 20,
            bottom: 5
          }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
              <XAxis dataKey="formattedDate" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={value => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="total" stroke="#007c91" strokeWidth={2} dot={false} activeDot={{
              r: 4,
              fill: "#007c91",
              stroke: "#ffffff",
              strokeWidth: 2
            }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Time Period Filter - Moved to bottom */}
        <div className="flex justify-center">
          <div className="flex gap-4">
            {timePeriodOptions.map(option => <button key={option.value} onClick={() => setSelectedPeriod(option.value)} className={`text-xs px-1 py-0.5 cursor-pointer transition-colors ${selectedPeriod === option.value ? 'text-cyan-700 font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                {option.label}
              </button>)}
          </div>
        </div>
      </CardContent>
    </Card>;
}