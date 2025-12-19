import { useState } from 'react'
import { Briefcase, Search, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useJobsForCandidateAssignment } from '@/hooks/useJobsForCandidateAssignment'

interface LinkToJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (jobId: string) => void
  currentJobId?: string | null
}

export function LinkToJobDialog({
  open,
  onOpenChange,
  onConfirm,
  currentJobId
}: LinkToJobDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(currentJobId || null)
  const { jobs, isLoading } = useJobsForCandidateAssignment()

  const filteredJobs = jobs.filter(job =>
    job.display_label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleConfirm = () => {
    if (selectedJobId) {
      onConfirm(selectedJobId)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Link to Job
          </DialogTitle>
          <DialogDescription>
            Select a job to link to this sourcing project. This enables one-click candidate collection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <Briefcase className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">
                  {searchQuery ? 'No matching jobs found' : 'No open jobs available'}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedJobId === job.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium">{job.title}</div>
                    <div className={`text-xs ${
                      selectedJobId === job.id 
                        ? 'text-primary-foreground/70' 
                        : 'text-muted-foreground'
                    }`}>
                      {job.organization_name}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedJobId}>
            Link Job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
