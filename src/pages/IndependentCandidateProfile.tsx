import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, MapPin, DollarSign, Calendar, User, Edit, Zap, FileText, Mail, Phone, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'

import { PermissionGate } from '@/components/auth/PermissionGate'
import { AppContainer } from '@/components/layout/AppContainer'
import { useIndependentCandidates, IndependentCandidate } from '@/hooks/useIndependentCandidates'
import { IndependentCandidateForm } from '@/components/candidates/IndependentCandidateForm'
import { useCandidateEnrichment } from '@/hooks/useCandidateEnrichment'
import { EnrichmentPanel } from '@/components/candidates/EnrichmentPanel'
import { CandidateWorkExperienceComponent } from '@/components/candidates/CandidateWorkExperience'
import { CandidateEducationComponent } from '@/components/candidates/CandidateEducationComponent'
import { cn } from '@/lib/utils'
import { getSkillColor } from '@/utils/skillColors'
import { SafeHtml } from '@/components/ui/safe-html'
import AddToJobPipelineDialog from '@/components/candidates/AddToJobPipelineDialog'
import CandidateNameCard from '@/components/candidates/CandidateNameCard'
import { supabase } from '@/integrations/supabase/client'
import { CandidateResumeViewer } from '@/components/candidates/CandidateResumeViewer'
import { EnhancedResumeDropzone } from '@/components/candidates/EnhancedResumeDropzone'
import { CandidateComments } from '@/components/candidates/CandidateComments'
import { toast } from '@/hooks/use-toast'

