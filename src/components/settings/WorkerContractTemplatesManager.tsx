import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText, Edit, Trash2 } from 'lucide-react'
import { useWorkerContractTemplates } from '@/hooks/useWorkerContractTemplates'
import { useWorkerComplianceCountries } from '@/hooks/useWorkerComplianceCountries'
import { WorkerContractTemplateForm } from './WorkerContractTemplateForm'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function WorkerContractTemplatesManager() {
  const [selectedCountry, setSelectedCountry] = useState<any>(null)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  
  const { countries } = useWorkerComplianceCountries()
  const { templates, isLoading, deleteTemplate } = useWorkerContractTemplates(selectedCountry?.id)

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template)
    setShowTemplateForm(true)
  }

  const handleAddTemplate = () => {
    setEditingTemplate(null)
    setShowTemplateForm(true)
  }

  const handleCloseForm = () => {
    setShowTemplateForm(false)
    setEditingTemplate(null)
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteTemplate(templateId)
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  if (showTemplateForm) {
    return (
      <WorkerContractTemplateForm
        template={editingTemplate}
        selectedCountry={selectedCountry}
        onClose={handleCloseForm}
      />
    )
  }

  if (selectedCountry) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => setSelectedCountry(null)}
              className="mb-2"
            >
              ← Back to Countries
            </Button>
            <h3 className="text-lg font-medium">
              Contract Templates for {selectedCountry.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              Manage contract templates for workers in {selectedCountry.name}
            </p>
          </div>
          <Button onClick={handleAddTemplate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Template
          </Button>
        </div>

        <div className="grid gap-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  Loading templates...
                </div>
              </CardContent>
            </Card>
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Templates</h3>
                  <p className="text-muted-foreground mb-4">
                    No contract templates found for {selectedCountry.name}
                  </p>
                  <Button onClick={handleAddTemplate}>
                    Create First Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{template.template_name}</CardTitle>
                      <CardDescription>
                        Version {template.version} • 
                        {template.is_active ? (
                          <Badge variant="default" className="ml-2">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="ml-2">Inactive</Badge>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTemplate(template)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Template</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{template.template_name}"? 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Contract Templates by Country</h3>
        <p className="text-sm text-muted-foreground">
          Select a country to manage contract templates for workers
        </p>
      </div>

      <div className="grid gap-4">
        {countries.map((country) => (
          <Card 
            key={country.id} 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setSelectedCountry(country)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{country.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {country.code}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Manage Templates →
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}