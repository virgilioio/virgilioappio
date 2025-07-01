import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MetricCard } from '@/components/invoices/MetricCard';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
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
interface SalaryBand {
  min: number;
  max: number;
  label: string;
  count: number;
}

export function SalaryInsightsCard({
  candidates,
  jobCurrency = 'USD',
  className
}: SalaryInsightsCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Move utility functions above useMemo to fix temporal dead zone error
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
      return `${jobCurrency}${(value / 1000).toFixed(0)}k`;
    }
    return formatCurrency(value);
  };

  // Custom tooltip component
  const CustomTooltip = ({
    active,
    payload,
    label
  }: any) => {
    if (active && payload && payload.length) {
      const count = payload[0].value;
      return <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-primary">
            {count} candidate{count !== 1 ? 's' : ''}
          </p>
        </div>;
    }
    return null;
  };

  const salaryData = useMemo(() => {
    // Filter candidates with salary data
    const candidatesWithSalary = candidates.filter(candidate => candidate.salary_amount && candidate.salary_amount > 0);
    if (candidatesWithSalary.length === 0) {
      return null;
    }

    // Normalize all salaries to annual amounts
    const annualSalaries = candidatesWithSalary.map(candidate => {
      let annualAmount = candidate.salary_amount!;

      // Convert to annual based on period
      switch (candidate.salary_period) {
        case 'hourly':
          annualAmount = annualAmount * 40 * 52; // 40 hours/week * 52 weeks/year
          break;
        case 'monthly':
          annualAmount = annualAmount * 12;
          break;
        case 'annually':
        default:
          // Already annual
          break;
      }
      return annualAmount;
    });

    // Calculate basic stats for reference
    const minSalary = Math.min(...annualSalaries);
    const maxSalary = Math.max(...annualSalaries);
    const avgSalary = annualSalaries.reduce((sum, salary) => sum + salary, 0) / annualSalaries.length;

    // Create salary bands
    const salaryRange = maxSalary - minSalary;
    let bandSize: number;

    // Determine appropriate band size based on salary range
    if (salaryRange <= 50000) {
      bandSize = 10000; // $10k bands for smaller ranges
    } else if (salaryRange <= 150000) {
      bandSize = 20000; // $20k bands for medium ranges
    } else {
      bandSize = 25000; // $25k bands for larger ranges
    }

    // If all candidates have the same salary, create a single band
    if (salaryRange === 0) {
      const salary = minSalary;
      return {
        chartData: [{
          name: formatCurrency(salary),
          count: candidatesWithSalary.length
        }],
        bands: [{
          min: salary,
          max: salary,
          label: formatCurrency(salary),
          count: candidatesWithSalary.length
        }],
        count: candidatesWithSalary.length,
        minSalary: Math.round(minSalary),
        maxSalary: Math.round(maxSalary),
        avgSalary: Math.round(avgSalary)
      };
    }

    // Create salary bands
    const bands: SalaryBand[] = [];
    const startSalary = Math.floor(minSalary / bandSize) * bandSize;
    const endSalary = Math.ceil(maxSalary / bandSize) * bandSize;
    for (let salary = startSalary; salary < endSalary; salary += bandSize) {
      const bandMin = salary;
      const bandMax = salary + bandSize;

      // Count candidates in this band
      const candidatesInBand = annualSalaries.filter(candidateSalary => candidateSalary >= bandMin && candidateSalary < bandMax).length;

      // Only include bands with candidates (except for the last band which should include the max)
      if (candidatesInBand > 0 || salary + bandSize >= maxSalary) {
        // For the last band, include candidates at exactly the max salary
        const actualCount = salary + bandSize >= maxSalary ? annualSalaries.filter(candidateSalary => candidateSalary >= bandMin && candidateSalary <= bandMax).length : candidatesInBand;
        if (actualCount > 0) {
          bands.push({
            min: bandMin,
            max: bandMax,
            label: `${formatCurrencyShort(bandMin)}-${formatCurrencyShort(bandMax)}`,
            count: actualCount
          });
        }
      }
    }

    // Format data for chart
    const chartData = bands.map(band => ({
      name: band.label,
      count: band.count
    }));
    return {
      chartData,
      bands,
      count: candidatesWithSalary.length,
      minSalary: Math.round(minSalary),
      maxSalary: Math.round(maxSalary),
      avgSalary: Math.round(avgSalary)
    };
  }, [candidates]);

  if (!salaryData) {
    return <MetricCard title="Salary Insights (Annual)" value="No salary data available" icon={<TrendingUp />} tooltip="Add candidate salary expectations to see annual insights" />;
  }

  return <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`bg-white border border-border rounded-lg p-6 ${className}`}>
        <CollapsibleTrigger className="flex items-center justify-between w-full mb-4 hover:opacity-80 transition-opacity cursor-pointer">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Salary Insights (Annual)</h3>
            </div>
            <p className="text-xs text-muted-foreground ml-7">All salaries normalized to annual amounts</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">
              {salaryData.count} candidate{salaryData.count !== 1 ? 's' : ''} with salary data
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-2">
          <div className="h-60 w-full overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={salaryData.chartData} 
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 30
                }} 
                barCategoryGap="20%"
                onMouseMove={(data) => {
                  if (data && data.activeTooltipIndex !== undefined) {
                    setHoveredIndex(data.activeTooltipIndex);
                  }
                }}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{
                fontSize: 11,
                fill: 'hsl(var(--muted-foreground))'
              }} tickLine={false} axisLine={false} height={40} />
                <YAxis tick={{
                fontSize: 12,
                fill: 'hsl(var(--muted-foreground))'
              }} tickLine={false} axisLine={false} allowDecimals={false} label={{
                value: 'Candidates',
                angle: -90,
                position: 'insideLeft'
              }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {salaryData.chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={hoveredIndex === index ? "#d7c5fb" : "#7e3eff"} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-lg font-bold text-foreground">{formatCurrency(salaryData.minSalary)}</div>
              <div className="text-xs text-muted-foreground">Minimum (Annual)</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-foreground">{formatCurrency(salaryData.avgSalary)}</div>
              <div className="text-xs text-muted-foreground">Average (Annual)</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-foreground">{formatCurrency(salaryData.maxSalary)}</div>
              <div className="text-xs text-muted-foreground">Maximum (Annual)</div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>;
}
