
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { SafeHtml } from '@/components/ui/safe-html'
import { GoGioLogo } from '@/components/GoGioLogo'
import { MapPin, Briefcase, DollarSign, Loader2, ArrowLeft } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { sanitizeHtmlForEditor } from '@/utils/htmlSanitizer'
import { markdownToHtml } from '@/utils/markdown'
import { EnhancedResumeDropzone, type ParsedResumeData } from '@/components/candidates/EnhancedResumeDropzone'
import { ApplicationConfirmationDialog } from '@/components/candidates/ApplicationConfirmationDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Clock, Shield } from 'lucide-react'
import { useCoreFields } from '@/hooks/useCoreFields'
import { CoreFieldsRenderer } from '@/components/forms/CoreFieldsRenderer'
import { ApplicationFieldsRenderer } from '@/components/forms/ApplicationFieldsRenderer'

type FieldType = 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'checkbox_group' | 'date' | 'file' | 'url'

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
  const navigate = useNavigate()
  const [posting, setPosting] = useState<Posting | null>(null)
  const [customFields, setCustomFields] = useState<PostingField[]>([])
  const [options, setOptions] = useState<Record<string, SelectOption[]>>({})
  const [loading, setLoading] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const [tab, setTab] = useState<'overview' | 'application'>('overview')
  const { toast } = useToast()
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [capturedResumeText, setCapturedResumeText] = useState('')
  const [coreFieldValues, setCoreFieldValues] = useState({
    candidate_name: '',
    email: '',
    phone: '',
    linkedin_url: '',
    profile_summary: ''
  })
  const [customFieldResponses, setCustomFieldResponses] = useState<Record<string, any>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false)
  const [organizationName, setOrganizationName] = useState<string>('')
  const [companySlug, setCompanySlug] = useState<string | null>(null)
  const [tenantAbout, setTenantAbout] = useState<string | null>(null)
  
  const { coreFields } = useCoreFields()
  // Canonical host redirect to app.gogio.io (skip local dev)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const { hostname } = window.location
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
      const targetHost = 'app.gogio.io'
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
          tenant_id
        `)
        .eq('slug', slug)
        .maybeSingle()
      if (!p) {
        setPosting(null)
        setLoading(false)
        return
      }
      setPosting(p as Posting)
      setOrganizationName('our company')

      // Fetch tenant data (about and company slug)
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('about, name')
        .eq('id', (p as any).tenant_id)
        .maybeSingle()
      
      if (tenantData) {
        setTenantAbout(tenantData.about)
        setOrganizationName(tenantData.name) // Use tenant name for consistency
      }

      // Fetch company slug from careers page settings
      const { data: careersSettings } = await supabase
        .from('careers_page_settings')
        .select('company_slug')
        .eq('tenant_id', (p as any).tenant_id)
        .eq('is_active', true)
        .maybeSingle()
      
      if (careersSettings) {
        setCompanySlug(careersSettings.company_slug)
      }

      const { data: f } = await supabase
        .from('job_posting_application_fields')
        .select('id, field_label, field_type, is_required, placeholder_text, column_span, field_name')
        .eq('posting_id', p.id)
        .order('display_order', { ascending: true })

      const fieldRows = (f || []) as PostingField[]
      setCustomFields(fieldRows)

      // Fetch select options for select fields
      const selectFieldIds = fieldRows.filter((r) => r.field_type === 'select' || r.field_type === 'checkbox_group').map((r) => r.id)
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

  const handleParsedData = (parsed: ParsedResumeData) => {
    console.log('🔄 Applying parsed data to core fields:', parsed)
    
    setCoreFieldValues(prev => {
      let profileSummary = prev.profile_summary
      if (parsed.profileSummary) {
        const html = markdownToHtml(parsed.profileSummary)
        profileSummary = sanitizeHtmlForEditor(html)
      }
      
      return {
        ...prev,
        candidate_name: parsed.name || prev.candidate_name,
        email: parsed.email || prev.email,
        phone: parsed.phone || prev.phone,
        linkedin_url: parsed.linkedinUrl || prev.linkedin_url,
        profile_summary: profileSummary
      }
    })
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

  // File validation helper
  const validateFile = (file: File): string | null => {
    // Size validation (15MB limit)
    if (file.size > 15 * 1024 * 1024) {
      return 'File size must be less than 15MB'
    }

    // Type validation
    const allowedTypes = [
      'application/pdf',
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png', 
      'image/gif'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return 'Unsupported file type. Please use PDF, DOC, DOCX, TXT, JPG, PNG, or GIF files.'
    }

    return null
  }

  const handleSubmitApplication = async () => {
    if (!posting) return
    
    // Validate core fields
    const missingFields: string[] = []
    if (!coreFieldValues.candidate_name.trim()) missingFields.push('Full Name')
    if (!coreFieldValues.email.trim()) {
      missingFields.push('Email')
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(coreFieldValues.email.trim())) {
        missingFields.push('Valid Email Address')
      }
    }
    
    // Validate resume upload (required)
    if (uploadedFiles.length === 0) {
      missingFields.push('Resume/CV')
    }
    
    // Validate custom required fields
    const missingCustomFields: string[] = []
    customFields.forEach(field => {
      if (field.is_required) {
        const fieldValue = customFieldResponses[field.id]
        if (!fieldValue || (typeof fieldValue === 'string' && !fieldValue.trim())) {
          missingCustomFields.push(field.field_label)
        }
      }
    })
    
    if (missingCustomFields.length > 0) {
      missingFields.push(...missingCustomFields)
    }
    
    // Validate uploaded files
    const fileValidationErrors: string[] = []
    for (const file of uploadedFiles) {
      if (file) {
        const error = validateFile(file)
        if (error) {
          fileValidationErrors.push(`Resume: ${error}`)
        }
      }
    }
    
    if (missingFields.length > 0) {
      toast({
        title: 'Missing required fields',
        description: `Please fill in the following required fields: ${missingFields.join(', ')}`,
        variant: 'destructive'
      })
      return
    }

    if (fileValidationErrors.length > 0) {
      toast({
        title: 'File validation errors',
        description: fileValidationErrors.join('; '),
        variant: 'destructive'
      })
      return
    }
    
    setIsSubmitting(true)
    try {
      console.log('🚀 Starting application submission')
      console.log('📋 Core field values:', coreFieldValues)
      console.log('📋 Custom field responses:', customFieldResponses)

      // Convert resume to base64 if present
      const resumeFile = uploadedFiles[0]
      let resumeBase64 = null
      if (resumeFile) {
        resumeBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(resumeFile)
        })
      }

      // Remap custom field responses from field.id to field.field_name
      const mappedCustomFields: Record<string, any> = {}
      Object.entries(customFieldResponses).forEach(([fieldId, value]) => {
        const field = customFields.find(f => f.id === fieldId)
        if (field?.field_name) {
          mappedCustomFields[field.field_name] = value
        }
      })

      // Prepare application data in the format expected by the edge function
      const applicationData = {
        ...coreFieldValues,
        resumeText: capturedResumeText, // For server-side AI enrichment
        custom_fields: mappedCustomFields, // Use field names instead of IDs
        uploadedFiles: resumeBase64 ? [{ name: resumeFile!.name, data: resumeBase64, type: resumeFile!.type, size: resumeFile!.size }] : [],
        posting_id: posting.id
      }

      const { data, error } = await supabase.functions.invoke('public-submit-application', {
        body: applicationData
      })

      // Check for application limit violations first
      const response = data as any
      if (!response?.success && response?.violations?.length > 0) {
        const violation = response.violations[0] // Show the first violation
        let errorMessage = violation.message
        
        // Add cooldown date information if available
        if (violation.cooldown_until) {
          const cooldownDate = new Date(violation.cooldown_until)
          const now = new Date()
          const daysUntil = Math.ceil((cooldownDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          
          if (violation.type === 'same_job_cooldown') {
            errorMessage = `You've already applied to this job recently. You can apply again after ${cooldownDate.toLocaleDateString()} (in ${daysUntil} days).`
          }
        }
        
        toast({
          title: 'Application Not Submitted',
          description: errorMessage,
          variant: 'destructive'
        })
        return
      }

      if (error) throw new Error(error.message || 'Submission failed')
      if (response?.fileUploadResults) {
        const failedUploads = response.fileUploadResults.filter((result: any) => !result.success)
        if (failedUploads.length > 0) {
          const failureMessages = failedUploads.map((result: any) => 
            `${result.fileName}: ${result.error}`
          ).join('; ')
          
          toast({
            title: 'Some files failed to upload',
            description: `Application submitted but these files had issues: ${failureMessages}`,
            variant: 'destructive'
          })
        } else {
          // All files uploaded successfully
          const successCount = response.fileUploadResults.filter((result: any) => result.success).length
          if (successCount > 0) {
            toast({
              title: 'Application submitted successfully',
              description: `Your application and ${successCount} file(s) have been uploaded successfully.`
            })
          }
        }
      }

      setShowConfirmationDialog(true)
    } catch (err) {
      console.error('Submit application error:', err)
      toast({
        title: 'Submission failed',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive'
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
      {/* Header with logo and back button */}
      <header className={`fixed top-0 left-0 right-0 z-50 border-b border-border transition-shadow supports-[backdrop-filter]:bg-surface-primary/60 bg-surface-primary/90 backdrop-blur ${scrolled ? 'shadow-sm' : ''}`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between px-md py-2 sm:px-lg">
          <div className="flex items-center gap-4">
            {companySlug && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/careers/${companySlug}`)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Careers Page
              </Button>
            )}
          </div>
          <GoGioLogo className="h-6 w-auto" />
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
                  {(tenantAbout || posting.description) && (
                    <Card>
                      <CardContent className="space-y-6">
                        {/* Tenant About comes first for company context */}
                        {tenantAbout && (
                          <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-text-primary">
                              About {organizationName}
                            </h3>
                            <SafeHtml 
                              content={tenantAbout} 
                              className="prose prose-sm text-text-secondary max-w-none" 
                            />
                          </div>
                        )}
                        
                        {/* Subtle separator if both exist */}
                        {tenantAbout && posting.description && (
                          <div className="border-t border-border/50 my-6" />
                        )}
                        
                        {/* Job description */}
                        {posting.description && (
                          <SafeHtml 
                            content={posting.description} 
                            className="prose prose-sm text-text-secondary max-w-none" 
                          />
                        )}
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
              <div className="order-2 lg:order-1 lg:col-span-2 space-y-6">
                {/* Application Limits Banner */}
                <Alert className="border-info bg-info/5">
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Application Limits:</strong> To ensure candidates select the most relevant positions, we have set limits:
                    <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
                      <li>Maximum 3 applications per 60 days</li>
                      <li>Cannot re-apply to same role within 90 days</li>
                      <li>30-day cooldown after rejection before applying to other roles</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <section aria-labelledby="application-form">
                  <Card>
                    <CardHeader>
                      <CardTitle id="application-form">Application Form</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      {/* Core Fields Section */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
                        <div className="space-y-4">
                          {/* Resume Upload Field - FIRST */}
                          <div>
                            <label className="text-sm font-medium">
                              Resume/CV <Badge variant="secondary" className="ml-2">Required</Badge>
                            </label>
                            <div className="mt-1">
                              <EnhancedResumeDropzone
                                onParsed={handleParsedData}
                                isUploading={false}
                                autoGenerateSkills={false}
                                showUpload={false}
                                parseOnly={true}
                                useTwoStageAI={true}
                                onFileCaptured={(file) => setUploadedFiles([file])}
                                onResumeTextCaptured={(text) => setCapturedResumeText(text)}
                              />
                              {uploadedFiles[0] && (
                                <p className="mt-2 text-xs text-text-secondary">Selected: {uploadedFiles[0].name}</p>
                              )}
                            </div>
                          </div>

                          {/* Name Field */}
                          <div>
                            <label className="text-sm font-medium">
                              Full Name <Badge variant="secondary" className="ml-2">Required</Badge>
                            </label>
                            <Input
                              placeholder="Your full name"
                              value={coreFieldValues.candidate_name}
                              onChange={(e) => setCoreFieldValues(prev => ({ ...prev, candidate_name: e.target.value }))}
                            />
                          </div>
                          
                          {/* Email Field */}
                          <div>
                            <label className="text-sm font-medium">
                              Email <Badge variant="secondary" className="ml-2">Required</Badge>
                            </label>
                            <Input
                              type="email"
                              placeholder="your.email@example.com"
                              value={coreFieldValues.email}
                              onChange={(e) => setCoreFieldValues(prev => ({ ...prev, email: e.target.value }))}
                              className={coreFieldValues.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coreFieldValues.email.trim()) ? 'border-destructive focus-visible:ring-destructive' : ''}
                            />
                            {coreFieldValues.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coreFieldValues.email.trim()) && (
                              <p className="text-xs text-destructive mt-1">Please enter a valid email address</p>
                            )}
                          </div>
                          
                          {/* Phone Field */}
                          <div>
                            <label className="text-sm font-medium">Phone</label>
                            <Input
                              type="tel"
                              placeholder="Your phone number"
                              value={coreFieldValues.phone}
                              onChange={(e) => setCoreFieldValues(prev => ({ ...prev, phone: e.target.value }))}
                            />
                          </div>
                          
                          {/* LinkedIn Field */}
                          <div>
                            <label className="text-sm font-medium">LinkedIn Profile</label>
                            <Input
                              type="url"
                              placeholder="https://linkedin.com/in/yourprofile"
                              value={coreFieldValues.linkedin_url}
                              onChange={(e) => setCoreFieldValues(prev => ({ ...prev, linkedin_url: e.target.value }))}
                            />
                          </div>
                          
                        </div>
                      </div>

                      {/* Custom Fields Section */}
                      {customFields.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Additional Questions</h3>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {customFields.map((field) => (
                              <div
                                key={field.id}
                                style={{ gridColumn: `span ${field.column_span || 4} / span ${field.column_span || 4}` }}
                              >
                                <Label className="text-sm font-medium">
                                  {field.field_label}
                                  {field.is_required && <Badge variant="secondary" className="ml-2">Required</Badge>}
                                </Label>
                                <div className="mt-1">
                                  {field.field_type === 'text' && (
                                    <Input
                                      placeholder={field.placeholder_text || ''}
                                      value={customFieldResponses[field.id] || ''}
                                      onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: e.target.value }))}
                                    />
                                  )}
                                  {field.field_type === 'email' && (
                                    <Input
                                      type="email"
                                      placeholder={field.placeholder_text || ''}
                                      value={customFieldResponses[field.id] || ''}
                                      onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: e.target.value }))}
                                    />
                                  )}
                                  {field.field_type === 'number' && (
                                    <Input
                                      type="number"
                                      placeholder={field.placeholder_text || ''}
                                      value={customFieldResponses[field.id] || ''}
                                      onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: e.target.value }))}
                                    />
                                  )}
                                  {field.field_type === 'url' && (
                                    <Input
                                      type="url"
                                      placeholder={field.placeholder_text || 'https://'}
                                      value={customFieldResponses[field.id] || ''}
                                      onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: e.target.value }))}
                                    />
                                  )}
                                  {field.field_type === 'textarea' && (
                                    <Textarea
                                      placeholder={field.placeholder_text || ''}
                                      rows={4}
                                      value={customFieldResponses[field.id] || ''}
                                      onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: e.target.value }))}
                                    />
                                  )}
                                  {field.field_type === 'select' && (
                                    <Select
                                      value={customFieldResponses[field.id] || ''}
                                      onValueChange={(value) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: value }))}
                                    >
                                      <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                                      <SelectContent>
                                        {(options[field.id] || []).map((option) => (
                                          <SelectItem key={option.id} value={option.option_value}>
                                            {option.option_label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                  {field.field_type === 'checkbox' && (
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={customFieldResponses[field.id] === 'true'}
                                        onCheckedChange={(checked) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: checked ? 'true' : 'false' }))}
                                      />
                                      <span className="text-sm text-muted-foreground">I acknowledge</span>
                                    </div>
                                  )}
                                  {field.field_type === 'checkbox_group' && (
                                    <div className="space-y-2">
                                      {(options[field.id] || []).map((option) => {
                                        const selected: string[] = customFieldResponses[field.id] ? JSON.parse(customFieldResponses[field.id]) : []
                                        const isChecked = selected.includes(option.option_value)
                                        return (
                                          <div key={option.id} className="flex items-center gap-2">
                                            <Checkbox
                                              checked={isChecked}
                                              onCheckedChange={(checked) => {
                                                const next = checked
                                                  ? [...selected, option.option_value]
                                                  : selected.filter(v => v !== option.option_value)
                                                setCustomFieldResponses(prev => ({ ...prev, [field.id]: JSON.stringify(next) }))
                                              }}
                                            />
                                            <span className="text-sm">{option.option_label}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                  {field.field_type === 'date' && (
                                    <Input
                                      type="date"
                                      value={customFieldResponses[field.id] || ''}
                                      onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: e.target.value }))}
                                    />
                                  )}
                                  {field.field_type === 'file' && (
                                    <Input type="file" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-4">
                        <Button 
                          type="button" 
                          onClick={handleSubmitApplication} 
                          className="w-full sm:w-auto" 
                          aria-label="Submit application" 
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Submitting…
                            </span>
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
          <GoGioLogo className="h-5 w-auto" />
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
