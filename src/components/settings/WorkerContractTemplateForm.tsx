import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { WorkerContractPlaceholderHelper } from './WorkerContractPlaceholderHelper'
import { useWorkerContractTemplates, WorkerContractTemplate } from '@/hooks/useWorkerContractTemplates'
import { ArrowLeft } from 'lucide-react'

interface WorkerContractTemplateFormProps {
  template?: WorkerContractTemplate | null
  selectedCountry: any
  onClose: () => void
}

export function WorkerContractTemplateForm({ 
  template, 
  selectedCountry, 
  onClose 
}: WorkerContractTemplateFormProps) {
  const [formData, setFormData] = useState({
    template_name: '',
    template_content: '',
    version: 1,
    is_active: true
  })
  const [isLoading, setIsLoading] = useState(false)
  
  const { createTemplate, updateTemplate } = useWorkerContractTemplates()

  useEffect(() => {
    if (template) {
      setFormData({
        template_name: template.template_name,
        template_content: template.template_content || '',
        version: template.version,
        is_active: template.is_active
      })
    }
  }, [template])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.template_name.trim()) return
    
    try {
      setIsLoading(true)
      
      const templateData = {
        ...formData,
        country_id: selectedCountry.id
      }

      if (template) {
        await updateTemplate(template.id, templateData)
      } else {
        await createTemplate(templateData)
      }
      
      onClose()
    } catch (error) {
      console.error('Error saving template:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleContentChange = (content: string) => {
    setFormData(prev => ({ ...prev, template_content: content }))
  }

  const insertPlaceholder = (placeholder: string) => {
    const currentContent = formData.template_content
    setFormData(prev => ({
      ...prev,
      template_content: currentContent + placeholder
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h3 className="text-lg font-medium">
            {template ? 'Edit' : 'Create'} Contract Template
          </h3>
          <p className="text-sm text-muted-foreground">
            For {selectedCountry.name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="template_name">Template Name</Label>
                  <Input
                    id="template_name"
                    value={formData.template_name}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      template_name: e.target.value 
                    }))}
                    placeholder="e.g., Standard Employment Contract"
                    required
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ 
                      ...prev, 
                      is_active: checked 
                    }))}
                  />
                  <Label htmlFor="is_active">Active Template</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template_content">Template Content</Label>
                  <RichTextEditor
                    value={formData.template_content}
                    onChange={handleContentChange}
                    placeholder="Enter your contract template content here. Use placeholders like {{worker_name}} to insert dynamic data."
                    minHeight="400px"
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
                  </Button>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <WorkerContractPlaceholderHelper
            selectedCountryId={selectedCountry.id}
            selectedCountryName={selectedCountry.name}
            onInsertPlaceholder={insertPlaceholder}
          />
        </div>
      </div>
    </div>
  )
}