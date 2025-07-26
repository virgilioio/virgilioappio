import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, MapPin, DollarSign, Calendar, User, Edit, Zap, Linkedin, FileText, ExternalLink, Mail, Phone, ChevronLeft, ChevronRight } from 'lucide-react'
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

export default function IndependentCandidateProfile() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const navigate = useNavigate()
  const [candidate, setCandidate] = useState<IndependentCandidate | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'experience' | 'education'>('overview')
  
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'available': 'bg-accent/20 text-accent-foreground',
      'interviewing': 'bg-primary/20 text-primary-foreground',
      'hired': 'bg-success/20 text-success-foreground',
      'inactive': 'bg-muted text-muted-foreground'
    }
    return colors[status] || 'bg-muted text-muted-foreground'
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
              <Button variant="ghost" className="gap-sm h-[44px] text-text-secondary hover:text-text-primary">
                <ArrowLeft className="h-4 w-4" />
                Back to Candidates
              </Button>
            </Link>

            {/* Navigation Arrows */}
            <div className="flex items-center gap-sm">
              <Button
                variant="ghost"
                className="gap-sm h-[44px] text-text-secondary hover:text-text-primary"
                onClick={() => previousCandidate && navigateToCandidate(previousCandidate.id)}
                disabled={!hasPreviousCandidate}
                title={previousCandidate ? `Previous: ${previousCandidate.candidate_name}` : 'No previous candidate'}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="ghost"
                className="gap-sm h-[44px] text-text-secondary hover:text-text-primary"
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
              {/* Header Card with Tab Bar */}
              <Card className="!bg-white">
                <CardContent className="p-layout-md">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-semibold text-text-primary">{candidate.candidate_name}</h1>
                        <Badge className={`text-xs ${getStatusColor(candidate.status)}`}>
                          {candidate.status}
                        </Badge>
                      </div>
                      <p className="text-text-secondary">
                        Independent candidate • Added {new Date(candidate.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    {candidate.linkedin_url ? (
                      <Button 
                        className="gap-sm h-[44px] bg-[#0078c7] text-white hover:bg-[#005a94]"
                        onClick={() => window.open(candidate.linkedin_url!, '_blank')}
                      >
                        <Linkedin className="h-4 w-4" fill="white" />
                        View LinkedIn
                      </Button>
                    ) : (
                      <Button 
                        className="gap-sm h-[44px]"
                        variant="outline"
                        disabled
                      >
                        <Linkedin className="h-4 w-4" />
                        No LinkedIn
                      </Button>
                    )}
                  </div>

                  {/* Tab Bar inside Header Card */}
                  <div className="w-full bg-surface-primary rounded-xl p-1">
                    <div className="inline-flex h-auto items-center justify-start rounded-xl bg-transparent p-0 text-muted-foreground w-full">
                      <button 
                        onClick={() => setActiveTab('overview')}
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50",
                          activeTab === 'overview' && "bg-accent text-accent-foreground"
                        )}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Overview
                      </button>
                      <button 
                        onClick={() => setActiveTab('experience')}
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50",
                          activeTab === 'experience' && "bg-accent text-accent-foreground"
                        )}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Experience
                      </button>
                      <button 
                        onClick={() => setActiveTab('education')}
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50",
                          activeTab === 'education' && "bg-accent text-accent-foreground"
                        )}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Education
                      </button>
                      <button 
                        onClick={() => setActiveTab('details')}
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50",
                          activeTab === 'details' && "bg-accent text-accent-foreground"
                        )}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Details
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>

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

              {/* Education Tab */}
              {activeTab === 'education' && (
                <CandidateEducationComponent education={education} />
              )}

              {/* Detailed Information Card - Details Tab */}
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