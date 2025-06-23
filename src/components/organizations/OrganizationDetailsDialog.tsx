
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OrganizationDisplay } from '@/components/settings/OrganizationDisplay'
import { Organization } from '@/hooks/useOrganizations'

interface OrganizationDetailsDialogProps {
  organization: Organization | null
  isOpen: boolean
  onClose: () => void
}

export function OrganizationDetailsDialog({ 
  organization, 
  isOpen, 
  onClose 
}: OrganizationDetailsDialogProps) {
  if (!organization) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Organization Details: {organization.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <OrganizationDisplay organization={organization} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