export default function IndependentCandidateProfile() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const navigate = useNavigate()
  const [candidate, setCandidate] = useState<IndependentCandidate | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'resume' | 'details' | 'experience' | 'education' | 'comments'>('overview')
  const [isHired, setIsHired] = useState(false)
  
  const { 
    candidates, 
    isLoading: candidatesLoading, 
    updateCandidate,
    getCandidates
  } = useIndependentCandidates()

  const { 
    workExperience, 
    education, 
    fetchCandidateEnrichmentData 
  } = useCandidateEnrichment()

  // Navigation logic for previous/next candidates
  const currentCandidateIndex = candidates.findIndex(c => c.id === candidateId)
  const hasPreviousCandidate = currentCandidateIndex > 0
  const hasNextCandidate = currentCandidateIndex < candidates.length - 1
  const previousCandidate = hasPreviousCandidate ? candidates[currentCandidateIndex - 1] : null
  const nextCandidate = hasNextCandidate ? candidates[currentCandidateIndex + 1] : null

  const navigateToCandidate = (candidateId: string) => {
    // Force a full page refresh to ensure all state is properly reset
    console.log('🔄 Navigating to candidate:', candidateId)
    window.location.href = `/candidates/${candidateId}`
  }

  useEffect(() => {
    if (candidateId && candidates.length > 0) {
      const foundCandidate = candidates.find(c => c.id === candidateId)
      setCandidate(foundCandidate || null)
      
      // Load enrichment data if candidate is found
      if (foundCandidate) {
        fetchCandidateEnrichmentData(candidateId)
      }
    }
  }, [candidates, candidateId]) // Removed fetchCandidateEnrichmentData from dependencies since it's now memoized

  const handleEnrichmentComplete = async () => {
    // Refresh candidate data after enrichment
    await getCandidates()
    if (candidateId) {
      await fetchCandidateEnrichmentData(candidateId)
    }
  }

  useEffect(() => {
    if (!candidate) return
    ;(async () => {
      const { data } = await supabase
        .from('job_candidate_associations')
        .select('id')
        .eq('candidate_id', candidate.id)
        .eq('status', 'hired')
        .limit(1)
      setIsHired(!!(data && data.length > 0))
    })()
  }, [candidate])

  const handleEdit = () => {
    setIsFormOpen(true)
  }

  const handleFormSubmit = async (data: any) => {
    if (!candidate) return
    await updateCandidate(candidate.id, data)
    setIsFormOpen(false)
    // Refresh candidate data
    const updatedCandidate = candidates.find(c => c.id === candidateId)
    setCandidate(updatedCandidate || null)
  }

  const formatLocation = (candidate: IndependentCandidate) => {
    const parts = [candidate.location_city, candidate.location_state, candidate.location_country]
      .filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : 'Not specified'
  }

  const formatSalary = (candidate: IndependentCandidate) => {
    if (!candidate.salary_amount) return 'Not specified'
    
    const currency = candidate.salary_currency || 'USD'
    const amount = candidate.salary_amount.toLocaleString()
    const period = candidate.salary_period || 'annually'
    
  return `${currency} ${amount} ${period}`
  }

  const [isResumeUploading, setIsResumeUploading] = useState(false)
  const handleResumeUpload = async (file: File) => {
    if (!candidate) return
    setIsResumeUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `independent/${candidate.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: storageError } = await supabase.storage
        .from('candidate-attachments')
        .upload(path, file)
      if (storageError) throw storageError

      const { error: dbError } = await supabase
        .from('candidates')
        .update({ resume_url: path })
        .eq('id', candidate.id)
      if (dbError) throw dbError

      toast({ title: 'Resume uploaded', description: 'Resume updated successfully' })
      setCandidate({ ...candidate, resume_url: path })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload resume'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setIsResumeUploading(false)
    }
  }

  const replaceResumeInputRef = useRef<HTMLInputElement>(null)
  const handleReplaceResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void handleResumeUpload(file)
    }
    e.currentTarget.value = ''
  }
  const handleDeleteResume = async () => {
    if (!candidate) return
    try {
      if (candidate.resume_url && !/^https?:\/\//i.test(candidate.resume_url)) {
        await supabase.storage.from('candidate-attachments').remove([candidate.resume_url])
      }
      const { error: dbError } = await supabase
        .from('candidates')
        .update({ resume_url: null })
        .eq('id', candidate.id)
      if (dbError) throw dbError
      toast({ title: 'Resume deleted', description: 'The resume has been removed.' })
      setCandidate({ ...candidate, resume_url: null })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete resume'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    }
  }
  if (candidatesLoading) {
    return (
      <AuthGate>
        <PermissionGate permission="canViewCandidates">
          <AppContainer>
            <div className="space-y-md">
              <Skeleton className="h-[40px] w-[200px]" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
                <div className="lg:col-span-2 space-y-md">
                  <Skeleton className="h-[300px] rounded-brand" />
                </div>
                <div className="space-y-md">
                  <Skeleton className="h-[200px] rounded-brand" />
                </div>
              </div>
            </div>
          </AppContainer>
        </PermissionGate>
      </AuthGate>
    )
  }

  if (!candidate) {
    return (
      <AuthGate>
        <PermissionGate permission="canViewCandidates">
          <AppContainer>
            <div className="text-center py-xl">
              <h1 className="text-xl font-semibold text-text-primary mb-sm">Candidate not found</h1>
              <p className="text-text-secondary mb-md">The candidate you're looking for doesn't exist or you don't have access to it.</p>
              <Link to="/candidates">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-sm" />
                  Back to Candidates
                </Button>
              </Link>
            </div>
          </AppContainer>
        </PermissionGate>
      </AuthGate>
    )
  }

  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <AppContainer>
          {/* Navigation */}
          <div className="mb-lg flex items-center justify-between">
            <Link to="/candidates">
              <Button variant="ghost" className="gap-sm text-text-secondary hover:text-text-primary">
                <ArrowLeft className="h-4 w-4" />
                Back to Candidates
              </Button>
            </Link>

            {/* Navigation Arrows */}
            <div className="flex items-center gap-sm">
              <Button
                variant="ghost"
                className="gap-sm text-text-secondary hover:text-text-primary"
                onClick={() => previousCandidate && navigateToCandidate(previousCandidate.id)}
                disabled={!hasPreviousCandidate}
                title={previousCandidate ? `Previous: ${previousCandidate.candidate_name}` : 'No previous candidate'}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="ghost"
                className="gap-sm text-text-secondary hover:text-text-primary"
                onClick={() => nextCandidate && navigateToCandidate(nextCandidate.id)}
                disabled={!hasNextCandidate}
                title={nextCandidate ? `Next: ${nextCandidate.candidate_name}` : 'No next candidate'}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
            {/* Left Column - Header Card with Tab Bar */}
            <div className="lg:col-span-2 space-y-md">
              <CandidateNameCard
                name={candidate.candidate_name}
                linkedinUrl={candidate.linkedin_url}
                badgeText={isHired ? 'Hired' : candidate.status}
                subtitle={`Independent candidate • Added ${new Date(candidate.created_at).toLocaleDateString()}`}
                email={candidate.email}
                phone={candidate.phone}
                tabs={[
                  { value: 'overview', label: 'Overview', Icon: FileText },
                  { value: 'resume', label: 'Resume', Icon: FileText },
                  { value: 'experience', label: 'Experience', Icon: Zap },
                  { value: 'education', label: 'Education', Icon: User },
                  { value: 'details', label: 'Details', Icon: Calendar },
                  { value: 'comments', label: 'Comments', Icon: User },
                ]}
                activeTab={activeTab}
                onTabChange={(v) => setActiveTab(v as 'overview' | 'resume' | 'details' | 'experience' | 'education' | 'comments')}
                rightActions={
                  <>
                    <AddToJobPipelineDialog candidateId={candidate.id} />
                  </>
                }
              />

              {/* Contact Information Card - Overview Tab */}
              {activeTab === 'overview' && (
                <Card className="bg-surface-primary">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium text-text-primary">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-xl">
                      {candidate.email && (
                        <div className="flex items-start gap-md text-text-secondary">
                          <Mail className="h-5 w-5 mt-1 flex-shrink-0" />
                          <div className="space-y-1">
                            <span className="text-sm font-medium block">Email</span>
                            <a 
                              href={`mailto:${candidate.email}`}
                              className="text-text-primary text-base hover:text-primary hover:underline"
                            >
                              {candidate.email}
                            </a>
                          </div>
                        </div>
                      )}

                      {candidate.phone && (
                        <div className="flex items-start gap-md text-text-secondary">
                          <Phone className="h-5 w-5 mt-1 flex-shrink-0" />
                          <div className="space-y-1">
                            <span className="text-sm font-medium block">Phone</span>
                            <a 
                              href={`tel:${candidate.phone}`}
                              className="text-text-primary text-base hover:text-primary hover:underline"
                            >
                              {candidate.phone}
                            </a>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-md text-text-secondary">
                        <MapPin className="h-5 w-5 mt-1 flex-shrink-0" />
                        <div className="space-y-1">
                          <span className="text-sm font-medium block">Location</span>
                          <p className="text-text-primary text-base">{formatLocation(candidate)}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-md text-text-secondary">
                        <DollarSign className="h-5 w-5 mt-1 flex-shrink-0" />
                        <div className="space-y-1">
                          <span className="text-sm font-medium block">Salary Expectations</span>
                          <p className="text-text-primary text-base">{formatSalary(candidate)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Skills Card - Overview Tab */}
              {activeTab === 'overview' && candidate.skills && candidate.skills.length > 0 && (
                <Card className="bg-surface-primary">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium text-text-primary">Skills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {candidate.skills.map((skill) => (
                        <Badge key={skill} variant={getSkillColor(skill)} className="text-sm">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Profile Summary Card - Overview Tab */}
              {activeTab === 'overview' && candidate.profile_summary && (
                <Card className="bg-surface-primary">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium text-text-primary">Profile Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none text-text-primary">
                      <SafeHtml 
                        content={candidate.profile_summary}
                        className="leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}


              {/* Work Experience Tab */}
              {activeTab === 'experience' && (
                <CandidateWorkExperienceComponent experiences={workExperience} />
              )}

              {/* Resume Tab */}
              {activeTab === 'resume' && (
                <Card className="bg-surface-primary">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium text-text-primary">Resume</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {candidate.resume_url ? (
                      <>
                        <div className="flex gap-2">
                          <input
                            ref={replaceResumeInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleReplaceResumeChange}
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                          />
                          <Button variant="outline" onClick={() => replaceResumeInputRef.current?.click()} disabled={isResumeUploading}>
                            Replace Resume
                          </Button>
                          <Button variant="destructive" onClick={handleDeleteResume}>
                            Delete Resume
                          </Button>
                        </div>
                        <CandidateResumeViewer fallbackResumeUrl={candidate.resume_url} />
                      </>
                    ) : (
                      <EnhancedResumeDropzone 
                        onUpload={handleResumeUpload} 
                        isUploading={isResumeUploading}
                        candidateId={candidate.id}
                        showUpload={false}
                        parseOnly={true}
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Education Tab */}
              {activeTab === 'education' && (
                <CandidateEducationComponent education={education} />
              )}

              {/* Comments Tab */}
              {activeTab === 'comments' && (
                <CandidateComments 
                  candidateId={candidate.id}
                  jobId={null} // Independent candidates don't belong to specific jobs
                  organizationId={null} // RLS policies handle organization access for independent candidates
                />
              )}

              {/* Details Tab */}
              {activeTab === 'details' && (
                <Card className="bg-surface-primary">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium text-text-primary">Detailed Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-xl">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-xl">
                        <div className="flex items-start gap-md text-text-secondary">
                          <Calendar className="h-5 w-5 mt-1 flex-shrink-0" />
                          <div className="space-y-1">
                            <span className="text-sm font-medium block">Added Date</span>
                            <p className="text-text-primary text-base">
                              {new Date(candidate.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-md text-text-secondary">
                          <User className="h-5 w-5 mt-1 flex-shrink-0" />
                          <div className="space-y-1">
                            <span className="text-sm font-medium block">Source</span>
                            <p className="text-text-primary text-base capitalize">
                              {candidate.source?.replace('_', ' ') || 'Direct'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {candidate.resume_url && (
                        <div className="flex items-start gap-md text-text-secondary">
                          <FileText className="h-5 w-5 mt-1 flex-shrink-0" />
                          <div className="space-y-1">
                            <span className="text-sm font-medium block">Resume</span>
                            <a 
                              href={candidate.resume_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-text-primary text-base hover:text-primary hover:underline inline-flex items-center gap-1"
                            >
                              View Resume <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-md">
              {/* CoreSignal Enrichment Panel */}
              <EnrichmentPanel 
                candidate={candidate} 
                onEnrichmentComplete={handleEnrichmentComplete}
              />

              {/* Quick Actions */}
              <PermissionGate permission="canManageCandidates">
                <Card className="bg-surface-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-text-primary">
                      <Zap className="h-5 w-5" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button onClick={handleEdit} className="w-full gap-2">
                      <Edit className="h-4 w-4" />
                      Edit Candidate
                    </Button>
                  </CardContent>
                </Card>
              </PermissionGate>
            </div>
          </div>

          {/* Edit Form Dialog */}
          <IndependentCandidateForm
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSubmit={handleFormSubmit}
            isLoading={candidatesLoading}
            initialData={candidate}
            title="Edit Candidate"
          />
        </AppContainer>
      </PermissionGate>
    </AuthGate>
  )
}