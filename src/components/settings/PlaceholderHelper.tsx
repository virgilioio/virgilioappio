import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CornerDownLeft, Code, User, Building, Briefcase, CalendarClock, FileText, type LucideIcon } from 'lucide-react'
import { useOfferTemplateFields } from '@/hooks/useOfferTemplateFields'
import { useOfferForms } from '@/hooks/useOfferForms'
import { useOfferFormFields, type OfferFormField } from '@/hooks/useOfferFormFields'
import { useToast } from '@/hooks/use-toast'

interface PlaceholderHelperProps {
  templateId?: string
  onInsert?: (placeholder: string) => void
  /** When provided, show offer form field placeholders instead of legacy template fields */
  offerFormFields?: OfferFormField[]
  /** Show an offer form selector to pick which form's fields to display */
  showFormSelector?: boolean
}

export function PlaceholderHelper({ templateId, onInsert, offerFormFields, showFormSelector }: PlaceholderHelperProps) {
  const { fields: legacyFields } = useOfferTemplateFields(templateId)
  const { forms } = useOfferForms()
  const [selectedFormId, setSelectedFormId] = useState<string>('')
  const { fields: selectedFormFields } = useOfferFormFields(selectedFormId || undefined)
  const { toast } = useToast()

  // Determine which dynamic fields to show:
  // 1. Explicit offerFormFields prop (highest priority)
  // 2. Fields from selected form via selector
  // 3. Legacy template fields (fallback)
  const dynamicFields = offerFormFields || (selectedFormId ? selectedFormFields : [])
  const useLegacyFields = !offerFormFields && !selectedFormId

  // Static placeholders for job and organization data
  const jobPlaceholders = [
    { key: '{{job.title}}', description: 'Job title' },
    { key: '{{job.department}}', description: 'Department' },
    { key: '{{job.location}}', description: 'Job location' },
    { key: '{{job.level}}', description: 'Job level (junior, mid, senior, etc.)' },
    { key: '{{job.salary_min}}', description: 'Minimum salary' },
    { key: '{{job.salary_max}}', description: 'Maximum salary' },
    { key: '{{job.currency}}', description: 'Salary currency' },
    { key: '{{job.description}}', description: 'Job description' }
  ]

  const organizationPlaceholders = [
    { key: '{{organization.name}}', description: 'Company / Workspace name' },
    { key: '{{department.name}}', description: 'Department / Job folder name' },
    { key: '{{organization.default_currency}}', description: 'Default currency' }
  ]

  const senderPlaceholders = [
    { key: '{{sender.name}}', description: 'Your full name' },
    { key: '{{sender.first_name}}', description: 'Your first name' },
    { key: '{{sender.last_name}}', description: 'Your last name' },
    { key: '{{sender.email}}', description: 'Your email address' },
    { key: '{{sender.title}}', description: 'Your job title' },
    { key: '{{sender.phone}}', description: 'Your phone number' },
    { key: '{{sender.linkedin}}', description: 'Your LinkedIn profile URL' },
    { key: '{{sender.booking_link}}', description: 'Your booking/scheduling link' }
  ]

  const candidatePlaceholders = [
    { key: '{{candidate.name}}', description: 'Candidate full name' },
    { key: '{{candidate.first_name}}', description: 'Candidate first name' },
    { key: '{{candidate.location_city}}', description: 'Candidate city' },
    { key: '{{candidate.location_state}}', description: 'Candidate state' },
    { key: '{{candidate.location_country}}', description: 'Candidate country' },
    { key: '{{candidate.salary_amount}}', description: 'Candidate salary expectation' },
    { key: '{{candidate.salary_currency}}', description: 'Candidate salary currency' },
    { key: '{{candidate.salary_period}}', description: 'Candidate salary period' }
  ]

  const stagePlaceholders = [
    { key: '{{stage.booking_link}}', description: 'Assigned interviewer booking link (falls back to sender)' }
  ]

  // Build dynamic placeholders from offer form fields
  const formFieldPlaceholders = dynamicFields
    .sort((a, b) => a.display_order - b.display_order)
    .map(field => ({
      key: `{{field.${field.field_name}}}`,
      description: `${field.field_label}${field.field_type === 'salary' ? ' (formatted salary)' : field.field_type === 'location' ? ' (formatted location)' : field.field_type === 'recruiter' ? ' (recruiter name)' : field.field_type === 'employment_type' ? ' (employment type label)' : field.field_type === 'work_location' ? ' (work location label)' : ''}`
    }))

  // Legacy template field placeholders (fallback)
  const legacyPlaceholders = useLegacyFields
    ? legacyFields.map(field => ({
        key: `{{field.${field.field_name}}}`,
        description: field.field_label
      }))
    : []

  const dynamicPlaceholders = formFieldPlaceholders.length > 0 ? formFieldPlaceholders : legacyPlaceholders

  const handleAction = async (text: string) => {
    if (onInsert) {
      onInsert(text)
      toast({
        title: 'Inserted!',
        description: 'Placeholder inserted into editor'
      })
    } else {
      try {
        await navigator.clipboard.writeText(text)
        toast({
          title: 'Copied!',
          description: 'Placeholder copied to clipboard'
        })
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to copy to clipboard',
          variant: 'destructive'
        })
      }
    }
  }

  const PlaceholderSection = ({ 
    title, 
    icon: Icon, 
    placeholders 
  }: { 
    title: string
    icon: LucideIcon
    placeholders: Array<{ key: string; description: string }>
  }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="space-y-1">
        {placeholders.map((placeholder) => (
          <div
            key={placeholder.key}
            className="grid grid-cols-[1fr,auto] gap-2 p-2 rounded border border-border hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0 flex flex-col gap-1">
              <Badge 
                variant="secondary" 
                className="bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700 font-mono text-xs w-fit"
              >
                {placeholder.key}
              </Badge>
              <p className="text-xs text-muted-foreground truncate">
                {placeholder.description}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 flex-shrink-0"
              onClick={() => handleAction(placeholder.key)}
              title={onInsert ? "Insert placeholder" : "Copy placeholder"}
            >
              <CornerDownLeft className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Code className="h-4 w-4" />
          Available Placeholders
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px] px-6 pb-6">
          <div className="space-y-6">
            {/* Offer Form Selector */}
            {showFormSelector && !offerFormFields && forms.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  Offer Form
                </div>
                <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an offer form to see its field placeholders" />
                  </SelectTrigger>
                  <SelectContent>
                    {forms.map(form => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <PlaceholderSection
              title="Job Information"
              icon={Briefcase}
              placeholders={jobPlaceholders}
            />

            <PlaceholderSection
              title="Organization"
              icon={Building}
              placeholders={organizationPlaceholders}
            />

            <PlaceholderSection
              title="Sender Information"
              icon={User}
              placeholders={senderPlaceholders}
            />

            <PlaceholderSection
              title="Candidate"
              icon={User}
              placeholders={candidatePlaceholders}
            />

            <PlaceholderSection
              title="Stage"
              icon={CalendarClock}
              placeholders={stagePlaceholders}
            />

            {dynamicPlaceholders.length > 0 && (
              <PlaceholderSection
                title="Offer Form Fields"
                icon={FileText}
                placeholders={dynamicPlaceholders}
              />
            )}

            {dynamicPlaceholders.length === 0 && (showFormSelector || templateId) && (
              <div className="text-center py-6">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {showFormSelector && !selectedFormId
                    ? 'Select an offer form above to see its field placeholders'
                    : 'No dynamic fields created yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {showFormSelector && !selectedFormId
                    ? 'Field placeholders like {{field.start_date}} will appear here'
                    : 'Add custom fields to see their placeholders here'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
