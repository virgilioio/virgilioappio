import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Sparkles, CheckCircle2, Circle, Briefcase, DollarSign, MapPin, Target, ChevronDown, ChevronUp, TrendingUp, Clock, Users, Award, Building2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { validateJobPrompt, getValidationStats, type ValidationItem } from '@/utils/jobPromptValidation'
import { SkillsEditor } from './SkillsEditor'
import { useJobs } from '@/hooks/useJobs'
import { useAuth } from '@/contexts/AuthContext'

interface JobSpec {
  job_title: string
  alt_titles: string[]
  job_description: string
  level: 'L1' | 'L2' | 'L3'
  department: string
  location: string
  salary_range: {
    min: number
    max: number
    currency: string
    period: 'monthly' | 'annual'
  }
  skills: string[]
  recommendations: string[]
}

interface CandidateMatching {
  totalCandidates: number
  excellent: number
  good: number
  fair: number
  minimal: number
  breakdown: {
    salaryMatches: number
    locationMatches: number
    skillsAnalysis: {
      averageMatch: number
      topSkills: string[]
    }
  }
}

interface MarketSalaryData {
  salary_min: number
  salary_max: number
  salary_median: number
  percentile_25: number
  percentile_75: number
  percentile_90: number
  currency: string
  market_competitiveness: string
  sample_size: number
}

