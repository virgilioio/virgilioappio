import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { JobAssignmentsPanel } from './JobAssignmentsPanel'

interface HiringTeamManageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  jobTitle: string
}

export function HiringTeamManageDialog({ open, onOpenChange, jobId, jobTitle }: HiringTeamManageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-h4 font-poppins">
            Manage hiring team
          </DialogTitle>
          <p className="text-body-sm text-text-secondary mt-1 truncate">{jobTitle}</p>
        </DialogHeader>
        <div className="px-6 pb-2 max-h-[70vh] overflow-y-auto">
          <JobAssignmentsPanel jobId={jobId} jobTitle={jobTitle} />
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default HiringTeamManageDialog
