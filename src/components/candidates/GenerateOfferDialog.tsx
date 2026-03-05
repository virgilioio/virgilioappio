import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, FileText } from 'lucide-react'
import { useOfferTemplates } from '@/hooks/useOfferTemplates'
import { processOfferLetterTemplate, OfferLetterData } from '@/utils/offerLetterUtils'
import { generateOfferPdf } from '@/utils/generateOfferPdf'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select'

interface GenerateOfferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  offerLetterData: OfferLetterData
  offerLetterId: string
  candidateId: string
  candidateName: string
  onSuccess: () => void
}

export function GenerateOfferDialog({
  open,
  onOpenChange,
  offerLetterData,
  offerLetterId,
  candidateId,
  candidateName,
  onSuccess,
}: GenerateOfferDialogProps) {
  const { templates, isLoading: templatesLoading } = useOfferTemplates('organization')
  const { user } = useAuth()
  const { toast } = useToast()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const templateOptions: SearchableSelectOption[] = templates.map(template => ({
    value: template.id,
    label: template.name,
    badge: template.source === 'platform' ? 'Default' : undefined,
    badgeVariant: 'secondary' as const,
  }))

  const handleGenerate = async () => {
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
    if (!selectedTemplate || !user) return

    setIsGenerating(true)
    try {
      // 1. Process template with field values
      const processedHtml = processOfferLetterTemplate(selectedTemplate.content, offerLetterData)

      // 2. Generate PDF
      const pdfBlob = await generateOfferPdf(processedHtml)

      // 3. Upload to storage
      const fileName = `${candidateId}/${Date.now()}-offer-letter.pdf`
      const { error: storageError } = await supabase.storage
        .from('candidate-attachments')
        .upload(fileName, pdfBlob, { contentType: 'application/pdf' })

      if (storageError) throw storageError

      // 4. Create attachment record
      const { error: dbError } = await supabase
        .from('candidate_attachments')
        .insert({
          candidate_id: candidateId,
          file_name: `Offer Letter - ${candidateName}.pdf`,
          file_url: fileName,
          file_size_bytes: pdfBlob.size,
          file_type: 'application/pdf',
          uploaded_by: user.id,
          is_resume: false,
        })

      if (dbError) {
        // Clean up storage on DB failure
        await supabase.storage.from('candidate-attachments').remove([fileName])
        throw dbError
      }

      toast({ title: 'Offer generated', description: 'The offer letter PDF has been created and saved to attachments.' })
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error('Error generating offer:', error)
      toast({ title: 'Error', description: 'Failed to generate offer letter', variant: 'destructive' })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Offer Letter</DialogTitle>
          <DialogDescription>Select a template to generate the offer letter PDF.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {templatesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No offer letter templates available. Create one in Settings → Offers.
            </p>
          ) : (
            <SearchableSelect
              options={templateOptions}
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
              placeholder="Select a template..."
              searchPlaceholder="Search templates..."
              emptyMessage="No templates found."
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={!selectedTemplateId || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Generate PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
