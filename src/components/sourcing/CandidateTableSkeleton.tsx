import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface CandidateTableSkeletonProps {
  rows?: number
}

export function CandidateTableSkeleton({ rows = 8 }: CandidateTableSkeletonProps) {
  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Desktop Table View */}
      <Card className="shadow-calendly hidden md:block flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Name</TableHead>
                  <TableHead className="w-[280px]">Current Role</TableHead>
                  <TableHead>Headline / Skills</TableHead>
                  <TableHead className="text-right w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: rows }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    {/* Name cell with avatar */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex flex-col gap-1.5">
                          <Skeleton className="h-4 w-32" />
                          <div className="flex items-center gap-1.5">
                            <Skeleton className="h-3 w-3 rounded-full" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    
                    {/* Current Role cell */}
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </TableCell>
                    
                    {/* Skills cell */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-5 w-14 rounded-full" />
                      </div>
                    </TableCell>
                    
                    {/* Actions cell */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-24" />
                  <div className="flex gap-1 pt-1">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-18 rounded-full" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
