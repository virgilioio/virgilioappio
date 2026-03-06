
import { useMemo, useState } from 'react';
import { ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { MetricCard } from '@/components/ui/metric-card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

interface Candidate {
  id: string;
  candidate_name: string;
  salary_amount: number | null;
  salary_currency: string | null;
  salary_period: string | null;
}
interface SalaryInsightsCardProps {
  candidates: Candidate[];
  jobCurrency?: string;
  className?: string;
}

/** Generate histogram bins from salary data */
function generateHistogram(salaries: number[], numBins = 12) {
  const min = Math.min(...salaries);
  const max = Math.max(...salaries);
  const range = max - min || 1;
  const binWidth = range / numBins;
  
  const bins: { salary: number; count: number }[] = [];
  for (let i = 0; i < numBins; i++) {
    const binStart = min + i * binWidth;
    const binCenter = binStart + binWidth / 2;
    const count = salaries.filter(s => s >= binStart && (i === numBins - 1 ? s <= binStart + binWidth : s < binStart + binWidth)).length;
    bins.push({ salary: Math.round(binCenter), count });
  }
  return bins;
}

/** Generate a smooth KDE (Kernel Density Estimation) curve from actual salary data points */
function generateKDE(salaries: number[], points = 60) {
  const min = Math.min(...salaries);
  const max = Math.max(...salaries);
  const range = max - min || 1;
  const bandwidth = range * 0.15 || 1;
  const padding = range * 0.2;
  const start = min - padding;
  const end = max + padding;
  const step = (end - start) / (points - 1);

  const data: { salary: number; density: number }[] = [];
  for (let i = 0; i < points; i++) {
    const x = start + i * step;
    let density = 0;
    for (const s of salaries) {
      const z = (x - s) / bandwidth;
      density += Math.exp(-0.5 * z * z);
    }
    density /= salaries.length * bandwidth * Math.sqrt(2 * Math.PI);
    data.push({ salary: Math.round(x), density });
  }
  return data;
}

/** Merge histogram and KDE data into a single dataset for ComposedChart */
function mergeChartData(histogram: { salary: number; count: number }[], kde: { salary: number; density: number }[]) {
  // Normalize KDE density to match histogram count scale
  const maxCount = Math.max(...histogram.map(h => h.count), 1);
  const maxDensity = Math.max(...kde.map(k => k.density), 0.0001);
  const scale = maxCount / maxDensity;

  const merged: { salary: number; count?: number; density?: number }[] = [];
  
  // Add histogram points
  for (const bin of histogram) {
    merged.push({ salary: bin.salary, count: bin.count });
  }
  
  // Add KDE points with scaled density
  for (const point of kde) {
    merged.push({ salary: point.salary, density: point.density * scale });
  }
  
  // Sort by salary
  merged.sort((a, b) => a.salary - b.salary);
  return merged;
}

export function SalaryInsightsCard({
  candidates,
  jobCurrency = 'USD',
  className
}: SalaryInsightsCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showMonthly, setShowMonthly] = useState(true);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: jobCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    if (value >= 1000) {
      return `${jobCurrency} ${(value / 1000).toFixed(0)}k`;
    }
    return formatCurrency(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const salary = payload[0].payload.salary;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{formatCurrency(salary)}</p>
          <p className="text-xs text-muted-foreground">Salary estimate</p>
        </div>
      );
    }
    return null;
  };

  const salaryData = useMemo(() => {
    const candidatesWithSalary = candidates.filter(c => c.salary_amount && c.salary_amount > 0);
    if (candidatesWithSalary.length === 0) return null;

    // Normalize to annual
    const annualSalaries = candidatesWithSalary.map(c => {
      let annual = c.salary_amount!;
      switch (c.salary_period) {
        case 'hourly': annual = annual * 40 * 52; break;
        case 'monthly': annual = annual * 12; break;
        default: break;
      }
      return annual;
    });

    const displaySalaries = showMonthly
      ? annualSalaries.map(s => s / 12)
      : annualSalaries;

    const minSalary = Math.min(...displaySalaries);
    const maxSalary = Math.max(...displaySalaries);
    const avgSalary = displaySalaries.reduce((sum, s) => sum + s, 0) / displaySalaries.length;

    const histogramData = generateHistogram(displaySalaries);
    const kdeData = generateKDE(displaySalaries);
    const chartData = mergeChartData(histogramData, kdeData);

    return {
      chartData,
      histogramData,
      count: candidatesWithSalary.length,
      minSalary: Math.round(minSalary),
      maxSalary: Math.round(maxSalary),
      avgSalary: Math.round(avgSalary),
    };
  }, [candidates, showMonthly]);

  if (!salaryData) {
    return <MetricCard title="Salary Insights" value="No salary data available" icon={<TrendingUp />} tooltip="Add candidate salary expectations to see salary insights" />;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`bg-background border border-border rounded-lg p-6 ${className}`}>
        <CollapsibleTrigger className="flex items-center justify-between w-full mb-4 hover:opacity-80 transition-opacity cursor-pointer">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Salary Insights</h3>
            </div>
            <p className="text-xs text-muted-foreground ml-7">Candidate salary distribution</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">
              {salaryData.count} candidate{salaryData.count !== 1 ? 's' : ''} with salary data
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">View:</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${!showMonthly ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  Annual
                </span>
                <Switch
                  checked={showMonthly}
                  onCheckedChange={setShowMonthly}
                  aria-label="Toggle between annual and monthly view"
                />
                <span className={`text-sm ${showMonthly ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  Monthly
                </span>
              </div>
            </div>
          </div>

          <div className="h-60 w-full overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
               <ComposedChart
                data={salaryData.chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="salaryGradient" x1="0" y1="0" x2="0" y2="1">
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
                  x={salaryData.minSalary}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  label={{ value: 'Low', position: 'top', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
                <ReferenceLine
                  x={salaryData.avgSalary}
                  stroke="hsl(267 100% 62%)"
                  strokeWidth={2}
                  label={{ value: 'Average', position: 'top', fill: 'hsl(267 100% 62%)', fontSize: 12, fontWeight: 600 }}
                />
                <ReferenceLine
                  x={salaryData.maxSalary}
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
                  fill="url(#salaryGradient)"
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-lg font-bold text-foreground">{formatCurrency(salaryData.minSalary)}</div>
              <div className="text-xs text-muted-foreground">Low ({showMonthly ? 'Monthly' : 'Annual'})</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-accent-foreground">{formatCurrency(salaryData.avgSalary)}</div>
              <div className="text-xs text-muted-foreground">Average ({showMonthly ? 'Monthly' : 'Annual'})</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-foreground">{formatCurrency(salaryData.maxSalary)}</div>
              <div className="text-xs text-muted-foreground">High ({showMonthly ? 'Monthly' : 'Annual'})</div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
