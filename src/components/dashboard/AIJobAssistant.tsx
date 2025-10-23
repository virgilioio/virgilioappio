import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Sparkles, CheckCircle2, Circle, Briefcase, DollarSign, MapPin, Target, ChevronDown, ChevronUp, TrendingUp, Clock, Users, Award, Building2, Edit2, BarChart3, AlertTriangle, PieChart, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { validateJobPrompt, getValidationStats, type ValidationItem } from '@/utils/jobPromptValidation'
import { SkillsEditor } from './SkillsEditor'
import { useJobs } from '@/hooks/useJobs'
import { useAuth } from '@/contexts/AuthContext'
import { SafeHtml } from '@/components/ui/safe-html'
import { SourcingStep } from '@/components/jobs/wizard/SourcingStep'

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
  const [currentStep, setCurrentStep] = useState<'prompt' | 'specs' | 'sourcing' | 'decision'>('prompt')
  const [isEditing, setIsEditing] = useState<{[key: string]: boolean}>({})
  const [editableJobSpec, setEditableJobSpec] = useState<JobSpec | null>(null)
  const [isRefreshingMatches, setIsRefreshingMatches] = useState(false)
  const [marketInsights, setMarketInsights] = useState<any>(null)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)
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
      
      // Navigate to sourcing if enabled, otherwise go to decision
      if (import.meta.env.VITE_FEATURE_SOURCING_ENABLED !== 'false') {
        setCurrentStep('sourcing')
        toast({
          title: 'Draft Saved',
          description: `"${selectedTitle}" has been saved as a draft. Continue to candidate sourcing.`,
        })
      } else {
        setCurrentStep('decision')
        toast({
          title: 'Draft Saved',
          description: `"${selectedTitle}" has been saved as a draft.`,
        })
      }
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
      case 'sourcing':
        if (import.meta.env.VITE_FEATURE_SOURCING_ENABLED !== 'false') {
          setCurrentStep('decision')
        }
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
        if (import.meta.env.VITE_FEATURE_SOURCING_ENABLED !== 'false') {
          return isCreatingJob ? 'Saving Draft...' : 'Save & Continue to Sourcing'
        }
        return isCreatingJob ? 'Saving Draft...' : 'Save Draft'
      case 'sourcing':
        return 'Continue to Review'
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
      case 'sourcing':
        return true
      default:
        return false
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
        <DialogContent className="mx-2 sm:mx-4 w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Job Assistant
            </DialogTitle>
          </DialogHeader>
          
          {editableJobSpec && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                 <div className="flex items-center space-x-2 sm:space-x-4 overflow-x-auto pb-2 sm:pb-0">
                   {[
                     { id: 'prompt', label: 'Prompt', icon: Sparkles },
                     { id: 'specs', label: 'Specs', icon: Edit2 },
                     { id: 'decision', label: 'Create', icon: Target }
                   ].map((step, index) => {
                     const StepIcon = step.icon
                     const isActive = currentStep === step.id
                     const isCompleted = ['prompt', 'specs'].includes(step.id) && currentStep !== 'prompt'
                     
                     return (
                       <div key={step.id} className="flex items-center flex-shrink-0">
                         <div className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 ${
                           isActive ? 'border-primary bg-primary text-white' :
                           isCompleted ? 'border-green-500 bg-green-500 text-white' :
                           'border-gray-300 bg-white text-gray-400'
                         }`}>
                           <StepIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                         </div>
                         <span className={`ml-1 sm:ml-2 text-xs sm:text-sm font-medium ${
                           isActive ? 'text-primary' : 
                           isCompleted ? 'text-green-600' : 
                           'text-gray-400'
                         }`}>
                           {step.label}
                         </span>
                         {index < 2 && (
                           <div className={`mx-2 sm:mx-4 w-4 sm:w-8 h-0.5 ${
                             isCompleted ? 'bg-green-500' : 'bg-gray-300'
                           }`} />
                         )}
                       </div>
                     )
                   })}
                 </div>
              </div>

               <Tabs value={currentStep} onValueChange={(value) => setCurrentStep(value as any)} className="space-y-6">
                 <TabsList className={`grid w-full ${import.meta.env.VITE_FEATURE_SOURCING_ENABLED !== 'false' ? 'grid-cols-4' : 'grid-cols-3'} h-auto p-1`}>
                   <TabsTrigger value="prompt" className="text-xs sm:text-sm px-2 py-2">Prompt</TabsTrigger>
                   <TabsTrigger value="specs" className="text-xs sm:text-sm px-2 py-2">Specs</TabsTrigger>
                   {import.meta.env.VITE_FEATURE_SOURCING_ENABLED !== 'false' && (
                     <TabsTrigger value="sourcing" className="text-xs sm:text-sm px-2 py-2">Sourcing</TabsTrigger>
                   )}
                   <TabsTrigger value="decision" className="text-xs sm:text-sm px-2 py-2">Review</TabsTrigger>
                 </TabsList>

                <TabsContent value="prompt" className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Original Prompt</h4>
                    <p className="text-sm text-muted-foreground">{prompt}</p>
                  </div>
                  
                  {/* Continue Button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleContinue}
                      disabled={!canContinue()}
                      className="px-6 py-2 text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#7e3eff' }}
                    >
                      {getContinueButtonText()}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="specs" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    {/* Left Column - Editable Fields */}
                    <div className="space-y-6">
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
                    </div>

                    {/* Right Column - Job Description */}
                    <div className="space-y-4">
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
                  </div>
                  
                  {/* Continue Button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleContinue}
                      disabled={!canContinue()}
                      className="px-6 py-2 text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#7e3eff' }}
                    >
                      {getContinueButtonText()}
                    </Button>
                  </div>
                </TabsContent>

{import.meta.env.VITE_FEATURE_SOURCING_ENABLED !== 'false' && (
                  <TabsContent value="sourcing" className="space-y-6">
                    {createdJobId ? (
                      <SourcingStep
                        jobId={createdJobId}
                        onNext={() => setCurrentStep('decision')}
                        onBack={() => setCurrentStep('specs')}
                      />
                    ) : (
                      <div className="py-8 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Saving draft job...</p>
                      </div>
                    )}
                  </TabsContent>
                )}

                <TabsContent value="decision" className="space-y-6">
                  <div className="space-y-4">
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
                    
                    <div className="flex justify-end">
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
                          <>
                            <Target className="h-4 w-4 mr-2" />
                            Create Job
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}