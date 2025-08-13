import { Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ApplicationConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roleName: string
  organizationName: string
}

export function ApplicationConfirmationDialog({
  open,
  onOpenChange,
  roleName,
  organizationName,
}: ApplicationConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-success" />
          </div>
          <DialogTitle className="text-xl font-semibold">
            Application Submitted Successfully!
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4 pt-2">
          <p className="text-muted-foreground leading-relaxed">
            Thank you for applying to our <span className="font-medium text-foreground">{roleName}</span> position at{" "}
            <span className="font-medium text-foreground">{organizationName}</span>!
          </p>
          
          <p className="text-muted-foreground leading-relaxed">
            We've received your application, and our Talent Acquisition team will review it shortly. 
            If your profile matches what we're looking for, one of our recruiters will be in touch 
            soon with the next steps.
          </p>
          
          <p className="text-muted-foreground leading-relaxed">
            We appreciate your interest in joining our team and wish you the best of luck in the process!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}