export function AIJobAssistant() {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [jobSpec, setJobSpec] = useState<JobSpec | null>(null)
  const [candidateMatching, setCandidateMatching] = useState<CandidateMatching | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedTitle, setSelectedTitle] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isFocused, setIsFocused] = useState(false)
  const [editableSkills, setEditableSkills] = useState<string[]>([])
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [organizationName, setOrganizationName] = useState<string>('')
  const { toast } = useToast()
  const { createJob } = useJobs()
  const navigate = useNavigate()
  const { user, organizationId } = useAuth()

  const currentValidation = validateJobPrompt(prompt)
  const validItemsCount = currentValidation.filter(item => item.checked).length
  const wordCount = prompt.trim().split(/\s+/).filter(word => word.length > 0).length
  const canGenerate = wordCount >= 10

  // Fetch organization name when component mounts
  useEffect(() => {
    const fetchOrganizationName = async () => {
      if (organizationId) {
        const { data, error } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', organizationId)
          .single()

        if (data && !error) {
          setOrganizationName(data.name)
        }
      }
    }

    fetchOrganizationName()
  }, [organizationId])

  const handleGenerate = async () => {
    if (!canGenerate) return

    setIsGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-job-spec', {
        body: { prompt }
      })

      if (error) throw error

      if (data?.jobSpec) {
        setJobSpec(data.jobSpec)
        setCandidateMatching(data.candidateMatching || null)
        setSelectedTitle(data.jobSpec.job_title)
        setEditableSkills(data.jobSpec.skills || [])
        setShowModal(true)
      } else {
        throw new Error('Invalid response from AI service')
      }
    } catch (error: any) {
      console.error('Error generating job spec:', error)
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate job specification. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateJob = async () => {
    if (!jobSpec) return

    setIsCreatingJob(true)
    try {
      // Map AI level format to database enum
      const levelMapping: Record<string, any> = {
        'L1': 'L1 - Specialists',
        'L2': 'L2 - Managers', 
        'L3': 'L3 - Directors / VPs / Executive Search'
      }

      const jobData = {
        title: selectedTitle,
        description: jobSpec.job_description,
        level: levelMapping[jobSpec.level] || 'L1 - Specialists',
        location: jobSpec.location,
        department: jobSpec.department,
        salary_min: jobSpec.salary_range.min,
        salary_max: jobSpec.salary_range.max,
        currency: jobSpec.salary_range.currency,
        status: 'draft' as const,
        skills: editableSkills
      }

      const newJob = await createJob(jobData)
      
      toast({
        title: 'Job Created Successfully',
        description: `"${selectedTitle}" has been created and saved as a draft.`,
      })

      setShowModal(false)
      navigate(`/jobs/${newJob.id}`)
    } catch (error: any) {
      console.error('Error creating job:', error)
      toast({
        title: 'Failed to Create Job',
        description: error.message || 'An error occurred while creating the job.',
        variant: 'destructive'
      })
    } finally {
      setIsCreatingJob(false)
    }
  }

  return (
    <>
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-pink-500/20 rounded-lg blur-sm" />
        <Card className="relative bg-white border-2 border-transparent bg-clip-padding before:absolute before:inset-0 before:-m-[2px] before:rounded-lg before:bg-gradient-to-r before:from-purple-500 before:via-cyan-500 before:to-pink-500 before:-z-10 before:animate-pulse">
          <CardHeader 
            className="cursor-pointer"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Virgil AI
                <Badge variant="secondary" className="text-xs bg-gradient-to-r from-purple-100 to-cyan-100 text-purple-700 border-purple-200">
                  Beta
                </Badge>
              </div>
              {isCollapsed ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Describe the talent you need and let AI generate a complete job specification
            </p>
          </CardHeader>
          
          <div 
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'
            }`}
          >
            <CardContent className="space-y-6">
              <div className="relative">
                <div 
                  className={`absolute inset-0 rounded-md transition-all duration-500 ai-border-gradient ${
                    isFocused || prompt.length > 0 
                      ? 'opacity-100 ai-border-active' 
                      : 'opacity-60'
                  }`}
                  style={{
                    padding: '2px',
                    borderRadius: '6px',
                  }}
                >
                  <div className="w-full h-full bg-white rounded-md"></div>
                </div>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Describe the role you're looking to fill... (e.g., 'I need a senior sales rep for our fintech startup to build outbound pipeline in Mexico City and drive 30% revenue growth')"
                  className={`relative min-h-[100px] resize-none bg-transparent border-0 focus:ring-0 focus:outline-none transition-all duration-300 ${
                    isFocused || prompt.length > 0 
                      ? 'shadow-lg shadow-purple-500/20' 
                      : ''
                  }`}
                  style={{
                    zIndex: 10,
                    position: 'relative'
                  }}
                />
                <div className="absolute bottom-2 right-2 text-xs text-muted-foreground z-20">
                  {wordCount} words
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-4">
                  {currentValidation.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      {item.checked ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={item.checked ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
                {!canGenerate && (
                  <p className="text-xs text-muted-foreground">
                    Write at least 10 words to continue
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  className="px-6 py-2 text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#7e3eff' }}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Job Details...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Job Details
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI-Generated Job Specification</DialogTitle>
          </DialogHeader>
          
          {jobSpec && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Main Job Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Job Title Section */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Job Title</label>
                    <input
                      type="text"
                      value={selectedTitle}
                      onChange={(e) => setSelectedTitle(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  
                  {jobSpec.alt_titles.length > 0 && (
                    <div>
                      <label className="text-sm text-muted-foreground">Suggested Alternatives</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {jobSpec.alt_titles.map((title, index) => (
                          <Button
                            key={index}
                            variant={selectedTitle === title ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedTitle(title)}
                          >
                            {title}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Job Details Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {organizationName && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4" />
                        <span className="font-medium">{organizationName}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="h-4 w-4" />
                      <span className="font-medium">{jobSpec.department}</span>
                      <Badge variant="outline">{jobSpec.level}</Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4" />
                      <span>{jobSpec.location}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4" />
                      <span>
                        {jobSpec.salary_range.currency} {jobSpec.salary_range.min.toLocaleString()} - {jobSpec.salary_range.max.toLocaleString()} 
                        <span className="text-muted-foreground ml-1">
                          ({jobSpec.salary_range.period})
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <SkillsEditor
                      skills={editableSkills}
                      onSkillsChange={setEditableSkills}
                      location={jobSpec.location}
                      salaryMin={jobSpec.salary_range.min}
                      salaryMax={jobSpec.salary_range.max}
                      currency={jobSpec.salary_range.currency}
                    />
                  </div>
                </div>

                {/* Job Description */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Job Description</h4>
                  <div className="p-4 bg-muted rounded-lg text-sm" dangerouslySetInnerHTML={{ __html: jobSpec.job_description }} />
                </div>

                {/* Create Job */}
                <div className="border-t pt-6 flex justify-end">
                  <Button
                    onClick={handleCreateJob}
                    disabled={isCreatingJob}
                    className="px-8 py-3 text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#7e3eff' }}
                  >
                    {isCreatingJob ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating Job...
                      </>
                    ) : (
                      'Create Job'
                    )}
                  </Button>
                </div>
              </div>

              {/* Right Column - AI Insights & Recommendations */}
              <div className="lg:col-span-1">
                <div className="sticky top-4 space-y-6">
                  {/* Candidate Pool Analysis */}
                  {candidateMatching && (
                    <div>
                      <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Candidate Pool Analysis
                      </h4>
                      <div className="space-y-4">
                        {/* Total Candidates */}
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-700">Total Matching Candidates</span>
                            <span className="text-2xl font-bold text-blue-800">{candidateMatching.totalCandidates}</span>
                          </div>
                          <div className="text-xs text-blue-600">
                            From our independent talent pool
                          </div>
                        </div>

                        {/* Match Quality Breakdown */}
                        {candidateMatching.totalCandidates > 0 && (
                          <div className="space-y-3">
                            <div className="text-sm font-medium">Match Quality Breakdown</div>
                            
                            {candidateMatching.excellent > 0 && (
                              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <span className="text-sm text-green-700">Excellent Match (90%+)</span>
                                </div>
                                <span className="text-sm font-medium text-green-800">{candidateMatching.excellent}</span>
                              </div>
                            )}
                            
                            {candidateMatching.good > 0 && (
                              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  <span className="text-sm text-blue-700">Good Match (70-89%)</span>
                                </div>
                                <span className="text-sm font-medium text-blue-800">{candidateMatching.good}</span>
                              </div>
                            )}
                            
                            {candidateMatching.fair > 0 && (
                              <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                  <span className="text-sm text-yellow-700">Fair Match (50-69%)</span>
                                </div>
                                <span className="text-sm font-medium text-yellow-800">{candidateMatching.fair}</span>
                              </div>
                            )}
                            
                            {candidateMatching.minimal > 0 && (
                              <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                  <span className="text-sm text-orange-700">Minimal Match (30-49%)</span>
                                </div>
                                <span className="text-sm font-medium text-orange-800">{candidateMatching.minimal}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Insight Message */}
                        <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <TrendingUp className="h-4 w-4 text-purple-600 mt-0.5" />
                            <div className="text-sm">
                              {candidateMatching.totalCandidates === 0 ? (
                                <span className="text-purple-700">
                                  No candidates match your exact criteria. Consider broadening location or skill requirements.
                                </span>
                              ) : candidateMatching.totalCandidates >= 20 ? (
                                <span className="text-purple-700">
                                  Great talent pool available! You have excellent options for this role.
                                </span>
                              ) : candidateMatching.totalCandidates >= 10 ? (
                                <span className="text-purple-700">
                                  Good talent pool available with {candidateMatching.totalCandidates} qualified candidates.
                                </span>
                              ) : (
                                <span className="text-purple-700">
                                  Limited talent pool ({candidateMatching.totalCandidates} candidates). Consider expanding criteria.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Top Skills in Pool */}
                        {candidateMatching.breakdown.skillsAnalysis.topSkills.length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-2">Top Skills in Candidate Pool</div>
                            <div className="flex flex-wrap gap-1">
                              {candidateMatching.breakdown.skillsAnalysis.topSkills.slice(0, 6).map((skill, index) => (
                                <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Insights & Recommendations */}
                  <div>
                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      AI Insights & Recommendations
                    </h4>
                    <div className="space-y-3">
                      {jobSpec.recommendations.map((rec, index) => {
                        const icons = [
                          { icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' },
                          { icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200' },
                          { icon: DollarSign, color: 'text-green-500', bg: 'bg-green-50 border-green-200' },
                          { icon: Award, color: 'text-purple-500', bg: 'bg-purple-50 border-purple-200' }
                        ]
                        const iconData = icons[index % icons.length]
                        const IconComponent = iconData.icon
                        
                        return (
                          <div key={index} className={`p-4 rounded-lg border ${iconData.bg} transition-all duration-200 hover:shadow-md`}>
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-full bg-white shadow-sm ${iconData.color}`}>
                                <IconComponent className="h-4 w-4" />
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed">{rec}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}