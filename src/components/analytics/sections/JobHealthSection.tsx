import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { AnalyticsTableCard } from '@/components/analytics/shared/AnalyticsTableCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortableHeader } from '@/components/ui/sortable-header'
import { Badge } from '@/components/ui/badge'
import { Briefcase } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSortableTable } from '@/hooks/useSortableTable'
import { cn } from '@/lib/utils'
import type { JobHealthData, JobHealthRow } from '@/hooks/analytics/useJobHealthMetrics'

interface JobHealthSectionProps {
  data: JobHealthData
}

export function JobHealthSection({ data }: JobHealthSectionProps) {
  const navigate = useNavigate()
  const { sortedData, sort, handleSort } = useSortableTable<JobHealthRow>(data.rows, 'totalCandidates', 'desc')

  return (
    <AnalyticsSection
      title="Job Health"
      subtitle="Per-job operational breakdown"
      icon={Briefcase}
    >
      <AnalyticsTableCard
        title="Jobs Overview"
        icon={Briefcase}
        isEmpty={data.rows.length === 0}
        isLoading={data.isLoading}
        emptyMessage="No jobs match current filters"
        maxHeight="max-h-[500px]"
        footer={
          <p className="text-xs text-muted-foreground font-poppins">
            {data.rows.length} job{data.rows.length !== 1 ? 's' : ''} • Click a row to view pipeline
          </p>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">
                <SortableHeader sortKey="title" currentSort={sort} onSort={handleSort}>Job</SortableHeader>
              </TableHead>
              <TableHead className="text-center">
                <SortableHeader sortKey="totalCandidates" currentSort={sort} onSort={handleSort} className="justify-center">Total</SortableHeader>
              </TableHead>
              <TableHead className="text-center">
                <SortableHeader sortKey="activeCandidates" currentSort={sort} onSort={handleSort} className="justify-center">Active</SortableHeader>
              </TableHead>
              <TableHead className="text-center">
                <SortableHeader sortKey="interviews" currentSort={sort} onSort={handleSort} className="justify-center">Interviews</SortableHeader>
              </TableHead>
              <TableHead className="text-center">
                <SortableHeader sortKey="offers" currentSort={sort} onSort={handleSort} className="justify-center">Offers</SortableHeader>
              </TableHead>
              <TableHead className="text-center">
                <SortableHeader sortKey="hires" currentSort={sort} onSort={handleSort} className="justify-center">Hires</SortableHeader>
              </TableHead>
              <TableHead className="text-center">
                <SortableHeader sortKey="rejected" currentSort={sort} onSort={handleSort} className="justify-center">Rejected</SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader sortKey="avgTimeToHire" currentSort={sort} onSort={handleSort} className="justify-end">Avg TTH</SortableHeader>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map(row => (
              <TableRow
                key={row.jobId}
                interactive
                onClick={() => navigate(`/jobs/${row.jobId}/pipeline`)}
                className={cn(row.isWarning && 'bg-warning/5')}
              >
                <TableCell className="font-poppins font-medium">
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[180px]" title={row.title}>{row.title}</span>
                    {row.status !== 'open' && (
                      <Badge variant="outline" className="text-[10px] shrink-0">{row.status}</Badge>
                    )}
                    {row.isWarning && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">Empty pipeline</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center font-poppins">{row.totalCandidates}</TableCell>
                <TableCell className="text-center font-poppins">{row.activeCandidates}</TableCell>
                <TableCell className="text-center font-poppins">{row.interviews}</TableCell>
                <TableCell className="text-center font-poppins text-warning">{row.offers || '–'}</TableCell>
                <TableCell className="text-center font-poppins text-success">{row.hires || '–'}</TableCell>
                <TableCell className="text-center font-poppins text-destructive">{row.rejected || '–'}</TableCell>
                <TableCell className="text-right font-poppins">{row.avgTimeToHire !== null ? `${row.avgTimeToHire}d` : '–'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AnalyticsTableCard>
    </AnalyticsSection>
  )
}
