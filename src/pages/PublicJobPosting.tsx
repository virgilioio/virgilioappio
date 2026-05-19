
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { SafeHtml } from '@/components/ui/safe-html'
import { MapPin, Briefcase, DollarSign, Loader2, Linkedin, Users, Sparkles, Clock as ClockIcon } from 'lucide-react'
import { CareersTopBar } from '@/components/careers/public/CareersTopBar'
import { CareersFooter } from '@/components/careers/public/CareersFooter'
import { JobHeader } from '@/components/careers/public/job/JobHeader'
import { JobBodySection, JobBulletList } from '@/components/careers/public/job/JobBodySection'
import { JobProcessList } from '@/components/careers/public/job/JobProcessList'
import { JobAsideReplyCard } from '@/components/careers/public/job/JobAsideReplyCard'
import { JobAsideSummary } from '@/components/careers/public/job/JobAsideSummary'
import { JobAsideHiringPanel, type PanelMember } from '@/components/careers/public/job/JobAsideHiringPanel'
import { JobAsideReferral } from '@/components/careers/public/job/JobAsideReferral'
import { JobCTABand } from '@/components/careers/public/job/JobCTABand'
import { format as formatDate } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { sanitizeHtmlForEditor } from '@/utils/htmlSanitizer'
import { markdownToHtml } from '@/utils/markdown'
import { format } from 'date-fns'
import { EnhancedResumeDropzone, type ParsedResumeData } from '@/components/candidates/EnhancedResumeDropzone'
import { ApplicationConfirmationDialog } from '@/components/candidates/ApplicationConfirmationDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Clock, Shield } from 'lucide-react'
import { useCoreFields } from '@/hooks/useCoreFields'
import { CoreFieldsRenderer } from '@/components/forms/CoreFieldsRenderer'
import { ApplicationFieldsRenderer } from '@/components/forms/ApplicationFieldsRenderer'
import { PhoneInput } from '@/components/ui/phone-input'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { sanitizeToE164 } from '@/utils/phoneUtils'

