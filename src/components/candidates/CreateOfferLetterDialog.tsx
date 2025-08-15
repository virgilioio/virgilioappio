import { useState, useCallback } from 'react'
import * as React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ArrowRight, FileText, CheckCircle, Calendar, DollarSign } from 'lucide-react'
import { useOfferTemplates } from '@/hooks/useOfferTemplates'
import { useOfferTemplateFields, OfferTemplateField } from '@/hooks/useOfferTemplateFields'
import { useOfferLetters } from '@/hooks/useOfferLetters'
import { Candidate } from '@/hooks/useCandidates'
import { processOfferLetterTemplate, generateOfferLetterTitle, validateOfferLetterData, OfferLetterData } from '@/utils/offerLetterUtils'
import { sanitizeHtmlForEditor } from '@/utils/htmlSanitizer'
import { useAuth } from '@/contexts/AuthContext'
import { useCandidateAttachments } from '@/hooks/useCandidateAttachments'
import { supabase } from '@/integrations/supabase/client'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { toast } from '@/hooks/use-toast'

interface CreateOfferLetterDialogProps {
  isOpen: boolean
  onClose: () => void
  candidate: Candidate
  job: any
  organization: any
}

type Step = 'template' | 'fields' | 'preview' | 'review'

export function CreateOfferLetterDialog({
  isOpen,
  onClose,
  candidate,
  job,
  organization
}: CreateOfferLetterDialogProps) {
  const { user } = useAuth()
  const { templates, isLoading: templatesLoading } = useOfferTemplates()
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const { fields, isLoading: fieldsLoading, fetchFieldOptions } = useOfferTemplateFields(selectedTemplateId)
  const { createOfferLetter, isLoading: creatingLetter } = useOfferLetters(candidate.id)
  const { uploadAttachment } = useCandidateAttachments(candidate.id)
  
  const [currentStep, setCurrentStep] = useState<Step>('template')
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({})
  const [processedContent, setProcessedContent] = useState('')
  const [offerTitle, setOfferTitle] = useState('')
  const [fieldOptions, setFieldOptions] = useState<Record<string, Array<{ label: string; value: string }>>>({})
  const [optionsLoading, setOptionsLoading] = useState(false)
const [previewLoading, setPreviewLoading] = useState(false)
  const [isExternalUpdate, setIsExternalUpdate] = useState(false)

  const handleExternalUpdateComplete = useCallback(() => {
    setIsExternalUpdate(false)
  }, [])

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

  const handleTemplateSelect = (templateId: string) => {
    console.log('Template selected:', templateId)
    setSelectedTemplateId(templateId)
    setFieldValues({})
    setProcessedContent('')
    setFieldOptions({})
    // Auto-advance to fields step
    setCurrentStep('fields')
    console.log('Advanced to fields step')
  }

  const handleFieldChange = (fieldName: string, value: any) => {
    setFieldValues(prev => ({ ...prev, [fieldName]: value }))
  }

  const handleNextStep = () => {
    console.log('handleNextStep called, currentStep:', currentStep)
    if (currentStep === 'template' && selectedTemplate) {
      setCurrentStep('fields')
    } else if (currentStep === 'fields') {
      // Process template and generate content
      console.log('🚀 Processing template:', selectedTemplate?.name)
      console.log('📝 Field values:', fieldValues)
      console.log('📏 Template content length:', selectedTemplate?.content?.length || 0)
      
      if (!selectedTemplate?.content) {
        console.error('❌ No template content found!')
        return
      }
      
      if (selectedTemplate.content.length === 0) {
        console.error('❌ Template content is empty!')
        return
      }
      
      try {
        const offerData: OfferLetterData = {
          candidate,
          job,
          organization,
          fieldValues
        }
        
        console.log('⚙️ Processing template with placeholders...')
        const content = processOfferLetterTemplate(selectedTemplate.content, offerData)
        console.log('✅ Processed content length:', content.length)
        console.log('📄 Processed content preview:', content.substring(0, 300) + '...')
        
        if (!content || content.trim() === '') {
          console.error('❌ Template processing resulted in empty content!')
          return
        }
        
        console.log('🧹 Starting HTML sanitization...')
        const sanitizedContent = sanitizeHtmlForEditor(content)
        console.log('✅ Sanitized content length:', sanitizedContent.length)
        console.log('📄 Sanitized content preview:', sanitizedContent.substring(0, 300) + '...')
        
        // Set loading state
        setPreviewLoading(true)
        
        if (!sanitizedContent || sanitizedContent.trim() === '') {
          console.error('❌ Sanitization resulted in empty content!')
          setProcessedContent(`<p>${content.replace(/<[^>]*>/g, '')}</p>`)
          setOfferTitle(generateOfferLetterTitle(candidate, job))
          setCurrentStep('preview')
          setPreviewLoading(false)
        } else {
          console.log('🚀 CRITICAL FIX: Setting external update flag and content simultaneously')
          console.log('📄 Content to be set:', sanitizedContent.substring(0, 200) + '...')
          
          // CRITICAL FIX: Set both external update flag and content in the same state update batch
          // This ensures the RichTextEditor receives both changes in the same render cycle
          setIsExternalUpdate(true)
          setProcessedContent(sanitizedContent)
          setOfferTitle(generateOfferLetterTitle(candidate, job))
          setCurrentStep('preview')
          setPreviewLoading(false)
          
          console.log('✅ Successfully moved to preview step with content')
        }
      } catch (error) {
        console.error('❌ Error processing template:', error)
        // Show error to user or handle gracefully
      }
    } else if (currentStep === 'preview') {
      setCurrentStep('review')
    }
  }

  const handlePrevStep = () => {
    if (currentStep === 'fields') {
      setCurrentStep('template')
    } else if (currentStep === 'preview') {
      setCurrentStep('fields')
    } else if (currentStep === 'review') {
      setCurrentStep('preview')
    }
  }

  const generatePDF = async (htmlContent: string, title: string): Promise<Blob> => {
    // Fetch current active logo from platform assets
    let logoUrl = '/virgilio-logo.png' // Default fallback
    try {
      const { data, error } = await supabase
        .from('platform_assets')
        .select('file_url')
        .eq('asset_type', 'logo')
        .eq('is_active', true)
        .single()

      if (data && !error) {
        logoUrl = data.file_url
      }
    } catch (error) {
      console.log('Using default logo for PDF - no custom logo found')
    }

    // Create a temporary container to render the content
    const tempContainer = document.createElement('div')
    
    // Create logo element
    const logoElement = document.createElement('img')
    logoElement.src = logoUrl
    logoElement.style.position = 'absolute'
    logoElement.style.top = '10mm'
    logoElement.style.left = '10mm'
    logoElement.style.height = '8mm'
    logoElement.style.width = 'auto'
    logoElement.style.zIndex = '1000'
    
    // Strip inline styles and simplify HTML for better PDF generation
    const simplifiedHtml = htmlContent
      .replace(/style="[^"]*"/g, '') // Remove inline styles
      .replace(/<font[^>]*>/g, '<span>') // Replace font tags
      .replace(/<\/font>/g, '</span>')
    
    // Create content wrapper with top margin to account for logo
    const contentWrapper = document.createElement('div')
    contentWrapper.style.marginTop = '30mm' // Space for logo
    contentWrapper.innerHTML = simplifiedHtml
    
    // Add logo and content to container
    tempContainer.appendChild(logoElement)
    tempContainer.appendChild(contentWrapper)
    
    tempContainer.style.position = 'absolute'
    tempContainer.style.left = '-9999px'
    tempContainer.style.top = '-9999px'
    tempContainer.style.width = '210mm' // A4 width
    tempContainer.style.maxWidth = '210mm'
    tempContainer.style.padding = '20mm'
    tempContainer.style.fontFamily = 'Arial, sans-serif'
    tempContainer.style.fontSize = '12px'
    tempContainer.style.lineHeight = '1.4'
    tempContainer.style.color = '#000000'
    tempContainer.style.backgroundColor = '#ffffff'
    tempContainer.style.wordWrap = 'break-word'

    document.body.appendChild(tempContainer)

    // Wait for logo to load
    await new Promise((resolve) => {
      if (logoElement.complete) {
        resolve(undefined)
      } else {
        logoElement.onload = () => resolve(undefined)
        logoElement.onerror = () => resolve(undefined) // Continue even if logo fails
      }
    })

    try {
      // Convert HTML to canvas with optimized settings
      const canvas = await html2canvas(tempContainer, {
        scale: 1, // Reduced from 2 to 1 for smaller file size
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        removeContainer: true
      })

      // Create PDF with compression
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      // Convert to JPEG for better compression
      const imgData = canvas.toDataURL('image/jpeg', 0.7) // JPEG with 70% quality
      const imgWidth = 190 // Slightly smaller to fit better
      const pageHeight = 277 // A4 height minus margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight

      let position = 10 // Start with margin

      // Add first page
      pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 10
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      return pdf.output('blob')
    } finally {
      document.body.removeChild(tempContainer)
    }
  }

  const handleCreateOfferLetter = async () => {
    try {
      // Validate data
      const requiredFields = fields.filter(f => f.is_required).map(f => f.field_name)
      const offerData: OfferLetterData = { candidate, job, organization, fieldValues }
      const errors = validateOfferLetterData(offerData, requiredFields)
      
      if (errors.length > 0) {
        console.error('Validation errors:', errors)
        return
      }

      // Create the offer letter in database
      await createOfferLetter({
        candidate_id: candidate.id,
        job_id: candidate.job_id || '',
        template_id: selectedTemplateId,
        organization_id: user?.user_metadata?.organization_id || organization?.id,
        title: offerTitle,
        content: processedContent,
        field_values: fieldValues,
        status: 'draft',
        created_by: user?.id
      })

      // Generate PDF and upload as attachment
      try {
        const pdfBlob = await generatePDF(processedContent, offerTitle)
        const timestamp = new Date().toISOString().split('T')[0]
        const fileName = `Offer_Letter_${candidate.candidate_name.replace(/\s+/g, '_')}_${timestamp}.pdf`
        
        // Create a File object from the blob
        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })
        
        // Upload as attachment
        await uploadAttachment(pdfFile)
        
        toast({
          title: 'Success',
          description: 'Offer letter created and PDF attached successfully'
        })
      } catch (pdfError) {
        console.error('Failed to generate/upload PDF:', pdfError)
        toast({
          title: 'Partial Success',
          description: 'Offer letter created but PDF attachment failed',
          variant: 'destructive'
        })
      }

      onClose()
      // Reset state
      setCurrentStep('template')
      setSelectedTemplateId('')
      setFieldValues({})
      setProcessedContent('')
      setOfferTitle('')
    } catch (error) {
      console.error('Failed to create offer letter:', error)
      toast({
        title: 'Error',
        description: 'Failed to create offer letter',
        variant: 'destructive'
      })
    }
  }

  const canProceed = () => {
    if (currentStep === 'template') return selectedTemplate
    if (currentStep === 'fields') {
      const requiredFields = fields.filter(f => f.is_required)
      return requiredFields.every(field => fieldValues[field.field_name])
    }
    return true
  }

  const renderStepIndicator = () => {
    const steps = [
      { key: 'template', label: 'Template', icon: FileText },
      { key: 'fields', label: 'Details', icon: DollarSign },
      { key: 'preview', label: 'Preview', icon: FileText },
      { key: 'review', label: 'Review', icon: CheckCircle }
    ]

    const currentIndex = steps.findIndex(s => s.key === currentStep)

    return (
      <div className="flex items-center justify-center space-x-4 mb-6">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = step.key === currentStep
          const isCompleted = index < currentIndex
          
          return (
            <div key={step.key} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCompleted
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground bg-background text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className={`ml-2 text-sm ${isActive ? 'font-medium' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div className={`mx-4 h-0.5 w-8 ${isCompleted ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const renderTemplateSelection = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium">Choose an Offer Letter Template</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select a template to create an offer letter for {candidate.candidate_name}
        </p>
      </div>
      
      {templatesLoading ? (
        <div className="text-center py-8">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No offer templates available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all hover:shadow-md hover:bg-accent/50 ${
                selectedTemplateId === template.id 
                  ? 'ring-2 ring-primary bg-primary/5 border-primary' 
                  : 'hover:border-primary/20'
              }`}
              onClick={() => handleTemplateSelect(template.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{template.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {template.description && (
                  <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                )}
                <Badge variant="outline" className="text-xs">
                  {new Date(template.created_at).toLocaleDateString()}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )

  const loadFieldOptions = async () => {
    if (!fields.length) return
    
    setOptionsLoading(true)
    const optionsMap: Record<string, Array<{ label: string; value: string }>> = {}
    
    try {
      for (const field of fields) {
        if (field.field_type === 'select') {
          const options = await fetchFieldOptions(field.id)
          optionsMap[field.field_name] = options.map(opt => ({
            label: opt.option_label,
            value: opt.option_value
          }))
        }
      }
      setFieldOptions(optionsMap)
    } catch (error) {
      console.error('Error loading field options:', error)
    } finally {
      setOptionsLoading(false)
    }
  }

  // Load options when fields change
  React.useEffect(() => {
    if (fields.length > 0 && currentStep === 'fields') {
      loadFieldOptions()
    }
  }, [fields, currentStep])

  const renderFieldInputs = () => {
    if (fieldsLoading || optionsLoading) {
      return <div className="text-center py-8">Loading template fields...</div>
    }

    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-medium">Fill in the Details</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Complete the required information for the offer letter
          </p>
        </div>

        {fields.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No custom fields required for this template</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.field_name}>
                  {field.field_label}
                  {field.is_required && <span className="text-destructive ml-1">*</span>}
                </Label>
                
                {field.field_type === 'textarea' ? (
                  <Textarea
                    id={field.field_name}
                    value={fieldValues[field.field_name] || ''}
                    onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                    placeholder={field.placeholder_text}
                  />
                ) : field.field_type === 'date' ? (
                  <Input
                    id={field.field_name}
                    type="date"
                    value={fieldValues[field.field_name] || ''}
                    onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                  />
                ) : field.field_type === 'number' ? (
                  <Input
                    id={field.field_name}
                    type="number"
                    value={fieldValues[field.field_name] || ''}
                    onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                    placeholder={field.placeholder_text}
                  />
                ) : field.field_type === 'select' ? (
                  <Select
                    value={fieldValues[field.field_name] || ''}
                    onValueChange={(value) => handleFieldChange(field.field_name, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder_text || 'Select an option'} />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOptions[field.field_name]?.length > 0 ? (
                        fieldOptions[field.field_name].map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-options" disabled>No options available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={field.field_name}
                    value={fieldValues[field.field_name] || ''}
                    onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                    placeholder={field.placeholder_text}
                  />
                )}
                
                {field.help_text && (
                  <p className="text-xs text-muted-foreground">{field.help_text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderPreview = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium">Preview & Edit</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Review and make final adjustments to the offer letter
        </p>
      </div>

      {previewLoading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Processing template content...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="offer-title">Offer Letter Title</Label>
            <Input
              id="offer-title"
              value={offerTitle}
              onChange={(e) => setOfferTitle(e.target.value)}
              placeholder="Enter offer letter title"
            />
          </div>

          <div>
            <Label>Content</Label>
            {/* Debug info */}
            <div className="text-xs text-muted-foreground mb-2">
              Content length: {processedContent?.length || 0} characters
              {!processedContent && <span className="text-red-500 ml-2">⚠️ No content loaded</span>}
            </div>
            
            {processedContent ? (
              <RichTextEditor
                value={processedContent}
                onChange={setProcessedContent}
                placeholder="Offer letter content"
                minHeight="300px"
                isExternalUpdate={isExternalUpdate}
                onExternalUpdateComplete={handleExternalUpdateComplete}
              />
            ) : (
              <div className="border border-dashed border-muted rounded-md p-8 text-center">
                <p className="text-muted-foreground">No content available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Go back to the previous step and try again
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  const renderReview = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium">Final Review</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Confirm all details before creating the offer letter
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Offer Letter Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Template:</span>
              <span>{selectedTemplate?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Candidate:</span>
              <span>{candidate.candidate_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Position:</span>
              <span>{job?.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Title:</span>
              <span>{offerTitle}</span>
            </div>
          </CardContent>
        </Card>

        {Object.keys(fieldValues).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Custom Fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {Object.entries(fieldValues).map(([key, value]) => {
                const field = fields.find(f => f.field_name === key)
                return (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{field?.field_label || key}:</span>
                    <span>{String(value)}</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Offer Letter</DialogTitle>
          <DialogDescription>
            Create a personalized offer letter for {candidate.candidate_name} using predefined templates and custom fields.
          </DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="min-h-[400px]">
          {currentStep === 'template' && renderTemplateSelection()}
          {currentStep === 'fields' && renderFieldInputs()}
          {currentStep === 'preview' && renderPreview()}
          {currentStep === 'review' && renderReview()}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 'template' ? onClose : handlePrevStep}
            disabled={creatingLetter}
          >
            {currentStep === 'template' ? 'Cancel' : (
              <>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </>
            )}
          </Button>

          {currentStep === 'review' ? (
            <Button 
              onClick={handleCreateOfferLetter}
              disabled={creatingLetter || !offerTitle.trim()}
            >
              {creatingLetter ? 'Creating...' : 'Create Offer Letter'}
            </Button>
          ) : (
            <Button
              onClick={handleNextStep}
              disabled={!canProceed()}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}