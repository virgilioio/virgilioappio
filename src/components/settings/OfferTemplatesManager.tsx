import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Edit, Trash2, FileText, Settings as SettingsIcon } from 'lucide-react'
import { useOfferTemplates, type OfferTemplate } from '@/hooks/useOfferTemplates'
import { useOfferTemplateFields } from '@/hooks/useOfferTemplateFields'
import { OfferTemplateFieldsManager } from './OfferTemplateFieldsManager'
import { PlaceholderHelper } from './PlaceholderHelper'
import { sanitizeHtmlForEditor } from '@/utils/htmlSanitizer'

export function OfferTemplatesManager() {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useOfferTemplates()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<OfferTemplate | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [isFieldsDialogOpen, setIsFieldsDialogOpen] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: ''
  })

  const handleCreateTemplate = async () => {
    try {
      await createTemplate({
        name: formData.name,
        description: formData.description,
        content: formData.content
      })
      
      setIsCreateDialogOpen(false)
      setFormData({ name: '', description: '', content: '' })
    } catch (error) {
      // Error handled in hook
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return
    
    try {
      await updateTemplate(editingTemplate.id, {
        name: formData.name,
        description: formData.description,
        content: formData.content
      })
      
      setEditingTemplate(null)
      setFormData({ name: '', description: '', content: '' })
    } catch (error) {
      // Error handled in hook
    }
  }

  const handleDeleteTemplate = async (template: OfferTemplate) => {
    try {
      await deleteTemplate(template.id)
    } catch (error) {
      // Error handled in hook
    }
  }

  const openCreateDialog = () => {
    setFormData({ name: '', description: '', content: '' })
    setIsCreateDialogOpen(true)
  }

  const openEditDialog = (template: OfferTemplate) => {
    console.log('🔧 Editing template:', template.name)
    console.log('📄 Original content length:', template.content.length)
    
    // First clear the content to ensure fresh state
    setFormData({
      name: '',
      description: '',
      content: ''
    })
    
    // Then set the actual content after sanitization
    setTimeout(() => {
      const sanitizedContent = sanitizeHtmlForEditor(template.content)
      console.log('🧹 Sanitized content length:', sanitizedContent.length)
      
      setFormData({
        name: template.name,
        description: template.description || '',
        content: sanitizedContent
      })
    }, 0)
    
    setEditingTemplate(template)
  }

  const openFieldsDialog = (templateId: string) => {
    setSelectedTemplateId(templateId)
    setIsFieldsDialogOpen(true)
  }

  const closeDialogs = () => {
    setIsCreateDialogOpen(false)
    setEditingTemplate(null)
    setIsFieldsDialogOpen(false)
    setSelectedTemplateId(null)
    setFormData({ name: '', description: '', content: '' })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Offer Letter Templates
            </CardTitle>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No offer templates found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first template to get started
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      {template.description || <span className="text-muted-foreground italic">No description</span>}
                    </TableCell>
                    <TableCell>
                      {new Date(template.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openFieldsDialog(template.id)}
                        >
                          <SettingsIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Template</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{template.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTemplate(template)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Template Dialog */}
      <Dialog open={isCreateDialogOpen || !!editingTemplate} onOpenChange={(open) => {
        if (!open) {
          closeDialogs()
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Offer Template'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Software Engineer Offer Letter"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Standard offer letter template for software engineering positions"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Template Content</Label>
                <RichTextEditor
                  value={formData.content}
                  onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                  placeholder="Enter your offer letter template content here. Use placeholders like {{job.title}}, {{organization.name}}, {{field.start_date}} etc."
                  minHeight="400px"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeDialogs}>
                  Cancel
                </Button>
                <Button 
                  onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                  disabled={!formData.name.trim() || !formData.content.trim()}
                >
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <PlaceholderHelper templateId={editingTemplate?.id} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Fields Dialog */}
      <Dialog open={isFieldsDialogOpen} onOpenChange={() => setIsFieldsDialogOpen(false)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Template Fields</DialogTitle>
          </DialogHeader>
          {selectedTemplateId && (
            <OfferTemplateFieldsManager templateId={selectedTemplateId} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}