function getViolationToast(violation: { type?: string; message?: string; cooldown_until?: string }) {
  const cooldownDate = violation.cooldown_until ? new Date(violation.cooldown_until) : null
  const daysUntil = cooldownDate
    ? Math.max(1, Math.ceil((cooldownDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  switch (violation.type) {
    case 'same_job_cooldown':
      return {
        title: 'Already Applied',
        description: cooldownDate
          ? `You've already applied to this position. You can reapply after ${cooldownDate.toLocaleDateString()} (in ${daysUntil} day${daysUntil === 1 ? '' : 's'}).`
          : "You've already applied to this position recently."
      }
    case 'max_applications_exceeded':
      return {
        title: 'Application Limit Reached',
        description: "You've reached the maximum number of applications allowed. Please try again later."
      }
    case 'rejection_cooldown':
      return {
        title: 'Please Wait to Reapply',
        description: cooldownDate
          ? `You can submit a new application after ${cooldownDate.toLocaleDateString()} (in ${daysUntil} day${daysUntil === 1 ? '' : 's'}).`
          : 'Please wait before submitting a new application.'
      }
    default:
      return {
        title: 'Application Not Submitted',
        description: violation.message || 'Your application could not be submitted at this time.'
      }
  }
}

type FieldType = 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'checkbox_group' | 'date' | 'file' | 'url' | 'salary' | 'location' | 'phone' | 'recruiter' | 'employment_type' | 'work_location' | 'linkedin'

interface Posting {
  id: string
  job_id: string
  title: string
  slug: string
  description: string | null
  details: any | null
  created_at?: string
}

interface PostingField {
  id: string
  field_label: string
  field_type: FieldType
  is_required: boolean
  placeholder_text?: string | null
  column_span?: number | null
  field_name?: string | null
  field_config?: any | null
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
  // useNavigate previously used by old header; no longer needed
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
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)
  const [companyWebsiteUrl, setCompanyWebsiteUrl] = useState<string | null>(null)
  const [tenantAbout, setTenantAbout] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !slug) return false
    return window.localStorage.getItem(`gio:saved-job:${slug}`) === '1'
  })
  
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
          slug,
          description,
          details,
          tenant_id,
          created_at
        `)
        .eq('slug', slug)
        .maybeSingle()
      if (!p) {
        setPosting(null)
        setLoading(false)
        return
      }
      setPosting(p as unknown as Posting)
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
        .select('company_slug, logo_url, company_website_url')
        .eq('tenant_id', (p as any).tenant_id)
        .eq('is_active', true)
        .maybeSingle()
      
      if (careersSettings) {
        setCompanySlug(careersSettings.company_slug)
        setCompanyLogoUrl((careersSettings as any).logo_url ?? null)
        setCompanyWebsiteUrl((careersSettings as any).company_website_url ?? null)
      }

      const { data: f } = await supabase
        .from('job_posting_application_fields')
        .select('id, field_label, field_type, is_required, placeholder_text, column_span, field_name, field_config')
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
        phone: (parsed.phone ? sanitizeToE164(parsed.phone) : '') || prev.phone,
        linkedin_url: parsed.linkedinUrl || prev.linkedin_url,
        profile_summary: profileSummary
      }
    })
  }

  function JobDetailsCard({ details, className }: { className?: string; details: { location: string | null; employmentType: string | null; locationType: string | null; salaryCurrency: string | null; salaryAmount: number | null; salaryPeriod: string | null; showSalary: boolean; hasCommissions: boolean; commissionsCurrency: string | null; commissionsAmount: number | null; } }) {
    return (
      <Card className={className}>
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
      let salarySync: { amount: number; currency: string; period: string } | null = null
      let locationSync: { city?: string; state?: string; country?: string } | null = null
      let phoneSync: string | null = null
      let linkedinSync: string | null = null
      Object.entries(customFieldResponses).forEach(([fieldId, value]) => {
        const field = customFields.find(f => f.id === fieldId)
        if (field?.field_name) {
          mappedCustomFields[field.field_name] = value
        }
        // Detect salary field for candidate profile sync
        if (field?.field_type === 'salary' && value) {
          const config = field.field_config || {}
          salarySync = {
            amount: parseFloat(value as string),
            currency: config.currency || 'USD',
            period: config.period || 'annually'
          }
        }
        // Detect location field for candidate profile sync
        if (field?.field_type === 'location' && value) {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value
            locationSync = {
              city: parsed.city || undefined,
              state: parsed.state || undefined,
              country: parsed.country || undefined
            }
          } catch { /* ignore parse errors */ }
        }
        // Detect phone field for candidate profile sync
        if ((field?.field_type as string) === 'phone' && value) {
          phoneSync = value as string
        }
        // Detect linkedin field for candidate profile sync
        if (field?.field_type === 'linkedin' && value) {
          linkedinSync = value as string
        }
      })

      // Prepare application data in the format expected by the edge function
      const applicationData = {
        ...coreFieldValues,
        resumeText: capturedResumeText, // For server-side AI enrichment
        custom_fields: mappedCustomFields, // Use field names instead of IDs
        uploadedFiles: resumeBase64 ? [{ name: resumeFile!.name, data: resumeBase64, type: resumeFile!.type, size: resumeFile!.size }] : [],
        posting_id: posting.id,
        salary_sync: salarySync,
        location_sync: locationSync,
        phone_sync: phoneSync,
        linkedin_sync: linkedinSync
      }

      const { data, error } = await supabase.functions.invoke('public-submit-application', {
        body: applicationData
      })

      // Check for application limit violations from both data and error paths
      const response = (data as any) || (error ? (() => { try { return JSON.parse(error.message); } catch { return null; } })() : null)
      if (!response?.success && response?.violations?.length > 0) {
        const violation = response.violations[0]
        const { title: violationTitle, description: violationDesc } = getViolationToast(violation)
        
        toast({
          title: violationTitle,
          description: violationDesc,
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
        title: 'Unable to submit application',
        description: 'Please check your connection and try again. If the problem persists, contact the employer directly.',
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

  // ---- Derive editorial layout data from existing schema ----
  const splitTitle = (full: string): { main: string; sub: string | null } => {
    const m = full.split(/\s+[—–-]\s+|:\s+/)
    if (m.length >= 2) return { main: m[0].trim(), sub: m.slice(1).join(' — ').trim() }
    return { main: full, sub: null }
  }
  const { main: titleMain, sub: titleSub } = splitTitle(posting.title)

  const d: any = posting.details || {}
  const department: string | null = d.department || null
  const featured: boolean = !!d.featured
  const sections = d.sections || {}
  const responsibilities: string[] = Array.isArray(sections.responsibilities) ? sections.responsibilities : []
  const qualifications: string[] = Array.isArray(sections.qualifications) ? sections.qualifications : []
  const niceToHaves: string[] = Array.isArray(sections.nice_to_haves) ? sections.nice_to_haves : []
  const benefits: string[] = Array.isArray(sections.benefits) ? sections.benefits : []
  const hiringProcess: Array<{ title: string; detail?: string }> = Array.isArray(sections.hiring_process)
    ? sections.hiring_process.map((s: any) =>
        typeof s === 'string' ? { title: s } : { title: s.title || '', detail: s.detail }
      )
    : []
  const hiringPanel: PanelMember[] = Array.isArray(d.hiring_panel) ? d.hiring_panel : []
  const referralBonus = d.referral_bonus || null
  const reportsTo: string | null = d.reports_to || null
  const referenceCode: string | null = d.reference_code || null
  const teamSize: number | null = typeof d.team_size === 'number' ? d.team_size : null
  const equityNote: string | null = d.equity_note || null
  const eeoStatement: string | null = d.eeo_statement || null

  const compensationLabel = (() => {
    if (!details.showSalary || !details.salaryAmount) return null
    return `${details.salaryCurrency || ''} ${Number(details.salaryAmount).toLocaleString()}${
      details.salaryPeriod ? ' ' + formatLabel(details.salaryPeriod) : ''
    }`.trim()
  })()

  const metaChips: { icon?: any; label: string }[] = []
  if (details.location || details.locationType) {
    metaChips.push({
      icon: MapPin,
      label: [details.location, formatLabel(details.locationType)].filter(Boolean).join(' · '),
    })
  }
  if (details.employmentType) metaChips.push({ icon: Briefcase, label: formatLabel(details.employmentType)! })
  if (compensationLabel) metaChips.push({ icon: DollarSign, label: compensationLabel + ' base' })
  if (equityNote) metaChips.push({ icon: Sparkles, label: equityNote })
  if (teamSize) metaChips.push({ icon: Users, label: `Team of ${teamSize}` })
  metaChips.push({ icon: ClockIcon, label: 'Reply in < 48h' })

  const careersHref = companySlug ? `/careers/${companySlug}` : null

  const handleShare = async () => {
    const url = window.location.href
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: posting.title, url }) } catch { /* dismissed */ }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Link copied', description: 'Job link copied to clipboard.' })
    } catch {
      toast({ title: 'Unable to copy', description: 'Copy the URL from your browser bar.' })
    }
  }

  const savedKey = `gio:saved-job:${slug}`
  const handleSave = () => {
    const next = !isSaved
    setIsSaved(next)
    if (typeof window !== 'undefined') {
      if (next) window.localStorage.setItem(savedKey, '1')
      else window.localStorage.removeItem(savedKey)
    }
    toast({ title: next ? 'Saved for later' : 'Removed from saved' })
  }

  const summaryRows = [
    { label: 'Posted', value: posting.created_at ? formatDate(new Date(posting.created_at), 'MMM d, yyyy') : null },
    { label: 'Location', value: details.location || null },
    { label: 'Type', value: formatLabel(details.employmentType) || null },
    { label: 'Compensation', value: compensationLabel },
    { label: 'Reports to', value: reportsTo },
    { label: 'Ref', value: referenceCode },
  ]

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col">
      <CareersTopBar
        logoUrl={companyLogoUrl}
        companyName={organizationName || 'Company'}
        websiteUrl={companyWebsiteUrl}
        showCompanyName
      />

      <JobHeader
        careersHref={careersHref}
        department={department}
        title={titleMain}
        subtitle={titleSub}
        featured={featured}
        metaChips={metaChips}
        onApply={handleApplyClick}
        onShare={handleShare}
        onSave={handleSave}
        saved={isSaved}
      />

      <main className="flex-1 w-full">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'overview' | 'application')} className="space-y-8">
          {/* Tab switcher kept accessible but visually minimal */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            <TabsList className="bg-transparent p-0 h-auto gap-2">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-white data-[state=active]:text-[#0d0d09] data-[state=active]:border-black/10 border border-transparent rounded-lg h-8 px-3 text-[12.5px]"
              >
                Job overview
              </TabsTrigger>
              <TabsTrigger
                value="application"
                className="data-[state=active]:bg-white data-[state=active]:text-[#0d0d09] data-[state=active]:border-black/10 border border-transparent rounded-lg h-8 px-3 text-[12.5px]"
              >
                Application
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-7 space-y-10 order-2 lg:order-1">
                {posting.description && (
                  <JobBodySection title="About the role">
                    <SafeHtml
                      content={posting.description}
                      className="prose prose-sm max-w-none text-[#3f4451] [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_li]:my-1"
                    />
                  </JobBodySection>
                )}

                {responsibilities.length > 0 && (
                  <JobBodySection title="What you'll do">
                    <JobBulletList items={responsibilities} />
                  </JobBodySection>
                )}
                {qualifications.length > 0 && (
                  <JobBodySection title="You'll thrive if">
                    <JobBulletList items={qualifications} />
                  </JobBodySection>
                )}
                {niceToHaves.length > 0 && (
                  <JobBodySection title="Nice to have">
                    <JobBulletList items={niceToHaves} />
                  </JobBodySection>
                )}
                {benefits.length > 0 && (
                  <JobBodySection title="What we offer">
                    <JobBulletList items={benefits} />
                  </JobBodySection>
                )}
                {hiringProcess.length > 0 && (
                  <JobBodySection title="The process">
                    <JobProcessList steps={hiringProcess} />
                  </JobBodySection>
                )}

                {tenantAbout && (
                  <JobBodySection title={`About ${organizationName}`}>
                    <SafeHtml
                      content={tenantAbout}
                      className="prose prose-sm max-w-none text-[#3f4451] [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_li]:my-1"
                    />
                  </JobBodySection>
                )}

                <p className="text-[12.5px] text-[#8B8F9E] leading-relaxed border-t border-black/5 pt-6">
                  {eeoStatement ||
                    `${organizationName} is an equal opportunity employer. We don't discriminate on the basis of race, religion, gender, sexual orientation, age, disability, or veteran status. We're committed to building a team that reflects the breadth of our customers.`}
                </p>
              </div>

              <aside className="lg:col-span-5 order-1 lg:order-2 space-y-4 lg:sticky lg:top-6 self-start">
                <JobAsideReplyCard onApply={handleApplyClick} />
                <JobAsideSummary rows={summaryRows} />
                <JobAsideHiringPanel members={hiringPanel} />
                <JobAsideReferral
                  slug={posting.slug}
                  amount={referralBonus?.amount ?? null}
                  currency={referralBonus?.currency ?? null}
                />
              </aside>
            </div>

            <JobCTABand onApply={handleApplyClick} />
          </TabsContent>

          <TabsContent value="application">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="order-2 lg:order-1 lg:col-span-2">
                <section aria-labelledby="application-form">
                  <div className="space-y-12">
                    {/* Application limits — demoted to a small helper line */}
                    <p id="application-form" className="text-xs text-text-secondary">
                      Application limits: max 3 applications per 60 days · cannot re-apply to the same role within 90 days · 30-day cooldown after rejection.
                    </p>

                    {/* Core Fields Section */}
                    <div>
                      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary mb-6">Basic Information</h3>
                      <div className="space-y-6">
                        {/* Resume Upload Field - FIRST */}
                        <div>
                          <label className="text-[13px] font-semibold text-text-primary">
                            Resume/CV<span className="text-destructive ml-1">*</span>
                          </label>
                          <div className="mt-2">
                            <EnhancedResumeDropzone
                              variant="minimal"
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
                          <label className="text-[13px] font-semibold text-text-primary">
                            Full Name<span className="text-destructive ml-1">*</span>
                          </label>
                          <Input
                            placeholder="Your full name"
                            value={coreFieldValues.candidate_name}
                            onChange={(e) => setCoreFieldValues(prev => ({ ...prev, candidate_name: e.target.value }))}
                            className="mt-2 h-11 text-[15px]"
                          />
                        </div>

                        {/* Email Field */}
                        <div>
                          <label className="text-[13px] font-semibold text-text-primary">
                            Email<span className="text-destructive ml-1">*</span>
                          </label>
                          <Input
                            type="email"
                            placeholder="your.email@example.com"
                            value={coreFieldValues.email}
                            onChange={(e) => setCoreFieldValues(prev => ({ ...prev, email: e.target.value }))}
                            className={`mt-2 h-11 text-[15px] ${coreFieldValues.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coreFieldValues.email.trim()) ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                          />
                          {coreFieldValues.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coreFieldValues.email.trim()) && (
                            <p className="text-xs text-destructive mt-1">Please enter a valid email address</p>
                          )}
                        </div>

                        {/* Phone Field */}
                        <div>
                          <label className="text-[13px] font-semibold text-text-primary">Phone</label>
                          <Input
                            type="tel"
                            placeholder="Your phone number"
                            value={coreFieldValues.phone}
                            onChange={(e) => setCoreFieldValues(prev => ({ ...prev, phone: e.target.value }))}
                            className="mt-2 h-11 text-[15px]"
                          />
                        </div>

                        {/* LinkedIn Field */}
                        <div>
                          <label className="text-[13px] font-semibold text-text-primary">LinkedIn Profile</label>
                          <Input
                            type="url"
                            placeholder="https://linkedin.com/in/yourprofile"
                            value={coreFieldValues.linkedin_url}
                            onChange={(e) => setCoreFieldValues(prev => ({ ...prev, linkedin_url: e.target.value }))}
                            className="mt-2 h-11 text-[15px]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Custom Fields Section */}
                    {customFields.length > 0 && (
                      <div>
                        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary mb-6">Additional Questions</h3>
                        <div className="space-y-6">
                          {customFields.filter(field => field.field_type !== 'recruiter').map((field) => (
                            <div key={field.id}>
                              <Label className="text-[13px] font-semibold text-text-primary">
                                {field.field_label}
                                {field.is_required && <span className="text-destructive ml-1">*</span>}
                              </Label>
                              <div className="mt-2">
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
                                    <DatePickerVirgilio
                                      value={customFieldResponses[field.id] ? new Date(customFieldResponses[field.id] + 'T00:00:00') : undefined}
                                      onChange={(date) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: format(date, 'yyyy-MM-dd') }))}
                                      placeholder="Pick a date"
                                    />
                                  )}
                                  {field.field_type === 'file' && (
                                    <Input type="file" />
                                  )}
                                  {field.field_type === 'salary' && (() => {
                                    const config = field.field_config || {}
                                    const currency = config.currency || 'USD'
                                    const period = config.period || 'annually'
                                    return (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="shrink-0">{currency}</Badge>
                                          <Input
                                            type="number"
                                            placeholder="Enter amount"
                                            value={customFieldResponses[field.id] || ''}
                                            onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: e.target.value }))}
                                          />
                                          <Badge variant="secondary" className="shrink-0 capitalize">{period}</Badge>
                                        </div>
                                        <p className="text-xs text-green-600">Syncs to your candidate profile</p>
                                      </div>
                                    )
                                  })()}
                                  {field.field_type === 'location' && (() => {
                                    const config = field.field_config || {}
                                    const locationSubFields = config.fields || ['city', 'state', 'country']
                                    const locationValue = (() => {
                                      try {
                                        return customFieldResponses[field.id]
                                          ? JSON.parse(customFieldResponses[field.id])
                                          : {}
                                      } catch { return {} }
                                    })()
                                    const updateLocation = (key: string, val: string) => {
                                      const next = { ...locationValue, [key]: val }
                                      setCustomFieldResponses(prev => ({
                                        ...prev,
                                        [field.id]: JSON.stringify(next)
                                      }))
                                    }
                                    return (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span className="text-xs text-green-600">Syncs to your candidate profile</span>
                                        </div>
                                        <div className={`grid grid-cols-1 ${({ 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' } as Record<number, string>)[locationSubFields.length] || 'md:grid-cols-3'} gap-3`}>
                                          {locationSubFields.includes('city') && (
                                            <Input
                                              placeholder="City"
                                              value={locationValue.city || ''}
                                              onChange={(e) => updateLocation('city', e.target.value)}
                                            />
                                          )}
                                          {locationSubFields.includes('state') && (
                                            <Input
                                              placeholder="State / Province"
                                              value={locationValue.state || ''}
                                              onChange={(e) => updateLocation('state', e.target.value)}
                                            />
                                          )}
                                          {locationSubFields.includes('country') && (
                                            <Input
                                              placeholder="Country"
                                              value={locationValue.country || ''}
                                              onChange={(e) => updateLocation('country', e.target.value)}
                                            />
                                          )}
                                        </div>
                                        <p className="text-xs text-green-600">Syncs to your candidate profile</p>
                                      </div>
                                    )
                                  })()}
                                  {(field.field_type as string) === 'phone' && (() => {
                                    const config = field.field_config || {}
                                    const defaultCountry = (config as any).defaultCountryCode || '+1'
                                    return (
                                      <div className="space-y-2">
                                        <PhoneInput
                                          value={customFieldResponses[field.id] || defaultCountry}
                                          onChange={(val) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: val }))}
                                          placeholder="Enter phone number"
                                        />
                                        <p className="text-xs text-green-600">Syncs to your candidate profile</p>
                                      </div>
                                    )
                                  })()}
                                  {field.field_type === 'linkedin' && (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <Linkedin className="h-4 w-4 text-sky-600 shrink-0" />
                                        <Input
                                          type="url"
                                          placeholder="https://linkedin.com/in/yourprofile"
                                          value={customFieldResponses[field.id] || ''}
                                          onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: e.target.value }))}
                                        />
                                      </div>
                                      <p className="text-xs text-green-600">Syncs to your candidate profile</p>
                                    </div>
                                  )}
                                  {field.field_type === 'employment_type' && (
                                    <Select
                                      value={customFieldResponses[field.id] || ''}
                                      onValueChange={(value) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: value }))}
                                    >
                                      <SelectTrigger><SelectValue placeholder="Select employment type" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="full_time">Full-time</SelectItem>
                                        <SelectItem value="part_time">Part-time</SelectItem>
                                        <SelectItem value="temporary">Temporary</SelectItem>
                                        <SelectItem value="internship">Internship</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                  {field.field_type === 'work_location' && (
                                    <Select
                                      value={customFieldResponses[field.id] || ''}
                                      onValueChange={(value) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: value }))}
                                    >
                                      <SelectTrigger><SelectValue placeholder="Select work location" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="remote">Remote</SelectItem>
                                        <SelectItem value="hybrid">Hybrid</SelectItem>
                                        <SelectItem value="onsite">On-site</SelectItem>
                                      </SelectContent>
                                    </Select>
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
                        className="w-full sm:w-auto h-11 px-8 text-base font-semibold" 
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
                  </div>
                </section>
              </div>

              <aside className="order-1 lg:order-2 lg:col-span-1 lg:sticky lg:top-24 space-y-4 self-start">
                <JobDetailsCard details={details} className="border-border/60 shadow-none rounded-xl" />
              </aside>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <CareersFooter
        companyName={organizationName || 'Company'}
        logoUrl={companyLogoUrl}
        websiteUrl={companyWebsiteUrl}
      />
      
      <ApplicationConfirmationDialog
        open={showConfirmationDialog}
        onOpenChange={setShowConfirmationDialog}
        roleName={posting?.title || 'this position'}
        organizationName={organizationName}
      />
    </div>
  )
}
