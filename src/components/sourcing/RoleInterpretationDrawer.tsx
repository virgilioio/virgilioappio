import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Edit2, Briefcase, MapPin, DollarSign, Target, Lightbulb, Check, X, Search, Building2, Tag, ChevronDown } from 'lucide-react'
import { SkillsEditor } from '@/components/dashboard/SkillsEditor'
import { SafeHtml } from '@/components/ui/safe-html'
import { JobSpecData } from '@/types/sourcing'
import gioAvatar from '@/assets/gio-avatar.png'

import { ResearchMetadata } from '@/types/sourcing'

interface RoleInterpretationDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobSpecData: JobSpecData | null
  onUpdate?: (updatedSpec: JobSpecData) => Promise<void>
  isUpdating?: boolean
}

export function RoleInterpretationDrawer({
  open,
  onOpenChange,
  jobSpecData,
  onUpdate,
  isUpdating = false
}: RoleInterpretationDrawerProps) {
  const [isEditing, setIsEditing] = useState<{ [key: string]: boolean }>({})
  const [editableSpec, setEditableSpec] = useState<JobSpecData | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize editable spec when drawer opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && jobSpecData) {
      setEditableSpec({ ...jobSpecData })
      setHasChanges(false)
    }
    onOpenChange(isOpen)
  }

  const handleFieldEdit = (field: string) => {
    setIsEditing(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const handleFieldUpdate = (field: string, value: any) => {
    if (!editableSpec) return

    setEditableSpec(prev => {
      if (!prev) return prev

      if (field.includes('.')) {
        const [parentField, childField] = field.split('.')
        const parentValue = prev[parentField as keyof JobSpecData]
        return {
          ...prev,
          [parentField]: {
            ...(typeof parentValue === 'object' && parentValue !== null ? parentValue : {}),
            [childField]: value
          }
        }
      }

      return { ...prev, [field]: value }
    })
    setHasChanges(true)
  }

  const handleSaveChanges = async () => {
    if (editableSpec && onUpdate) {
      await onUpdate(editableSpec)
      setHasChanges(false)
      setIsEditing({})
    }
  }

  if (!jobSpecData) return null

  const spec = editableSpec || jobSpecData

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b bg-surface-secondary/50">
          <div className="flex items-center gap-3">
            <img 
              src={gioAvatar} 
              alt="Gio"
              className="h-10 w-10 rounded-full"
            />
            <div>
              <SheetTitle className="text-lg font-semibold">
                Gio's Interpretation
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                What Gio understood from your search
              </p>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* Job Title */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  Job Title
                </Label>
                {onUpdate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleFieldEdit('job_title')}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {isEditing.job_title ? (
                <div className="flex gap-2">
                  <Input
                    value={spec.job_title}
                    onChange={(e) => handleFieldUpdate('job_title', e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" variant="ghost" onClick={() => handleFieldEdit('job_title')}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-lg font-semibold">{spec.job_title}</p>
              )}
              {spec.alt_titles && spec.alt_titles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {spec.alt_titles.map((title, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {title}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  Location
                </Label>
                {onUpdate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleFieldEdit('location')}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {isEditing.location ? (
                <div className="flex gap-2">
                  <Input
                    value={spec.location}
                    onChange={(e) => handleFieldUpdate('location', e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" variant="ghost" onClick={() => handleFieldEdit('location')}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="font-medium">{spec.location}</p>
              )}
            </div>

            {/* Salary Range */}
            {spec.salary_range && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    Salary Range
                  </Label>
                  {onUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleFieldEdit('salary')}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {isEditing.salary ? (
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      value={spec.salary_range.min}
                      onChange={(e) => handleFieldUpdate('salary_range.min', parseInt(e.target.value))}
                      className="w-28"
                      placeholder="Min"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      value={spec.salary_range.max}
                      onChange={(e) => handleFieldUpdate('salary_range.max', parseInt(e.target.value))}
                      className="w-28"
                      placeholder="Max"
                    />
                    <span className="text-sm text-muted-foreground">{spec.salary_range.currency}</span>
                    <Button size="sm" variant="ghost" onClick={() => handleFieldEdit('salary')}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="font-medium">
                    {spec.salary_range.currency} {spec.salary_range.min?.toLocaleString()} - {spec.salary_range.max?.toLocaleString()}
                    <span className="text-sm text-muted-foreground ml-1">
                      / {spec.salary_range.period}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Skills */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Target className="h-4 w-4" />
                Skills
              </Label>
              {onUpdate ? (
                <SkillsEditor
                  skills={spec.skills || []}
                  onSkillsChange={(skills) => {
                    handleFieldUpdate('skills', skills)
                  }}
                />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {(spec.skills || []).map((skill, i) => (
                    <Badge key={i} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Department & Level */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Department</Label>
                <p className="font-medium">{spec.department || 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Level</Label>
                <p className="font-medium">{spec.level || 'Not specified'}</p>
              </div>
            </div>

            {/* Job Description */}
            {spec.job_description && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Job Description</Label>
                <div className="prose prose-sm max-w-none text-foreground bg-surface-secondary/30 rounded-lg p-4">
                  <SafeHtml content={spec.job_description} />
                </div>
              </div>
            )}

            {/* Research Enrichments */}
            {spec.research_metadata && (
              spec.research_metadata.researched_companies?.length ||
              spec.research_metadata.researched_industries?.length ||
              spec.research_metadata.researched_titles?.length ||
              spec.research_metadata.researched_keywords?.length
            ) && (
              <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full group">
                  <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer group-hover:text-foreground transition-colors">
                    <Search className="h-4 w-4" />
                    What Gio Researched
                  </Label>
                  <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-foreground transition-all group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-4">
                  {/* Title Variations */}
                  {spec.research_metadata.researched_titles && spec.research_metadata.researched_titles.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Briefcase className="h-3 w-3" />
                        Title Variations
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {spec.research_metadata.researched_titles.slice(0, 8).map((title, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-surface-secondary/50">
                            {title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Target Companies */}
                  {spec.research_metadata.researched_companies && spec.research_metadata.researched_companies.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        Target Companies
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {spec.research_metadata.researched_companies.slice(0, 12).map((company, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {company}
                          </Badge>
                        ))}
                        {spec.research_metadata.researched_companies.length > 12 && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            +{spec.research_metadata.researched_companies.length - 12} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Industries */}
                  {spec.research_metadata.researched_industries && spec.research_metadata.researched_industries.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Tag className="h-3 w-3" />
                        Industries
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {spec.research_metadata.researched_industries.map((industry, i) => (
                          <Badge key={i} variant="outline" className="text-xs border-primary/30 text-primary">
                            {industry}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Keywords */}
                  {spec.research_metadata.researched_keywords && spec.research_metadata.researched_keywords.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Search className="h-3 w-3" />
                        Search Keywords
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {spec.research_metadata.researched_keywords.map((keyword, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-muted/50">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Research Reasoning */}
                  {spec.research_metadata.research_reasoning && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground italic">
                        💡 {spec.research_metadata.research_reasoning}
                      </p>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Recommendations */}
            {spec.recommendations && spec.recommendations.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Lightbulb className="h-4 w-4" />
                  Gio's Recommendations
                </Label>
                <ul className="space-y-2">
                  {spec.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>

        {onUpdate && hasChanges && (
          <SheetFooter className="px-6 py-4 border-t bg-surface-secondary/50">
            <Button
              variant="outline"
              onClick={() => {
                setEditableSpec(jobSpecData ? { ...jobSpecData } : null)
                setHasChanges(false)
                setIsEditing({})
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Discard Changes
            </Button>
            <Button onClick={handleSaveChanges} disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save & Refresh Search'}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
