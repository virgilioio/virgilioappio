import { useState, useEffect } from 'react'
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

export default function IndependentCandidateProfile() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const navigate = useNavigate()
  const [candidate, setCandidate] = useState<IndependentCandidate | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'resume' | 'details' | 'experience' | 'education'>('overview')
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
                tabs={[
                  { value: 'overview', label: 'Overview', Icon: FileText },
                  { value: 'resume', label: 'Resume', Icon: FileText },
                  { value: 'experience', label: 'Experience', Icon: Zap },
                  { value: 'education', label: 'Education', Icon: User },
                  { value: 'details', label: 'Details', Icon: Calendar },
                ]}
                activeTab={activeTab}
                onTabChange={(v) => setActiveTab(v as 'overview' | 'details' | 'experience' | 'education')}
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
                  <CardContent>
                    {candidate.resume_url ? (
                      <div className="space-y-3">
                        <div className="aspect-[8.5/11] w-full border border-border rounded-lg overflow-hidden bg-surface-secondary">
                          <iframe
                            src={candidate.resume_url}
                            title="Resume preview"
                            className="w-full h-[70vh]"
                          />
                        </div>
                        <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                          Open in new tab
                        </a>
                      </div>
                    ) : (
                      <div className="text-sm text-text-secondary">No resume available.</div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Education Tab */}
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