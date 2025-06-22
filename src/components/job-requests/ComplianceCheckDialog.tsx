
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useOrganizationProgress } from '@/hooks/useOrganizationProgress'

interface ComplianceCheckDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  progress: number
}

export function ComplianceCheckDialog({ open, onOpenChange, progress }: ComplianceCheckDialogProps) {
  const organizationProgress = useOrganizationProgress()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Compliance Information Required
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            In order to be compliant and request Virgilio's services, you must complete your organization's compliance information.
          </p>
          
          <div className="bg-muted/30 p-3 rounded-lg">
            <p className="text-sm">
              <span className="font-medium">Current Progress:</span> {progress}%
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Please complete all required fields to reach 100% compliance.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Pending Items:</h4>
            <div className="space-y-2">
              {organizationProgress.items
                .filter(item => item.required && !item.completed)
                .map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span className="text-red-700">{item.label}</span>
                  </div>
                ))}
            </div>
            
            {organizationProgress.items.some(item => item.required && item.completed) && (
              <>
                <h4 className="text-sm font-medium text-green-700 mt-4">Completed Items:</h4>
                <div className="space-y-1">
                  {organizationProgress.items
                    .filter(item => item.required && item.completed)
                    .map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-green-700">{item.label}</span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
          
          <div className="flex gap-2 pt-2">
            <Link to="/settings?tab=organization" className="flex-1">
              <Button className="w-full">
                Complete Compliance Info
              </Button>
            </Link>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
