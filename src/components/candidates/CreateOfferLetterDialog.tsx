import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { useAuth } from '@/contexts/AuthContext'

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
  const { fields, isLoading: fieldsLoading } = useOfferTemplateFields(selectedTemplateId)
  const { createOfferLetter, isLoading: creatingLetter } = useOfferLetters(candidate.id)
  
  const [currentStep, setCurrentStep] = useState<Step>('template')
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({})
  const [processedContent, setProcessedContent] = useState('')
  const [offerTitle, setOfferTitle] = useState('')

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId)
    setFieldValues({})
    setProcessedContent('')
  }

  const handleFieldChange = (fieldName: string, value: any) => {
    setFieldValues(prev => ({ ...prev, [fieldName]: value }))
  }

  const handleNextStep = () => {
    if (currentStep === 'template' && selectedTemplate) {
      setCurrentStep('fields')
    } else if (currentStep === 'fields') {
      // Process template and generate content
      const offerData: OfferLetterData = {
        candidate,
        job,
        organization,
        fieldValues
      }
      const content = processOfferLetterTemplate(selectedTemplate!.content, offerData)
      setProcessedContent(content)
      setOfferTitle(generateOfferLetterTitle(candidate, job))
      setCurrentStep('preview')
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

      await createOfferLetter({
        candidate_id: candidate.id,
        job_id: candidate.job_id,
        template_id: selectedTemplateId,
        organization_id: user?.user_metadata?.organization_id || organization?.id,
        title: offerTitle,
        content: processedContent,
        field_values: fieldValues,
        status: 'draft',
        created_by: user?.id
      })

      onClose()
      // Reset state
      setCurrentStep('template')
      setSelectedTemplateId('')
      setFieldValues({})
      setProcessedContent('')
      setOfferTitle('')
    } catch (error) {
      console.error('Failed to create offer letter:', error)
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
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedTemplateId === template.id ? 'ring-2 ring-primary' : ''
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

  const renderFieldInputs = () => {
    if (fieldsLoading) {
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
          <RichTextEditor
            value={processedContent}
            onChange={setProcessedContent}
            placeholder="Offer letter content"
            minHeight="300px"
          />
        </div>
      </div>
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