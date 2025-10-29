import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Sparkles, CheckCircle2, Circle, Briefcase, DollarSign, MapPin, Target, ChevronDown, ChevronUp, TrendingUp, Clock, Users, Award, Building2, Edit2, BarChart3, AlertTriangle, PieChart, RefreshCw, ArrowUp } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { validateJobPrompt, getValidationStats, type ValidationItem } from '@/utils/jobPromptValidation'
import { SkillsEditor } from './SkillsEditor'
import { useJobs } from '@/hooks/useJobs'
import { useAuth } from '@/contexts/AuthContext'
import { SafeHtml } from '@/components/ui/safe-html'

interface JobSpec {
  job_title: string
  alt_titles: string[]
  job_description: string
  level: 'L1' | 'L2' | 'L3'
  department: string
  location: string
  regional_context?: {
    region: 'LATAM' | 'EMEA' | 'APAC' | 'NORTH_AMERICA' | 'GLOBAL'
    remote_scope?: string // e.g., "Remote - LATAM", "Specific office location"
    timezone_alignment?: string // e.g., "Latin America timezones", "European business hours"
  }
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
    coreSignalCandidates: number
    localCandidates: number
    creditsUsed: number
    coreSignalError?: string
    searchStrategy: string
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

interface AIJobAssistantProps {
  onProjectCreated?: (projectId: string) => void
}

export function AIJobAssistant({ onProjectCreated }: AIJobAssistantProps = {}) {
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
  const [currentStep, setCurrentStep] = useState<'prompt' | 'specs' | 'decision'>('prompt')
  const [isEditing, setIsEditing] = useState<{[key: string]: boolean}>({})
  const [editableJobSpec, setEditableJobSpec] = useState<JobSpec | null>(null)
  const [isRefreshingMatches, setIsRefreshingMatches] = useState(false)
  const [marketInsights, setMarketInsights] = useState<any>(null)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
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

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)
    
