
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
import { MapPin, Briefcase, DollarSign } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

type FieldType = 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file' | 'url'

interface Posting {
  id: string
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
        .select('id,title,description,details')
        .eq('slug', slug)
        .maybeSingle()
      if (!p) {
        setPosting(null)
        setLoading(false)
        return
      }
      setPosting(p as Posting)

      const { data: f } = await supabase
        .from('job_posting_application_fields')
        .select('id, field_label, field_type, is_required, placeholder_text, column_span')
        .eq('posting_id', p.id)
        .order('display_order', { ascending: true })

      const fieldRows = (f || []) as PostingField[]
      setFields(fieldRows)

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
  
      const handleSubmitApplication = () => {
        toast({
          title: 'Application submitted',
          description: 'Thank you for applying. We will review your application.',
        })
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
              <div className="lg:col-span-2 space-y-8">
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

              <aside className="lg:col-span-1 lg:sticky lg:top-20 space-y-4">
                <JobDetailsCard details={details} />
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="application">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
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
                                {f.field_type === 'text' && <Input placeholder={f.placeholder_text || ''} />}
                                {f.field_type === 'url' && <Input type="url" placeholder={f.placeholder_text || 'https://'} />}
                                {f.field_type === 'email' && <Input type="email" placeholder={f.placeholder_text || ''} />}
                                {f.field_type === 'number' && <Input type="number" placeholder={f.placeholder_text || ''} />}
                                {f.field_type === 'textarea' && <Textarea placeholder={f.placeholder_text || ''} rows={4} />}
                                {f.field_type === 'checkbox' && (
                                  <div className="flex items-center gap-2">
                                    <Checkbox />
                                    <span className="text-sm text-muted-foreground">I acknowledge</span>
                                  </div>
                                )}
                                {f.field_type === 'select' && (
                                  <Select>
                                    <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                                    <SelectContent>
                                      {(options[f.id] || []).map((o) => (
                                        <SelectItem key={o.id} value={o.option_value}>{o.option_label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                {f.field_type === 'date' && <Input type="date" />}
                                {f.field_type === 'file' && <Input type="file" />}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="pt-4">
                        <Button type="button" onClick={handleSubmitApplication} className="w-full sm:w-auto" aria-label="Submit application">
                          Submit Application
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              </div>
              <aside className="lg:col-span-1 lg:sticky lg:top-20 space-y-4">
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
    </div>
  )
}
