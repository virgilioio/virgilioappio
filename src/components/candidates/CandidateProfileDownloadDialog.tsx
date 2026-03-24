import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Download, Loader2, Mail, Phone, MapPin } from 'lucide-react'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { generateCandidatePdf, GeneratePdfOptions } from '@/utils/candidatePdfGenerator'
import { toast } from '@/hooks/use-toast'

interface CandidateProfileDownloadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pdfOptions: Omit<GeneratePdfOptions, 'includeContactDetails'>
}

export function CandidateProfileDownloadDialog({
  open,
  onOpenChange,
  pdfOptions,
}: CandidateProfileDownloadDialogProps) {
  const [includeContact, setIncludeContact] = useState(true)
  const [generating, setGenerating] = useState(false)

  const handleDownload = async () => {
    setGenerating(true)
    try {
      await generateCandidatePdf({ ...pdfOptions, includeContactDetails: includeContact })
      toast({ title: 'PDF Generated', description: 'Candidate profile PDF has been downloaded.' })
      onOpenChange(false)
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast({ title: 'Error', description: 'Failed to generate PDF. Please try again.', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download Profile</DialogTitle>
          <DialogDescription>
            Configure what to include in the candidate profile PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="include-contact" className="text-sm font-medium">
                Include contact details
              </Label>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</span>
                <span className="flex items-center gap-1"><LinkedInFilled className="h-3 w-3" /> LinkedIn</span>
              </div>
            </div>
            <Switch
              id="include-contact"
              checked={includeContact}
              onCheckedChange={setIncludeContact}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDownload} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