    // Auto-expand textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canGenerate && !isGenerating) {
        handleGenerate()
      }
    }
  }

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
        setEditableJobSpec(data.jobSpec)
        setCandidateMatching(data.candidateMatching || null)
        setSelectedTitle(data.jobSpec.job_title)
        setEditableSkills(data.jobSpec.skills || [])
        setCurrentStep('specs')
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

  const handleSaveDraft = async () => {
    if (!editableJobSpec || createdJobId) return // Idempotent check

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
        description: editableJobSpec.job_description,
        level: levelMapping[editableJobSpec.level] || 'L1 - Specialists',
        location: editableJobSpec.location,
        department: editableJobSpec.department,
        salary_min: editableJobSpec.salary_range.min,
        salary_max: editableJobSpec.salary_range.max,
        currency: editableJobSpec.salary_range.currency,
        status: 'draft' as const,
        skills: editableSkills,
        organization_id: organizationId
      }

      const newJob = await createJob(jobData)
      
      setCreatedJobId(newJob.id)
      
      // Create sourcing project automatically
      try {
        const { data: project, error: projectError } = await supabase.functions.invoke('create-sourcing-project', {
          body: {
            name: `${selectedTitle} - ${editableJobSpec.location}`,
            description: prompt,
            job_id: newJob.id,
            search_criteria: {
              skills: editableSkills,
              location: editableJobSpec.location,
              salary_min: editableJobSpec.salary_range.min,
              salary_max: editableJobSpec.salary_range.max,
              currency: editableJobSpec.salary_range.currency
            }
          }
        })
        
        if (projectError) {
          console.error('❌ Failed to create sourcing project:', projectError)
        } else {
          console.log('✅ Sourcing project created:', project.id)
          
          if (onProjectCreated) {
            onProjectCreated(project.id)
          }
        }
      } catch (err) {
        console.error('❌ Exception creating sourcing project:', err)
      }
      
      // Navigate to decision
      setCurrentStep('decision')
      toast({
        title: 'Draft Saved',
        description: `"${selectedTitle}" has been saved as a draft.`,
      })
    } catch (error: any) {
      console.error('Error saving draft:', error)
      toast({
        title: 'Failed to Save Draft',
        description: error.message || 'An error occurred while saving the draft job.',
        variant: 'destructive'
      })
    } finally {
      setIsCreatingJob(false)
    }
  }

  const handleCreateJob = async () => {
    if (!editableJobSpec) return

    // If already created (via draft), just close and navigate
    if (createdJobId) {
      toast({
        title: 'Job Ready',
        description: `"${selectedTitle}" has been created and is ready for review.`,
      })
      setShowModal(false)
      navigate(`/jobs/${createdJobId}`)
      return
    }

    // Otherwise create new (fallback if user skipped sourcing somehow)
    setIsCreatingJob(true)
    try {
      const levelMapping: Record<string, any> = {
        'L1': 'L1 - Specialists',
        'L2': 'L2 - Managers', 
        'L3': 'L3 - Directors / VPs / Executive Search'
      }

      const jobData = {
        title: selectedTitle,
        description: editableJobSpec.job_description,
        level: levelMapping[editableJobSpec.level] || 'L1 - Specialists',
        location: editableJobSpec.location,
        department: editableJobSpec.department,
        salary_min: editableJobSpec.salary_range.min,
        salary_max: editableJobSpec.salary_range.max,
        currency: editableJobSpec.salary_range.currency,
        status: 'draft' as const,
        skills: editableSkills,
        organization_id: organizationId
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

  const handleEditField = (field: string) => {
    setIsEditing(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const handleFieldUpdate = (field: string, value: any) => {
    if (!editableJobSpec) return
    
    setEditableJobSpec(prev => {
      if (!prev) return prev
      
      if (field.includes('.')) {
        const [parentField, childField] = field.split('.')
        const currentParentValue = prev[parentField as keyof JobSpec]
        return {
          ...prev,
          [parentField]: {
            ...(typeof currentParentValue === 'object' && currentParentValue !== null ? currentParentValue : {}),
            [childField]: value
          }
        }
      }
      
      return {
        ...prev,
        [field]: value
      }
    })
  }

  const handleRefreshMatches = async () => {
    if (!editableJobSpec) return
    
    setIsRefreshingMatches(true)
    try {
      const { data, error } = await supabase.functions.invoke('count-matching-candidates', {
        body: {
          criteria: {
            skills: editableSkills,
            location: editableJobSpec.location,
            salary_min: editableJobSpec.salary_range.min,
            salary_max: editableJobSpec.salary_range.max,
            currency: editableJobSpec.salary_range.currency
          }
        }
      })

      if (error) throw error
      setCandidateMatching(data)
      
      toast({
        title: 'Matches Refreshed',
        description: 'Updated candidate matching based on your changes.'
      })
    } catch (error: any) {
      console.error('Error refreshing matches:', error)
      toast({
        title: 'Failed to Refresh Matches',
        description: error.message || 'Unable to refresh candidate matches.',
        variant: 'destructive'
      })
    } finally {
      setIsRefreshingMatches(false)
    }
  }

  const handleContinue = async () => {
    switch (currentStep) {
      case 'prompt':
        setCurrentStep('specs')
        break
      case 'specs':
        await handleSaveDraft()
        break
      default:
        break
    }
  }

  const getContinueButtonText = () => {
    switch (currentStep) {
      case 'prompt':
        return 'Continue to Specs'
      case 'specs':
        return isCreatingJob ? 'Saving Draft...' : 'Save Draft'
      default:
        return 'Continue'
    }
  }

  const canContinue = () => {
    switch (currentStep) {
      case 'prompt':
        return jobSpec !== null
      case 'specs':
        return editableJobSpec !== null && !isCreatingJob
      default:
        return false
    }
  }

  return (
    <>
      {/* Main Prompt Card - ChatGPT Style */}
      <div className="space-y-6">
        {/* ChatGPT-style Input */}
        <div className="relative max-w-3xl mx-auto">
          <div className={`relative flex items-end gap-2 px-5 py-3 rounded-[28px] border transition-all ${
            isFocused 
              ? 'border-gray-300 shadow-md' 
              : 'border-gray-200 shadow-sm'
          } bg-white`}>
            
            {/* Textarea (auto-expanding) */}
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={handlePromptChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the role you're looking to fill..."
              rows={1}
              className="flex-1 resize-none bg-transparent border-none outline-none text-virgilio-text placeholder:text-gray-400 max-h-[200px] overflow-y-auto py-1"
              style={{ 
                minHeight: '24px',
                scrollbarWidth: 'thin'
              }}
            />
            
            {/* Send Button - only show when text exists */}
            <div className="flex items-center gap-2 flex-shrink-0 pb-1">
              {prompt.trim().length > 0 && (
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-virgilio-text hover:bg-black disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4 text-white" />
                  )}
                </button>
              )}
            </div>
          </div>
          
          {/* Word Count (subtle, bottom-right) */}
          <div className="absolute -bottom-6 right-2 text-xs text-gray-400">
            {wordCount} words
          </div>
        </div>

        {/* Validation Pills - Centered below input */}
        <div className="flex justify-center mt-10">
          <div className="flex flex-wrap gap-3 justify-center">
            {currentValidation.map((item) => (
              <div 
                key={item.id} 
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  item.checked 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}
              >
                {item.checked ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Sheet open={showModal} onOpenChange={setShowModal}>
        <SheetContent side="right" className="w-full sm:w-[600px] lg:w-[800px] overflow-y-auto p-0">
          <SheetHeader className="space-y-4 border-b border-virgilio-border pb-6 px-6 pt-6 sticky top-0 bg-background z-10">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-md">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <SheetTitle className="text-h4-mobile font-poppins font-bold text-virgilio-text tracking-page-title">
                  AI Job Assistant<span className="text-virgilio-purple">.</span>
                </SheetTitle>
                <p className="text-sm text-virgilio-muted mt-1">
                  Step {currentStep === 'prompt' ? '1' : currentStep === 'specs' ? '2' : '3'} of 3
                </p>
              </div>
            </div>
            
            {/* Progress Dots */}
            <div className="flex items-center justify-center gap-2">
              {['prompt', 'specs', 'decision'].map((step, index) => {
                const stepIndex = ['prompt', 'specs', 'decision'].indexOf(currentStep)
                const isActive = currentStep === step
                const isCompleted = index < stepIndex
                
                return (
                  <div 
                    key={step}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isActive 
                        ? "bg-gradient-to-r from-purple-600 to-cyan-600 w-8" 
                        : isCompleted
                        ? "bg-virgilio-purple w-2"
                        : "bg-gray-300 w-2"
                    }`}
                  />
                )
              })}
            </div>
          </SheetHeader>
          
          {editableJobSpec && (
            <div className="px-6 pb-6">
              {/* Step 1: Prompt */}
              {currentStep === 'prompt' && (
                <div className="space-y-4 pt-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Original Prompt</h4>
                    <p className="text-sm text-muted-foreground">{prompt}</p>
                  </div>
                  
                  <SheetFooter className="pt-4">
                    <Button
                      onClick={handleContinue}
                      disabled={!canContinue()}
                      size="lg"
                      className="px-8 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all"
                    >
                      <Sparkles className="h-5 w-5 mr-2" />
                      {getContinueButtonText()}
                    </Button>
                  </SheetFooter>
                </div>
              )}

              {/* Step 2: Specs */}
              {currentStep === 'specs' && (
                <div className="space-y-6 pt-6">
                  {/* Job Title */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Job Title</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEditField('title')}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {isEditing.title ? (
                      <Input
                        value={selectedTitle}
                        onChange={(e) => setSelectedTitle(e.target.value)}
                        onBlur={() => handleEditField('title')}
                        autoFocus
                      />
                    ) : (
                      <div className="p-2 bg-muted rounded cursor-pointer" onClick={() => handleEditField('title')}>
                        {selectedTitle}
                      </div>
                    )}
                    
                    {editableJobSpec.alt_titles.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Suggested Alternatives</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {editableJobSpec.alt_titles.map((title, index) => (
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

                  {/* Department */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Department</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEditField('department')}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {isEditing.department ? (
                      <Input
                        value={editableJobSpec.department}
                        onChange={(e) => handleFieldUpdate('department', e.target.value)}
                        onBlur={() => handleEditField('department')}
                        autoFocus
                      />
                    ) : (
                      <div className="p-2 bg-muted rounded cursor-pointer" onClick={() => handleEditField('department')}>
                        {editableJobSpec.department}
                      </div>
                    )}
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Location</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEditField('location')}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {isEditing.location ? (
                      <Input
                        value={editableJobSpec.location}
                        onChange={(e) => handleFieldUpdate('location', e.target.value)}
                        onBlur={() => handleEditField('location')}
                        autoFocus
                      />
                    ) : (
                      <div className="p-2 bg-muted rounded cursor-pointer" onClick={() => handleEditField('location')}>
                        {editableJobSpec.location}
                      </div>
                    )}
                  </div>

                  {/* Salary Range */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Salary Range</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEditField('salary')}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {isEditing.salary ? (
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={editableJobSpec.salary_range.min}
                          onChange={(e) => handleFieldUpdate('salary_range.min', parseInt(e.target.value))}
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={editableJobSpec.salary_range.max}
                          onChange={(e) => handleFieldUpdate('salary_range.max', parseInt(e.target.value))}
                        />
                        <Input
                          placeholder="Currency"
                          value={editableJobSpec.salary_range.currency}
                          onChange={(e) => handleFieldUpdate('salary_range.currency', e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="p-2 bg-muted rounded cursor-pointer" onClick={() => handleEditField('salary')}>
                        {editableJobSpec.salary_range.currency} {editableJobSpec.salary_range.min?.toLocaleString()} - {editableJobSpec.salary_range.max?.toLocaleString()} ({editableJobSpec.salary_range.period})
                      </div>
                    )}
                  </div>

                  {/* Skills */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Skills</Label>
                    <SkillsEditor
                      skills={editableSkills}
                      onSkillsChange={setEditableSkills}
                      location={editableJobSpec.location}
                      salaryMin={editableJobSpec.salary_range.min}
                      salaryMax={editableJobSpec.salary_range.max}
                      currency={editableJobSpec.salary_range.currency}
                    />
                  </div>

                  {/* Job Description - Full Width */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Job Description</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEditField('description')}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {isEditing.description ? (
                      <Textarea
                        value={editableJobSpec.job_description}
                        onChange={(e) => handleFieldUpdate('job_description', e.target.value)}
                        onBlur={() => handleEditField('description')}
                        className="min-h-[300px]"
                        autoFocus
                      />
                    ) : (
                      <SafeHtml 
                        content={editableJobSpec.job_description}
                        className="p-4 bg-muted rounded-lg text-sm min-h-[300px] cursor-pointer" 
                        onClick={() => handleEditField('description')}
                      />
                    )}
                  </div>
                  
                  <SheetFooter className="pt-4">
                    <Button
                      onClick={handleContinue}
                      disabled={!canContinue()}
                      size="lg"
                      className="px-8 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all"
                    >
                      {isCreatingJob ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Saving Draft...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5 mr-2" />
                          {getContinueButtonText()}
                        </>
                      )}
                    </Button>
                  </SheetFooter>
                </div>
              )}

              {/* Step 3: Decision/Review */}
              {currentStep === 'decision' && (
                <div className="space-y-4 pt-6">
                  <h4 className="text-lg font-semibold">Ready to Create Job?</h4>
                  <div className="p-4 bg-muted rounded-lg">
                    <h5 className="font-medium mb-2">Job Summary</h5>
                    <div className="space-y-2 text-sm">
                      <div><strong>Title:</strong> {selectedTitle}</div>
                      <div><strong>Department:</strong> {editableJobSpec.department}</div>
                      <div><strong>Location:</strong> {editableJobSpec.location}</div>
                      <div><strong>Skills:</strong> {editableSkills.join(', ')}</div>
                      <div><strong>Salary:</strong> {editableJobSpec.salary_range.currency} {editableJobSpec.salary_range.min?.toLocaleString()} - {editableJobSpec.salary_range.max?.toLocaleString()}</div>
                    </div>
                  </div>
                  
                  <SheetFooter className="pt-4">
                    <Button
                      onClick={handleCreateJob}
                      disabled={isCreatingJob}
                      size="lg"
                      className="px-8 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all"
                    >
                      {isCreatingJob ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Creating Job...
                        </>
                      ) : (
                        <>
                          <Target className="h-5 w-5 mr-2" />
                          Create Job
                        </>
                      )}
                    </Button>
                  </SheetFooter>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}