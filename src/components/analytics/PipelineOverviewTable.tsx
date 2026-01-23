import { usePipelineOverviewData } from '@/hooks/usePipelineOverviewData'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { GitBranch, HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface PipelineOverviewTableProps {
  jobIds: string[]
  isLoading?: boolean
}

export function PipelineOverviewTable({ jobIds, isLoading: externalLoading }: PipelineOverviewTableProps) {
  const navigate = useNavigate()
  const { stageColumns, rows, totals, isLoading: dataLoading } = usePipelineOverviewData(jobIds)
  
  const isLoading = externalLoading || dataLoading

  const handleJobClick = (jobId: string) => {
    navigate(`/jobs/${jobId}/pipeline`)
  }

  // Empty state
  if (!isLoading && rows.length === 0) {
    return (
      <Card className="border-virgilio-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-virgilio-purple" />
              <CardTitle className="text-lg font-poppins font-semibold">Pipeline Overview</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GitBranch className="h-12 w-12 text-virgilio-muted/40 mb-3" />
            <p className="text-virgilio-muted font-poppins">No jobs match your current filters</p>
            <p className="text-sm text-virgilio-muted/70 mt-1">Adjust your filters to see pipeline data</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-virgilio-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-virgilio-purple" />
            <CardTitle className="text-lg font-poppins font-semibold">Pipeline Overview</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-virgilio-muted" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p>Shows candidate counts across all pipeline stages for each job. Click a job to view its detailed pipeline.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {!isLoading && (
            <Badge variant="secondary" className="font-poppins">
              {rows.length} {rows.length === 1 ? 'job' : 'jobs'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-20 bg-background min-w-[200px] font-poppins font-semibold">
                  Job Title
                </TableHead>
                <TableHead className="text-center min-w-[80px] font-poppins font-medium">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">Review</TooltipTrigger>
                      <TooltipContent>Candidates awaiting initial review (no stage assigned)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                {isLoading ? (
                  // Show placeholder columns while loading
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableHead key={i} className="text-center min-w-[80px]">
                      <Skeleton className="h-4 w-16 mx-auto" />
                    </TableHead>
                  ))
                ) : (
                  stageColumns.map(col => (
                    <TableHead key={col.stageName} className="text-center min-w-[80px] font-poppins font-medium">
                      <span className="truncate block max-w-[100px]" title={col.stageName}>
                        {col.stageName}
                      </span>
                    </TableHead>
                  ))
                )}
                <TableHead className="text-center min-w-[70px] font-poppins font-medium text-warning">
                  Offer
                </TableHead>
                <TableHead className="text-center min-w-[70px] font-poppins font-medium text-success">
                  Hired
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Loading skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="sticky left-0 bg-background">
                      <Skeleton className="h-5 w-40" />
                    </TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j} className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    ))}
                    <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : (
                <>
                  {rows.map(row => (
                    <TableRow 
                      key={row.jobId} 
                      className="cursor-pointer hover:bg-virgilio-purple/5 transition-colors"
                      onClick={() => handleJobClick(row.jobId)}
                    >
                      <TableCell className="sticky left-0 bg-background font-poppins font-medium">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[180px]" title={row.jobTitle}>
                            {row.jobTitle}
                          </span>
                          {row.jobStatus !== 'open' && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              {row.jobStatus}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <CellValue value={row.applicationReview} />
                      </TableCell>
                      {stageColumns.map(col => (
                        <TableCell key={col.stageName} className="text-center">
                          <CellValue 
                            value={row.stageCounts[col.stageName]} 
                            hasStage={col.stageName in row.stageCounts || row.stageCounts[col.stageName] !== undefined}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <CellValue value={row.offer} highlight="amber" />
                      </TableCell>
                      <TableCell className="text-center">
                        <CellValue value={row.hired} highlight="green" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
                    <TableCell className="sticky left-0 bg-muted/50 font-poppins font-semibold">
                      Totals
                    </TableCell>
                    <TableCell className="text-center font-poppins font-semibold">
                      {totals.applicationReview}
                    </TableCell>
                    {stageColumns.map(col => (
                      <TableCell key={col.stageName} className="text-center font-poppins font-semibold">
                        {totals.stageCounts[col.stageName] || 0}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-poppins font-semibold text-warning">
                      {totals.offer}
                    </TableCell>
                    <TableCell className="text-center font-poppins font-semibold text-success">
                      {totals.hired}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

interface CellValueProps {
  value: number | undefined
  hasStage?: boolean
  highlight?: 'amber' | 'green'
}

function CellValue({ value, hasStage = true, highlight }: CellValueProps) {
  // If the job doesn't have this stage in its pipeline, show dash
  if (!hasStage && value === undefined) {
    return <span className="text-virgilio-muted/50">–</span>
  }
  
  const displayValue = value || 0
  
  if (displayValue === 0) {
    return <span className="text-virgilio-muted/70">0</span>
  }

  return (
    <span className={cn(
      "font-medium",
      highlight === 'amber' && "text-warning",
      highlight === 'green' && "text-success",
      !highlight && displayValue > 0 && "text-foreground"
    )}>
      {displayValue}
    </span>
  )
}
