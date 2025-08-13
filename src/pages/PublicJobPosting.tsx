
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SafeHtml } from '@/components/ui/safe-html'
import { VirgilioLogo } from '@/components/VirgilioLogo'
import { MapPin, Briefcase, DollarSign, Sparkles, Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useResumeParsing } from '@/hooks/useResumeParsing'
import { useSkillsGeneration } from '@/hooks/useSkillsGeneration'
import { getSkillColor } from '@/utils/skillColors'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { sanitizeHtml, sanitizeHtmlForEditor } from '@/utils/htmlSanitizer'
import { markdownToHtml } from '@/utils/markdown'
import { ParsingAnimation } from '@/components/ui/parsing-animation'
import { ApplicationConfirmationDialog } from '@/components/candidates/ApplicationConfirmationDialog'

type FieldType = 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file' | 'url'

interface Posting {
  id: string
  job_id: string
  title: string
  description: string | null
  details: any | null
}

interface PostingField {
  id: string
  field_label: string
  field_type: FieldType
  is_required: boolean
  placeholder_text?: string | null
  column_span?: number | null
  field_name?: string | null
}

interface SelectOption {
  id: string
  option_value: string
  option_label: string
  display_order: number
  posting_field_id: string
}

export default function PublicJobPosting() {
  const { slug } = useParams<{ slug: string }>()
  const [posting, setPosting] = useState<Posting | null>(null)
  const [fields, setFields] = useState<PostingField[]>([])
  const [options, setOptions] = useState<Record<string, SelectOption[]>>({})
  const [loading, setLoading] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const [tab, setTab] = useState<'overview' | 'application'>('overview')
  const { toast } = useToast()
  const [dragOverField, setDragOverField] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({})
  const { isParsing, parseResume } = useResumeParsing()
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const { generateSkills, isGenerating, generatedSkills } = useSkillsGeneration()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false)
  const [organizationName, setOrganizationName] = useState<string>('')
  // Canonical host redirect to app.virgilio.io (skip local dev)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const { hostname } = window.location
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
      const targetHost = 'app.virgilio.io'
      if (!isLocal && hostname !== targetHost) {
        const url = new URL(window.location.href)
        url.host = targetHost
        url.protocol = 'https:'
        window.location.replace(url.toString())
      }
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 2)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const load = async () => {
      if (!slug) return
      // Only active postings are selectable publicly due to RLS
      const { data: p } = await supabase
        .from('job_postings')
        .select(`
          id,
          job_id,
          title,
          description,
          details,
          jobs!inner(
            organizations!inner(name)
          )
        `)
        .eq('slug', slug)
        .maybeSingle()
      if (!p) {
        setPosting(null)
        setLoading(false)
        return
      }
      setPosting(p as Posting)
      // Extract organization name
      const orgName = (p as any)?.jobs?.organizations?.name || 'our company'
      setOrganizationName(orgName)

      const { data: f } = await supabase
        .from('job_posting_application_fields')
        .select('id, field_label, field_type, is_required, placeholder_text, column_span, field_name')
        .eq('posting_id', p.id)
        .order('display_order', { ascending: true })

      const fieldRows = (f || []) as PostingField[]
      setFields(fieldRows)
      setFormValues(Object.fromEntries(fieldRows.map((r) => [r.id, ''])))

      // Fetch select options for select fields
      const selectFieldIds = fieldRows.filter((r) => r.field_type === 'select').map((r) => r.id)
      if (selectFieldIds.length) {
        const { data: allOpts } = await supabase
          .from('posting_field_select_options')
          .select('*')
          .in('posting_field_id', selectFieldIds)
          .order('display_order', { ascending: true })
        const grouped: Record<string, SelectOption[]> = {}
        ;(allOpts || []).forEach((o: any) => {
          if (!grouped[o.posting_field_id]) grouped[o.posting_field_id] = []
          grouped[o.posting_field_id].push(o as SelectOption)
        })
        setOptions(grouped)
      } else {
        setOptions({})
      }

      setLoading(false)
    }
    load()
  }, [slug])

  const details = useMemo(() => {
    const d: any = (posting?.details as any) || {}
    return {
      location: d.location || null,
      employmentType: d.employment_type || null,
      locationType: d.location_type || null,
      salaryCurrency: d.salary_currency || null,
      salaryAmount: d.salary_amount ?? null,
      salaryPeriod: d.salary_period || null,
      showSalary: !!d.show_salary,
      hasCommissions: !!d.has_commissions,
      commissionsCurrency: d.commissions_currency || null,
      commissionsAmount: d.commissions_amount ?? null,
    }
  }, [posting])

  const formatLabel = (val?: string | null) => {
    if (!val) return null
    return val
      .toString()
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  // Helpers to map parsed resume data into default fields
  const splitName = (full?: string | null) => {
    if (!full) return { first: '', last: '' }
    const parts = full.trim().split(/\s+/)
    if (parts.length === 1) return { first: parts[0], last: '' }
    const last = parts.pop() as string
    return { first: parts.join(' '), last }
  }

  const applyParsedToForm = (parsed: { name?: string; email?: string; phone?: string }) => {
    const next = { ...formValues }
    const idByName = (name: string) => fields.find((r) => (r as any).field_name === name)?.id
    if (parsed.name) {
      const { first, last } = splitName(parsed.name)
      const fid = idByName('first_name')
      const lid = idByName('last_name')
      if (fid) next[fid] = first
      if (lid) next[lid] = last
    }
    if (parsed.email) {
      const eid = idByName('email')
      if (eid) next[eid] = parsed.email
    }
    if (parsed.phone) {
      const pid = idByName('phone')
      if (pid) next[pid] = parsed.phone
    }
    setFormValues(next)
  }

  const handleParsedFile = async (file: File) => {
    const parsed = await parseResume(file)
    if (parsed) {
      applyParsedToForm(parsed as any)
      if (parsed.profileSummary) {
        try {
          // Populate Profile Summary rich text field with sanitized HTML
          const psField = fields.find((r) => (r as any).field_name === 'profile_summary')
          if (psField) {
            const html = sanitizeHtmlForEditor(markdownToHtml(parsed.profileSummary))
            setFormValues((prev) => ({ ...prev, [psField.id]: html }))
          }

          await generateSkills(parsed.profileSummary, parsed.name || 'Candidate', { context: 'candidate', desiredCount: 20, minCount: 12 })
        } catch {
          // Ignore generation errors; toast already handled in hook
        }
      }
      toast({ title: 'Parsed from resume', description: 'Prefilled basic info. Please review before submitting.' })
    }
  }

  function JobDetailsCard({ details }: { details: { location: string | null; employmentType: string | null; locationType: string | null; salaryCurrency: string | null; salaryAmount: number | null; salaryPeriod: string | null; showSalary: boolean; hasCommissions: boolean; commissionsCurrency: string | null; commissionsAmount: number | null; } }) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium">Location</div>
              <div className="text-sm text-muted-foreground">
                {details.location || 'Not specified'}
                {details.locationType && (
                  <span> • {formatLabel(details.locationType)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium">Employment Type</div>
              <div className="text-sm text-muted-foreground">
                {formatLabel(details.employmentType) || 'Not specified'}
              </div>
            </div>
          </div>

          {(details.showSalary && details.salaryAmount) && (
            <div className="flex items-start gap-3">
              <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium">Compensation</div>
                <div className="text-sm text-muted-foreground">
                  {details.salaryCurrency} {Number(details.salaryAmount).toLocaleString()} {formatLabel(details.salaryPeriod)}
                </div>
                {details.hasCommissions && details.commissionsAmount && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Avg commissions: {details.commissionsCurrency} {Number(details.commissionsAmount).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
      }
  
  const handleApplyClick = () => {
    setTab('application')
    setTimeout(() => {
      document.getElementById('application-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  const handleSubmitApplication = async () => {
    if (!posting) return
    
    // Validate required fields
    const missingRequiredFields: string[] = []
    const requiredFields = fields.filter(f => f.is_required)
    
    requiredFields.forEach(field => {
      const value = formValues[field.id]
      let isEmpty = false
      
      // Different validation logic based on field type
      switch (field.field_type) {
        case 'file':
          isEmpty = !uploadedFiles[field.id]
          break
        case 'checkbox':
          isEmpty = !value || value !== 'true'
          break
        case 'select':
          isEmpty = !value || value.trim() === ''
          break
        default:
          isEmpty = !value || value.trim() === ''
      }
      
      if (isEmpty) {
        missingRequiredFields.push(field.field_label)
      }
    })
    
    if (missingRequiredFields.length > 0) {
      toast({
        title: 'Missing required fields',
        description: `Please fill in the following required fields: ${missingRequiredFields.join(', ')}`,
        variant: 'destructive'
      })
      return
    }
    
    setIsSubmitting(true)
    try {
      const findByName = (name: string) => {
        const f = fields.find((r) => (r as any).field_name === name)
        return f ? formValues[f.id] ?? '' : ''
      }
      const findByLabel = (label: RegExp) => {
        const f = fields.find((r) => label.test(r.field_label))
        return f ? formValues[f.id] ?? '' : ''
      }

      const first = findByName('first_name') || findByLabel(/first\s*name/i)
      const last = findByName('last_name') || findByLabel(/last\s*name/i)
      const full = findByName('full_name') || findByLabel(/full\s*name|name/i)
      const email = findByName('email') || findByLabel(/email/i)
      const phone = findByName('phone') || findByLabel(/phone|mobile/i)
      const linkedin = findByName('linkedin_url') || findByLabel(/linkedin/i)
      const psField = fields.find((r) => (r as any).field_name === 'profile_summary' || /profile summary/i.test(r.field_label))
      const rawSummary = psField ? (formValues[psField.id] ?? '') : ''
      const profileSummary = sanitizeHtmlForEditor(rawSummary)

      const candidateName = (full || `${first} ${last}`).trim() || 'Applicant'

      // Convert uploaded files to base64 for transmission
      const filesToUpload: Record<string, any> = {}
      for (const [fieldId, file] of Object.entries(uploadedFiles)) {
        if (file) {
          try {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(file)
            })
            
            filesToUpload[fieldId] = {
              name: file.name,
              type: file.type,
              size: file.size,
              data: base64
            }
          } catch (error) {
            console.error('Error converting file to base64:', error)
          }
        }
      }

      const { data, error } = await supabase.functions.invoke('public-submit-application', {
        body: {
          postingId: posting.id,
          jobId: posting.job_id,
          fields: {
            first_name: first,
            last_name: last,
            full_name: full,
            email,
            phone,
            linkedin_url: linkedin,
            profile_summary: profileSummary,
            candidate_name: candidateName,
          },
          uploadedFiles: Object.keys(filesToUpload).length > 0 ? filesToUpload : undefined,
          generatedSkills: generatedSkills.length > 0 ? generatedSkills : undefined
        }
      })

      if (error) throw new Error(error.message || 'Submission failed')

      setShowConfirmationDialog(true)
    } catch (err) {
      console.error('Submit application error:', err)
      toast({
        title: 'Submission failed',
        description: err instanceof Error ? err.message : 'Something went wrong',
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
      if (loading) {
    return <div className="max-w-3xl mx-auto p-6">Loading...</div>
  }

  if (!posting) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Posting Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">This job posting is not available.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with logo on the right */}
      <header className={`fixed top-0 left-0 right-0 z-50 border-b border-border transition-shadow supports-[backdrop-filter]:bg-surface-primary/60 bg-surface-primary/90 backdrop-blur ${scrolled ? 'shadow-sm' : ''}`}>
        <div className="max-w-5xl mx-auto flex items-center justify-start px-md py-2 sm:px-lg">
          <VirgilioLogo className="h-6 w-auto" />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 pt-20 pb-10 flex-1 w-full">
        <section aria-labelledby="job-title">
          <h1 id="job-title" className="text-3xl font-semibold text-text-primary">{posting.title}</h1>
        </section>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'overview' | 'application')} className="space-y-6 mt-4">
          <TabsList>
            <TabsTrigger value="overview">Job Overview</TabsTrigger>
            <TabsTrigger value="application">Application</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="order-2 lg:order-1 lg:col-span-2 space-y-8">
                <section aria-labelledby="job-description">
                  {posting.description && (
                    <Card>
                      <CardContent>
                        <SafeHtml content={posting.description} className="prose prose-sm text-text-secondary max-w-none" />
                      </CardContent>
                    </Card>
                  )}
                </section>
                <div className="pt-2">
                  <Button onClick={handleApplyClick} className="w-full sm:w-auto" aria-label="Apply for this job">
                    Apply for this job
                  </Button>
                </div>
              </div>

              <aside className="order-1 lg:order-2 lg:col-span-1 lg:sticky lg:top-20 space-y-4">
                <JobDetailsCard details={details} />
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="application">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="order-2 lg:order-1 lg:col-span-2">
                <section aria-labelledby="application-form">
                  <Card>
                    <CardHeader>
                      <CardTitle id="application-form">Application Form</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {fields.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No application form fields configured yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          {fields.map((f) => (
                            <div
                              key={f.id}
                              style={{ gridColumn: `span ${f.column_span || 4} / span ${f.column_span || 4}` }}
                            >
                              <label className="text-sm font-medium">
                                {f.field_label} {f.is_required && <Badge variant="secondary" className="ml-2">Required</Badge>}
                              </label>
                              <div className="mt-1">
                                {f.field_type === 'text' && (
                                  <Input
                                    placeholder={f.placeholder_text || ''}
                                    value={formValues[f.id] ?? ''}
                                    onChange={(e) => setFormValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                                  />
                                )}
                                {f.field_type === 'url' && (
                                  <Input
                                    type="url"
                                    placeholder={f.placeholder_text || 'https://'}
                                    value={formValues[f.id] ?? ''}
                                    onChange={(e) => setFormValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                                  />
                                )}
                                {f.field_type === 'email' && (
                                  <Input
                                    type="email"
                                    placeholder={f.placeholder_text || ''}
                                    value={formValues[f.id] ?? ''}
                                    onChange={(e) => setFormValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                                  />
                                )}
                                {f.field_type === 'number' && (
                                  <Input
                                    type="number"
                                    placeholder={f.placeholder_text || ''}
                                    value={formValues[f.id] ?? ''}
                                    onChange={(e) => setFormValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                                  />
                                )}
{f.field_type === 'textarea' && (
  (f.field_name === 'profile_summary' || /profile summary/i.test(f.field_label)) ? (
    <RichTextEditor
      value={formValues[f.id] ?? ''}
      onChange={(val) => setFormValues((prev) => ({ ...prev, [f.id]: sanitizeHtml(val) }))}
      placeholder={f.placeholder_text || 'Write a concise profile summary...'}
      minHeight="180px"
    />
  ) : (
    <Textarea
      placeholder={f.placeholder_text || ''}
      rows={4}
      value={formValues[f.id] ?? ''}
      onChange={(e) => setFormValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
    />
  )
)}
                                {f.field_type === 'checkbox' && (
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={formValues[f.id] === 'true'}
                                      onCheckedChange={(checked) => setFormValues((prev) => ({ ...prev, [f.id]: checked ? 'true' : 'false' }))}
                                    />
                                    <span className="text-sm text-muted-foreground">I acknowledge</span>
                                  </div>
                                )}
                                {f.field_type === 'select' && (
                                  <Select
                                    value={formValues[f.id] || ''}
                                    onValueChange={(value) => setFormValues((prev) => ({ ...prev, [f.id]: value }))}
                                  >
                                    <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                                    <SelectContent>
                                      {(options[f.id] || []).map((o) => (
                                        <SelectItem key={o.id} value={o.option_value}>{o.option_label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                {f.field_type === 'date' && (
                                  <Input
                                    type="date"
                                    value={formValues[f.id] || ''}
                                    onChange={(e) => setFormValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                                  />
                                )}
{f.field_type === 'file' && (/resume/i.test(f.field_label) ? (
  <div className="relative group">
    <div className={`pointer-events-none absolute -inset-[2px] rounded-lg bg-gradient-to-r from-pastel-purple via-pastel-blue to-info blur-md transition-opacity duration-300 ${dragOverField === f.id ? 'opacity-80' : 'opacity-50'} pulse`} />
    <div
      className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors bg-pastel-purple/10 ${dragOverField === f.id ? 'border-pastel-purple bg-pastel-purple/15' : 'border-pastel-purple/70 hover:border-pastel-purple'}`}
      onDrop={(e) => { e.preventDefault(); setDragOverField(null); const file = e.dataTransfer.files?.[0]; if (file) { setUploadedFiles((prev) => ({ ...prev, [f.id]: file })); void handleParsedFile(file); } }}
      onDragOver={(e) => { e.preventDefault(); setDragOverField(f.id); }}
      onDragLeave={(e) => { e.preventDefault(); setDragOverField(null); }}
      aria-busy={isParsing || isGenerating}
      aria-live="polite"
    >
      <input
        id={`file-${f.id}`}
        type="file"
        className="hidden"
        onChange={(e) => { const file = e.target.files?.[0] || null; setUploadedFiles((prev) => ({ ...prev, [f.id]: file })); if (file) { void handleParsedFile(file as File) }; e.currentTarget.value = '' }}
        accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.gif,.webp"
      />
      <Sparkles className="h-8 w-8 mx-auto text-pastel-purple-foreground mb-2" />
      <p className="text-sm text-text-secondary mb-2">Upload here, and watch some magic!</p>
      <p className="text-xs text-text-secondary mb-4">PDF, DOC, DOCX, TXT or images up to 15MB</p>
      <Button
        type="button"
        variant="default"
        onClick={() => document.getElementById(`file-${f.id}`)?.click()}
        disabled={isParsing || isGenerating}
        className="gap-sm bg-pastel-purple text-pastel-purple-foreground border border-pastel-purple-foreground/30 hover:bg-pastel-purple/80 shadow-button"
      >
        {(isParsing || isGenerating) ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {isParsing ? 'Parsing…' : 'Generating skills…'}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> Choose File
          </>
        )}
      </Button>
      {uploadedFiles[f.id] && (
        <p className="mt-3 text-xs text-text-secondary">Selected: {uploadedFiles[f.id]?.name}</p>
      )}
      {(isParsing || isGenerating) && (
        <div className="absolute inset-0 rounded-lg bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
          <Loader2 className="h-6 w-6 text-pastel-purple-foreground animate-spin mb-2" />
          <ParsingAnimation 
            isActive={isParsing || isGenerating}
          />
        </div>
      )}
    </div>
    {generatedSkills.length > 0 && (
      <div className="mt-4 flex flex-wrap gap-2">
        {generatedSkills.slice(0, 30).map((s, idx) => (
          <Badge key={`${s.name}-${idx}`} variant={getSkillColor(s.name)}>
            {s.name}
          </Badge>
        ))}
      </div>
    )}
  </div>
) : (
  <Input type="file" />
))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
<div className="pt-4">
  <Button type="button" onClick={handleSubmitApplication} className="w-full sm:w-auto" aria-label="Submit application" disabled={isSubmitting || isParsing || isGenerating}>
    {isSubmitting ? (
      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Submitting…</span>
    ) : (
      'Submit Application'
    )}
  </Button>
</div>
                    </CardContent>
                  </Card>
                </section>
              </div>
              <aside className="order-1 lg:order-2 lg:col-span-1 lg:sticky lg:top-20 space-y-4">
                <JobDetailsCard details={details} />
              </aside>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <footer className="border-t border-border bg-surface-primary">
        <div className="max-w-5xl mx-auto px-6 sm:px-lg py-6 flex items-center">
          <span className="text-sm text-muted-foreground mr-3">Powered by</span>
          <VirgilioLogo className="h-5 w-auto" />
        </div>
      </footer>
      
      <ApplicationConfirmationDialog
        open={showConfirmationDialog}
        onOpenChange={setShowConfirmationDialog}
        roleName={posting?.title || 'this position'}
        organizationName={organizationName}
      />
    </div>
  )
}
