
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useJobPostings } from '@/hooks/useJobPostings'
import { PostingFieldsBuilder } from './PostingFieldsBuilder'
import { CoreFieldsPreview } from './CoreFieldsPreview'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useTenant } from '@/hooks/useTenant'
import { useJobBoardIntegration } from '@/hooks/useJobBoardIntegration'
import { SafeHtml } from '@/components/ui/safe-html'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, Globe, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CurrencySelect } from '@/components/ui/currency-select'

interface PostingSheetProps {
  jobId: string
  postingId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  readOnly?: boolean
  defaultTitle?: string
}

export function PostingSheet({
  jobId,
  postingId,
  open,
  onOpenChange,
  onSaved,
  readOnly,
  defaultTitle
}: PostingSheetProps) {
  const { toast } = useToast()
  const { getPosting, createPosting, updatePosting } = useJobPostings(jobId)
  const { tenant } = useTenant()
  const { integration: talentIntegration, isEnabled: talentEnabled } = useJobBoardIntegration('talent')

  const [localId, setLocalId] = useState<string | undefined>(postingId)
  const [title, setTitle] = useState<string>(defaultTitle || '')
  const [description, setDescription] = useState<string>('')
  const [isExternalUpdate, setIsExternalUpdate] = useState(false)

  // Job details
  const [location, setLocation] = useState<string>('')
  const [employmentType, setEmploymentType] = useState<string>('full_time')
  const [locationType, setLocationType] = useState<string>('onsite')
  const [salaryCurrency, setSalaryCurrency] = useState<string>('USD')
  const [salaryAmount, setSalaryAmount] = useState<string>('')
  const [salaryPeriod, setSalaryPeriod] = useState<string>('annually')
  const [showSalary, setShowSalary] = useState<boolean>(false)
  const [hasCommissions, setHasCommissions] = useState<boolean>(false)
  const [commissionsCurrency, setCommissionsCurrency] = useState<string>('USD')
  const [commissionsAmount, setCommissionsAmount] = useState<string>('')
  const [publishToTalent, setPublishToTalent] = useState<boolean>(false)

  useEffect(() => {
    setLocalId(postingId)
  }, [postingId])

  useEffect(() => {
    const load = async () => {
      if (postingId) {
        const p = await getPosting(postingId)
        if (p) {
          setTitle(p.title)
          setDescription(p.description || '')
          const d = (p as any).details || {}
          setLocation(d.location || '')
          setEmploymentType(d.employment_type || 'full_time')
          setLocationType(d.location_type || 'onsite')
          setSalaryCurrency(d.salary_currency || 'USD')
          setSalaryAmount(d.salary_amount != null ? String(d.salary_amount) : '')
          setSalaryPeriod(d.salary_period || 'annually')
          setShowSalary(!!d.show_salary)
          setHasCommissions(!!d.has_commissions)
          setCommissionsCurrency(d.commissions_currency || 'USD')
          setCommissionsAmount(d.commissions_amount != null ? String(d.commissions_amount) : '')
          setPublishToTalent((p as any).publish_to_talent || false)
          setIsExternalUpdate(true)
        }
      } else {
        setTitle(defaultTitle || '')
        setDescription('')
        setLocation('')
        setEmploymentType('full_time')
        setLocationType('onsite')
        setSalaryCurrency('USD')
        setSalaryAmount('')
        setSalaryPeriod('annually')
        setShowSalary(false)
        setHasCommissions(false)
        setCommissionsCurrency('USD')
        setCommissionsAmount('')
        setPublishToTalent(false)
        setIsExternalUpdate(true)
      }
    }
    if (open) load()
  }, [open, postingId, getPosting, defaultTitle])

  const handleSaveBasics = async () => {
    if (!title?.trim()) {
      toast({ title: 'Title required', description: 'Please enter a title', variant: 'destructive' })
      return
    }

    const details = {
      location: location || null,
      employment_type: employmentType || null,
      location_type: locationType || null,
      salary_currency: salaryCurrency || null,
      salary_amount: salaryAmount ? Number(salaryAmount) : null,
      salary_period: salaryPeriod || null,
      show_salary: !!showSalary,
      has_commissions: !!hasCommissions,
      commissions_currency: hasCommissions ? (commissionsCurrency || null) : null,
      commissions_amount: hasCommissions && commissionsAmount ? Number(commissionsAmount) : null,
    }

    if (localId) {
      await updatePosting(localId, { title, description, details, publish_to_talent: publishToTalent } as any)
      toast({ title: 'Saved', description: 'Posting updated' })
    } else {
      const created = await createPosting({ title, description, details })
      if (created) {
        setLocalId(created.id)
        // Update with publish_to_talent flag
        await updatePosting(created.id, { publish_to_talent: publishToTalent } as any)
        toast({ title: 'Created', description: 'Posting created' })
      }
    }
    onSaved()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{localId ? 'Edit Job Posting' : 'Create Job Posting'}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="basics" className="mt-4">
          <TabsList>
            <TabsTrigger value="basics">Basics</TabsTrigger>
            <TabsTrigger value="application-form" disabled={!localId}>Application Form</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="mt-4 space-y-4">
            <FormField label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter job posting title" />
            </FormField>

            <section aria-labelledby="job-details">
              <h3 id="job-details" className="text-sm font-medium text-text-primary">Job Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <FormField label="Location">
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., New York, NY"
                    disabled={!!readOnly}
                  />
                </FormField>

                <FormField label="Employment Type">
                  <Select value={employmentType} onValueChange={setEmploymentType} disabled={!!readOnly}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full-time</SelectItem>
                      <SelectItem value="part_time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                      <SelectItem value="freelance">Freelance</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Location Type">
                  <Select value={locationType} onValueChange={setLocationType} disabled={!!readOnly}>
                    <SelectTrigger><SelectValue placeholder="Select location type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onsite">On-site</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label="Salary Currency">
                    <CurrencySelect value={salaryCurrency} onChange={setSalaryCurrency} disabled={!!readOnly} />
                  </FormField>
                  <FormField label="Salary Amount">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={salaryAmount}
                      onChange={(e) => setSalaryAmount(e.target.value)}
                      placeholder="e.g., 120000"
                      disabled={!!readOnly}
                    />
                  </FormField>
                  <FormField label="Period">
                    <Select value={salaryPeriod} onValueChange={setSalaryPeriod} disabled={!!readOnly}>
                      <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={showSalary} onCheckedChange={(c) => setShowSalary(!!c)} disabled={!!readOnly} id="show-salary" />
                    <Label htmlFor="show-salary">Show salary?</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={hasCommissions} onCheckedChange={(c) => setHasCommissions(!!c)} disabled={!!readOnly} id="has-commissions" />
                    <Label htmlFor="has-commissions">+ Commissions?</Label>
                  </div>
                </div>

                {hasCommissions && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Average Commissions Currency">
                      <CurrencySelect value={commissionsCurrency} onChange={setCommissionsCurrency} disabled={!!readOnly} />
                    </FormField>
                    <FormField label="Average Commissions Amount">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={commissionsAmount}
                        onChange={(e) => setCommissionsAmount(e.target.value)}
                        placeholder="e.g., 15000"
                        disabled={!!readOnly}
                      />
                    </FormField>
                  </div>
                )}
              </div>
            </section>

            {/* About Company Section - shows what candidates will see */}
            {tenant?.about && (
              <section aria-labelledby="about-company" className="space-y-2">
                <Card className="bg-muted/30 border-dashed">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-medium">About {tenant.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          This content appears on all your job postings for employer branding
                        </CardDescription>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.open('/settings?tab=organization', '_blank')}
                        className="h-8 text-xs gap-1"
                      >
                        Edit
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <SafeHtml 
                      content={tenant.about} 
                      className="prose prose-sm text-text-secondary max-w-none text-sm" 
                    />
                  </CardContent>
                </Card>
              </section>
            )}

            {/* Job Boards Publishing Section */}
            <section aria-labelledby="job-boards-publishing" className="space-y-3">
              <h3 id="job-boards-publishing" className="text-sm font-medium text-text-primary">
                Job Board Publishing
              </h3>
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="publish-talent" className="text-sm font-medium">
                          Publish to Talent.com
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Make this job visible on Talent.com job board
                      </p>
                    </div>
                    <Switch
                      id="publish-talent"
                      checked={publishToTalent}
                      onCheckedChange={setPublishToTalent}
                      disabled={readOnly || !talentEnabled}
                    />
                  </div>
                  
                  {!talentEnabled && (
                    <Alert className="mt-3">
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Enable Talent.com integration in{' '}
                        <a href="/settings?tab=job-boards" className="underline" target="_blank" rel="noopener noreferrer">
                          Settings &gt; Workspace &gt; Job Boards
                        </a>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </section>

            <FormField label="Description">
              <RichTextEditor
                value={description}
                onChange={(html) => setDescription(html)}
                placeholder="Describe the role, responsibilities, etc."
                minHeight="200px"
                isExternalUpdate={isExternalUpdate}
                onExternalUpdateComplete={() => setIsExternalUpdate(false)}
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              {!readOnly && (
                <Button onClick={handleSaveBasics}>
                  {localId ? 'Save' : 'Create'}
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="application-form" className="mt-4 space-y-6">
            {localId && (
              <>
                <CoreFieldsPreview />
                <PostingFieldsBuilder postingId={localId} readOnly={readOnly} />
              </>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
