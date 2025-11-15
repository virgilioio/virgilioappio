import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Briefcase, Building2, Loader2 } from 'lucide-react'
import { useJobsForCandidateAssignment, type JobOption } from '@/hooks/useJobsForCandidateAssignment'

interface JobSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onJobSelected: (jobId: string) => void
  onSkip: () => void
}

export function JobSelectionDialog({
  open,
  onOpenChange,
  onJobSelected,
  onSkip,
}: JobSelectionDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const { jobs, isLoading } = useJobsForCandidateAssignment()

  const filteredJobs = jobs.filter(job =>
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.organization_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Job for Candidate</DialogTitle>
          <DialogDescription>
            Choose which job you want to add this candidate to, or skip to collect without adding to a job.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input
            placeholder="Search jobs by title or organization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              {searchQuery ? 'No jobs found matching your search' : 'No jobs available'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredJobs.map((job) => (
                <Card
                  key={job.id}
                  className="cursor-pointer hover:bg-surface-secondary transition-colors"
                  onClick={() => onJobSelected(job.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-text-primary truncate">
                          {job.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Building2 className="h-3 w-3 text-text-tertiary flex-shrink-0" />
                          <span className="text-sm text-text-secondary truncate">
                            {job.organization_name}
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary">Open</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onSkip}
            className="flex-1"
          >
            Skip - Collect Without Job
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
