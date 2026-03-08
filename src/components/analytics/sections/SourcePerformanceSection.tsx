import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { AnalyticsTableCard } from '@/components/analytics/shared/AnalyticsTableCard'
import { SourceBarChart } from '@/components/analytics/charts/SourceBarChart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Globe } from 'lucide-react'
import type { SourcePerformanceData } from '@/hooks/analytics/useSourcePerformanceMetrics'

interface SourcePerformanceSectionProps {
  data: SourcePerformanceData
}

export function SourcePerformanceSection({ data }: SourcePerformanceSectionProps) {
  return (
    <AnalyticsSection
      title="Source Performance"
      subtitle="Where your candidates come from and which channels produce outcomes"
      icon={Globe}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SourceBarChart data={data.rows} isLoading={data.isLoading} />

        <AnalyticsTableCard
          title="Source Breakdown"
          icon={Globe}
          isEmpty={data.rows.length === 0}
          isLoading={data.isLoading}
          maxHeight="max-h-[300px]"
          subtitle="Conversion = Hires / Total candidates from source"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-center">Hires</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map(row => (
                <TableRow key={row.source}>
                  <TableCell className="font-poppins font-medium text-sm">{row.source}</TableCell>
                  <TableCell className="text-center font-poppins">{row.total}</TableCell>
                  <TableCell className="text-center font-poppins">{row.active}</TableCell>
                  <TableCell className="text-center font-poppins text-success">{row.hires || '–'}</TableCell>
                  <TableCell className="text-right font-poppins font-medium">
                    {row.conversionRate > 0 ? `${row.conversionRate}%` : '–'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AnalyticsTableCard>
      </div>
    </AnalyticsSection>
  )
}
