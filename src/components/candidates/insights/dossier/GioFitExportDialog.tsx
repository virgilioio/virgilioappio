import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Download, FileText, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { printDossier } from './printDossier'
import type { DossierPrintProps } from './DossierPrintDocument'

interface GioFitExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultClientReady: boolean
  hasContactDetails: boolean
  buildData: (options: { clientReady: boolean; includeContact: boolean }) => DossierPrintProps
  fileName: string
}

export function GioFitExportDialog({ open, onOpenChange, defaultClientReady, hasContactDetails, buildData, fileName }: GioFitExportDialogProps) {
  const [clientReady, setClientReady] = useState(defaultClientReady)
  const [includeContact, setIncludeContact] = useState(true)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (open) setClientReady(defaultClientReady)
  }, [open, defaultClientReady])

  const handleExport = async () => {
    setWorking(true)
    try {
      await printDossier(buildData({ clientReady, includeContact: includeContact && hasContactDetails }), fileName)
      onOpenChange(false)
    } catch (error) {
      console.error('Error exporting dossier:', error)
      toast({ title: 'Export failed', description: 'The dossier could not be prepared for printing. Please try again.', variant: 'destructive' })
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !working && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Export the dossier</DialogTitle>
          <DialogDescription>
            Choose what the document says. Save it as PDF from the print dialog that opens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-2.5">
            {([
              { value: false, title: 'Internal', copy: 'Weights, points, salary, and priorities included.' },
              { value: true, title: 'Client-ready', copy: 'Scoring mechanics and salary removed.' },
            ] as const).map((option) => (
              <button
                key={option.title}
                type="button"
                aria-pressed={clientReady === option.value}
                onClick={() => setClientReady(option.value)}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors',
                  clientReady === option.value ? 'border-virgilio-purple bg-fit-open-row' : 'border-virgilio-border bg-surface-primary hover:bg-fit-paper',
                )}
              >
                <span className="flex items-center gap-1.5 font-poppins text-[13px] font-semibold text-fit-ink">
                  <FileText className="h-3.5 w-3.5 text-virgilio-purple" />
                  {option.title}
                </span>
                <span className="mt-1 block text-[11.5px] leading-[1.45] text-fit-subtle">{option.copy}</span>
              </button>
            ))}
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-virgilio-border p-3.5">
            <div>
              <p className="text-[12.5px] font-medium text-fit-ink">Include contact details</p>
              <p className="mt-1 text-[11.5px] leading-[1.45] text-fit-subtle">
                {clientReady
                  ? 'Client-ready documents never carry email or phone numbers.'
                  : hasContactDetails
                    ? 'Email and phone appear under the candidate name.'
                    : 'No email or phone is on file for this candidate.'}
              </p>
            </div>
            <Switch
              checked={includeContact && hasContactDetails && !clientReady}
              disabled={clientReady || !hasContactDetails}
              onCheckedChange={setIncludeContact}
              aria-label="Include contact details"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={working}>Cancel</Button>
          <Button onClick={handleExport} disabled={working} icon={working ? undefined : Download}>
            {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {working ? 'Preparing…' : 'Export PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
