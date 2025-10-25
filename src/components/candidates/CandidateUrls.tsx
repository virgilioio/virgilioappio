

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Plus, ExternalLink, Trash2, Github } from 'lucide-react'
import { useCandidateUrls } from '@/hooks/useCandidateUrls'
import { usePermissions } from '@/hooks/usePermissions'

interface CandidateUrlsProps {
  candidateId: string
}

// Available icons with their labels
const ICON_OPTIONS = [
  { value: 'link', label: 'Link', icon: ExternalLink },
  { value: 'github', label: 'GitHub', icon: Github },
  { value: 'dribbble', label: 'Dribbble', icon: ExternalLink },
  { value: 'google-drive', label: 'Google Drive', icon: ExternalLink },
  { value: 'behance', label: 'Behance', icon: ExternalLink },
  { value: 'linkedin', label: 'LinkedIn', icon: ExternalLink },
  { value: 'portfolio', label: 'Portfolio', icon: ExternalLink },
  { value: 'figma', label: 'Figma', icon: ExternalLink },
  { value: 'website', label: 'Website', icon: ExternalLink }
]

const getIconComponent = (iconName: string) => {
  const iconOption = ICON_OPTIONS.find(option => option.value === iconName)
  return iconOption?.icon || ExternalLink
}

export function CandidateUrls({ candidateId }: CandidateUrlsProps) {
  const { urls, isLoading, isAdding, addUrl, deleteUrl } = useCandidateUrls(candidateId)
  const { canManageCandidates } = usePermissions()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    label: '',
    url: '',
    iconName: 'link'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.label.trim() || !formData.url.trim()) return

    try {
      await addUrl(formData.label.trim(), formData.url.trim(), formData.iconName)
      setFormData({ label: '', url: '', iconName: 'link' })
      setIsDialogOpen(false)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleDelete = async (urlId: string, label: string) => {
    if (window.confirm(`Are you sure you want to delete "${label}"?`)) {
      try {
        await deleteUrl(urlId)
      } catch (error) {
        // Error handling is done in the hook
      }
    }
  }

  if (isLoading) {
    return (
      <Card className="bg-surface-primary border-border">
        <AccordionTrigger className="px-6 py-4 hover:no-underline">
          <CardTitle className="text-lg">URLs</CardTitle>
        </AccordionTrigger>
        <AccordionContent>
          <CardContent className="space-y-sm pt-0">
            <Skeleton className="h-[40px] rounded-brand" />
            <Skeleton className="h-[40px] rounded-brand" />
          </CardContent>
        </AccordionContent>
      </Card>
    )
  }

  return (
    <Card className="bg-surface-primary border-border">
      <AccordionTrigger className="px-6 py-4 hover:no-underline">
        <div className="flex items-center justify-between flex-1 pr-4">
          <CardTitle className="text-lg">URLs</CardTitle>
          {canManageCandidates && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="outline" size="sm" className="gap-sm">
                  <Plus className="h-4 w-4" />
                  Add URL
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add URL</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-md">
                  <FormField label="Label" required>
                    <Input
                      value={formData.label}
                      onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="e.g., Portfolio, GitHub, Resume"
                      required
                    />
                  </FormField>

                  <FormField label="URL" required>
                    <Input
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://example.com"
                      required
                    />
                  </FormField>

                  <FormField label="Icon">
                    <Select
                      value={formData.iconName}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, iconName: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <option.icon className="h-4 w-4" />
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <div className="flex justify-end gap-sm">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isAdding}>
                      {isAdding ? 'Adding...' : 'Add URL'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <CardContent className="space-y-sm pt-0">
          {urls.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <ExternalLink className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No URLs added yet</p>
              {!canManageCandidates && (
                <p className="text-xs mt-1">You don't have permission to add URLs</p>
              )}
            </div>
          ) : (
            <div className="space-y-sm">
              {urls.map((url) => {
                const IconComponent = getIconComponent(url.icon_name)
                
                return (
                  <div
                    key={url.id}
                    className="flex items-center justify-between p-3 border border-warning/20 bg-warning/10 rounded-lg hover:scale-105 transition-transform duration-200"
                  >
                    <div className="flex items-center gap-md flex-1 min-w-0">
                      <IconComponent className="h-5 w-5 text-text-secondary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {url.label}
                        </p>
                        <p className="text-xs text-text-secondary truncate">
                          {url.url}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {ICON_OPTIONS.find(opt => opt.value === url.icon_name)?.label || 'Link'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-sm">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(url.url, '_blank')}
                        className="gap-sm h-8 px-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      
                      {canManageCandidates && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(url.id, url.label)}
                          className="gap-sm h-8 px-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </AccordionContent>
    </Card>
  )
}
