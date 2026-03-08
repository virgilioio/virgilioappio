import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { AnalyticsTableCard } from '@/components/analytics/shared/AnalyticsTableCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortableHeader } from '@/components/ui/sortable-header'
import { Activity } from 'lucide-react'
import { useSortableTable } from '@/hooks/useSortableTable'
import type { RecruiterPerformanceData, RecruiterRow } from '@/hooks/analytics/useRecruiterPerformanceMetrics'

interface RecruiterPerformanceSectionProps {
  data: RecruiterPerformanceData
}

export function RecruiterPerformanceSection({ data }: RecruiterPerformanceSectionProps) {
  const { sortedData, sortConfig: sort, requestSort: handleSort } = useSortableTable<RecruiterRow>(data.rows, { key: 'candidatesAdded', direction: 'desc' })

  return (
    <AnalyticsSection
      title="Recruiter Workload"
      subtitle="Operational visibility into team member activity — not a performance scorecard"
      icon={Activity}
    >
      <AnalyticsTableCard
        title="Team Activity"
        icon={Activity}
        isEmpty={data.rows.length === 0}
        isLoading={data.isLoading}
        emptyMessage="No recruiter activity found"
        emptyDescription="No candidates have been added by identifiable team members in this period"
        maxHeight="max-h-[400px]"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">
                <SortableHeader sortKey="name" currentSort={sort} onSort={handleSort}>Team Member</SortableHeader>
              </TableHead>
              <TableHead className="text-center">
                <SortableHeader sortKey="candidatesAdded" currentSort={sort} onSort={handleSort} className="justify-center">Added</SortableHeader>
              </TableHead>
              <TableHead className="text-center">
                <SortableHeader sortKey="activePipeline" currentSort={sort} onSort={handleSort} className="justify-center">Active</SortableHeader>
              </TableHead>
              <TableHead className="text-center">
                <SortableHeader sortKey="interviewsBooked" currentSort={sort} onSort={handleSort} className="justify-center">Interviews</SortableHeader>
              </TableHead>
              <TableHead className="text-center">
                <SortableHeader sortKey="hires" currentSort={sort} onSort={handleSort} className="justify-center">Hires</SortableHeader>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map(row => (
              <TableRow key={row.userId}>
                <TableCell className="font-poppins font-medium">
                  <div>
                    <p className="text-sm">{row.name}</p>
                    {row.email && <p className="text-xs text-muted-foreground">{row.email}</p>}
                  </div>
                </TableCell>
                <TableCell className="text-center font-poppins">{row.candidatesAdded}</TableCell>
                <TableCell className="text-center font-poppins">{row.activePipeline}</TableCell>
                <TableCell className="text-center font-poppins">{row.interviewsBooked}</TableCell>
                <TableCell className="text-center font-poppins text-success">{row.hires || '–'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AnalyticsTableCard>
    </AnalyticsSection>
  )
}
