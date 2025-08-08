import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { CandidateAttachments } from '@/components/candidates/CandidateAttachments'
import { CandidateComments } from '@/components/candidates/CandidateComments'
import { CandidateUrls } from '@/components/candidates/CandidateUrls'
import { CandidateWorkExperienceComponent } from '@/components/candidates/CandidateWorkExperience'
import { CandidateEducationComponent } from '@/components/candidates/CandidateEducationComponent'
import { useCandidateEnrichment } from '@/hooks/useCandidateEnrichment'
import { ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'

interface CandidateProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string | null
  jobId: string
}

export default function CandidateProfileSheet({ open, onOpenChange, candidateId, jobId }: CandidateProfileSheetProps) {
  const { organizationId } = useAuth()
  const [loading, setLoading] = useState(false)
  const [candidate, setCandidate] = useState<any | null>(null)
  const [jobCandidate, setJobCandidate] = useState<any | null>(null)
  const [jobCandidateId, setJobCandidateId] = useState<string | null>(null)
  const [job, setJob] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'notes'>('overview')
  const { workExperience, education, fetchCandidateEnrichmentData } = useCandidateEnrichment()

  useEffect(() => {
    const load = async () => {
      if (!open || !candidateId) return
      setLoading(true)
      try {
        const { data } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', candidateId)
          .single()
        setCandidate(data || null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, candidateId])

  useEffect(() => {
    if (open && candidateId) {
      fetchCandidateEnrichmentData(candidateId)
    }
  }, [open, candidateId, fetchCandidateEnrichmentData])

  useEffect(() => {
    const loadRelated = async () => {
      if (!open || !candidate || !jobId) return
      // Load job info
      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, title')
        .eq('id', jobId)
        .maybeSingle()
      setJob(jobData || null)

      // Resolve job candidate (record in job_candidates)
      let jc: any | null = null
      if (candidate.linkedin_url) {
        const { data } = await supabase
          .from('job_candidates')
          .select('*')
          .eq('job_id', jobId)
          .eq('linkedin_url', candidate.linkedin_url)
          .maybeSingle()
        jc = data || null
      }
      if (!jc) {
        const { data } = await supabase
          .from('job_candidates')
          .select('*')
          .eq('job_id', jobId)
          .eq('candidate_name', candidate.candidate_name)
          .maybeSingle()
        jc = data || null
      }
      if (jc) {
        setJobCandidate(jc)
        setJobCandidateId(jc.id)
      } else {
        setJobCandidate(null)
        setJobCandidateId(null)
      }
    }
    loadRelated()
  }, [open, candidate, jobId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[80vw] sm:max-w-none h-full p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="p-6 border-b">
            <SheetTitle className="text-xl flex items-center gap-3">
              <span>{candidate?.candidate_name || 'Candidate'}</span>
              {candidate?.status && <Badge variant="secondary">{candidate.status}</Badge>}
            </SheetTitle>
            {candidate?.linkedin_url && (
              <a
                href={candidate.linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary text-sm inline-flex items-center gap-1"
              >
                <ExternalLink className="w-4 h-4" /> View LinkedIn
              </a>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-text-secondary text-sm">Loading profile…</div>
            ) : !candidate ? (
              <div className="text-text-secondary text-sm">No data available.</div>
            ) : (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'overview' | 'notes')}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left column (2x) */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Name Card with tabs */}
                    <Card className="bg-surface-primary border-border">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <h2 className="text-2xl font-semibold text-text-primary truncate">{candidate.candidate_name}</h2>
                          {candidate.linkedin_url && (
                            <Button className="gap-sm" onClick={() => window.open(candidate.linkedin_url!, '_blank')}>
                              <ExternalLink className="h-4 w-4" /> LinkedIn
                            </Button>
                          )}
                        </div>
                        <div className="mt-4">
                          <TabsList>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="notes">Notes</TabsTrigger>
                          </TabsList>
                        </div>
                      </CardContent>
                    </Card>

                    {activeTab === 'overview' ? (
                      <>
                        {/* Candidate Information */}
                        <Card className="bg-surface-primary border-border">
                          <CardHeader>
                            <CardTitle className="text-lg">Candidate Information</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <div className="text-xs text-text-tertiary">Location</div>
                                <div className="text-sm text-text-primary">
                                  {[candidate.location_city, candidate.location_state, candidate.location_country]
                                    .filter(Boolean)
                                    .join(', ') || 'Not specified'}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-text-tertiary">Salary</div>
                                <div className="text-sm text-text-primary">
                                  {candidate.salary_amount ? `${candidate.salary_currency || 'USD'} ${Number(candidate.salary_amount).toLocaleString()} ${candidate.salary_period || ''}` : 'Not specified'}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-text-tertiary">Added</div>
                                <div className="text-sm text-text-primary">
                                  {new Date((jobCandidate?.created_at || candidate.created_at) as string).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Skills */}
                        <Card className="bg-surface-primary border-border">
                          <CardHeader>
                            <CardTitle className="text-lg">Skills</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {candidate.skills && candidate.skills.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {candidate.skills.map((s: string, i: number) => (
                                  <Badge key={`${s}-${i}`} variant="outline" className="text-xs">{s}</Badge>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-text-secondary">No skills specified</div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Profile Summary */}
                        <Card className="bg-surface-primary border-border">
                          <CardHeader>
                            <CardTitle className="text-lg">Profile Summary</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-text-primary whitespace-pre-wrap">{candidate.profile_summary || 'No summary available.'}</p>
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <Card className="bg-surface-primary border-border">
                        <CardHeader>
                          <CardTitle className="text-lg">Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {organizationId && jobCandidateId ? (
                            <CandidateComments candidateId={jobCandidateId} jobId={jobId} organizationId={organizationId} />
                          ) : (
                            <div className="text-sm text-text-secondary">No job candidate record linked for comments.</div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Right column (1x) */}
                  <div className="space-y-6">
                    {/* Quick Actions */}
                    <Card className="bg-surface-primary border-border">
                      <CardHeader>
                        <CardTitle className="text-lg">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2">
                        {candidate.linkedin_url && (
                          <Button variant="outline" className="justify-start gap-sm" onClick={() => window.open(candidate.linkedin_url!, '_blank')}>
                            <ExternalLink className="h-4 w-4" /> View LinkedIn
                          </Button>
                        )}
                        {jobCandidateId && (
                          <Link to={`/jobs/${jobId}/candidates/${jobCandidateId}`}>
                            <Button variant="outline" className="w-full justify-start">Open full profile</Button>
                          </Link>
                        )}
                      </CardContent>
                    </Card>

                    {/* Job Information */}
                    <Card className="bg-surface-primary border-border">
                      <CardHeader>
                        <CardTitle className="text-lg">Job Information</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-text-primary">{job?.title || '—'}</div>
                      </CardContent>
                    </Card>

                    {/* URLs */}
                    {jobCandidateId ? (
                      <CandidateUrls candidateId={jobCandidateId} />
                    ) : (
                      <Card className="bg-surface-primary border-border">
                        <CardHeader>
                          <CardTitle className="text-lg">URLs</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm text-text-secondary">No job candidate record linked.</div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Attachments */}
                    {jobCandidateId ? (
                      <CandidateAttachments candidateId={jobCandidateId} />
                    ) : (
                      <Card className="bg-surface-primary border-border">
                        <CardHeader>
                          <CardTitle className="text-lg">Attachments</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm text-text-secondary">No job candidate record linked.</div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </Tabs>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
