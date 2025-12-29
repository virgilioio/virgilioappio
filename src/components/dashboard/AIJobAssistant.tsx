import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Loader2, Sparkles, CheckCircle2, Circle, Briefcase, DollarSign, MapPin, Target, ChevronDown, ChevronUp, TrendingUp, Clock, Users, Award, Building2, Edit2, BarChart3, AlertTriangle, PieChart, RefreshCw, ArrowUp, MessageSquare } from 'lucide-react'
import gioAvatar from '@/assets/gio-avatar.png'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { validateJobPrompt, getValidationStats, type ValidationItem } from '@/utils/jobPromptValidation'
import { normalizeLocationForSourcing, isValidSourcingLocation } from '@/utils/locationNormalization'
import { SkillsEditor } from './SkillsEditor'
import { useJobs } from '@/hooks/useJobs'
import { useAuth } from '@/contexts/AuthContext'
import { SafeHtml } from '@/components/ui/safe-html'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import { useChildOrganizationsForJobCreation } from '@/hooks/useChildOrganizationsForJobCreation'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useChatWithGio } from '@/hooks/useChatWithGio'
import { OrganizationFormSheet } from '@/components/organizations/OrganizationFormSheet'
import { useOrganizations } from '@/hooks/useOrganizations'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

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
    apolloCandidates: number
    localCandidates: number
    creditsUsed: number
    apolloError?: string
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
  onGeneratingChange?: (isGenerating: boolean) => void
}

export function AIJobAssistant({ onProjectCreated, onGeneratingChange }: AIJobAssistantProps = {}) {
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
  const [preservedConversation, setPreservedConversation] = useState<Message[]>([])
  const [editableJobSpec, setEditableJobSpec] = useState<JobSpec | null>(null)
  const [isRefreshingMatches, setIsRefreshingMatches] = useState(false)
  const [marketInsights, setMarketInsights] = useState<any>(null)
  const [selectedJobId, setSelectedJobId] = useState<string>('')  // For optional job linking
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [projectConversationId, setProjectConversationId] = useState<string | null>(null)
  
  // Chat mode state
  const [chatMode, setChatMode] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { jobs } = useJobs()
  const navigate = useNavigate()
  const { user, organizationId, userType } = useAuth()
  const { isSearchDisabled } = useSourcingCreditWarnings()
  const { data: childOrgs, isLoading: isLoadingOrgs, refetch: refetchOrgs } = useChildOrganizationsForJobCreation()
  const { createOrganization, isLoading: isCreatingOrg } = useOrganizations()
  
  // State for organization creation form
  const [isOrgFormOpen, setIsOrgFormOpen] = useState(false)
  
  // Import chat hook
  const {
    messages: chatMessages,
    isLoading: isChatLoading,
    isStreaming,
    conversationId,
    isReadyForCreation,
    sendMessage,
    resetConversation,
    restoreMessages
  } = useChatWithGio()

  // Filter jobs by selected organization
  const jobsInOrg = selectedOrgId 
    ? (jobs || []).filter(job => job.organization_id === selectedOrgId)
    : []

  const currentValidation = validateJobPrompt(prompt)
  const validItemsCount = currentValidation.filter(item => item.checked).length
  const wordCount = prompt.trim().split(/\s+/).filter(word => word.length > 0).length
  const canGenerate = wordCount >= 10

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (chatMessages.length > 0) {
      scrollToBottom()
    }
  }, [chatMessages, isChatLoading])

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
      if (chatMode) {
        if (prompt.trim() && !isChatLoading) {
          handleSendChatMessage()
        }
      } else {
        if (canGenerate && !isGenerating) {
          handleGenerate()
        }
      }
    }
  }

  const handleSendChatMessage = async () => {
    if (!prompt.trim() || isChatLoading) return
    const message = prompt
    setPrompt('') // Clear immediately for better UX
    await sendMessage(message)
  }

  const handleCreateJobSpecsFromChat = async () => {
    if (!conversationId || !isReadyForCreation) return

    setIsGenerating(true)
    onGeneratingChange?.(true)
    try {
      // Send explicit synthesis instruction instead of last user message
      // This ensures the AI properly synthesizes the entire conversation
      const synthesisPrompt = "Based on our complete conversation above, generate a comprehensive job specification that incorporates all the requirements, skills, location, salary, and other details we discussed. Ensure the job spec accurately reflects everything we talked about."
      
      const { data, error } = await supabase.functions.invoke('generate-job-spec', {
        body: { 
          prompt: synthesisPrompt,
          conversationId 
        }
      })

      if (error) {
        if (error.message?.includes('CREDITS_EXHAUSTED')) {
          throw new Error('Monthly search credit limit reached. Credits will reset on the 1st of next month.')
        }
        throw error
      }

      if (data?.jobSpec) {
        setJobSpec(data.jobSpec)
        setEditableJobSpec(data.jobSpec)
        setCandidateMatching(data.candidateMatching || null)
        setSelectedTitle(data.jobSpec.job_title)
        setEditableSkills(data.jobSpec.skills || [])
        setCurrentStep('specs')
        setShowModal(true)
        setProjectConversationId(conversationId) // Store for linking to project
        
        // Reset chat after successful job spec creation
        resetConversation()
        setChatMode(false)
      } else {
        throw new Error('Invalid response from AI service')
      }
    } catch (error: any) {
      console.error('Error generating job spec from chat:', error)
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate job specification. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsGenerating(false)
      onGeneratingChange?.(false)
    }
  }

  const handleGenerate = async () => {
    if (!canGenerate) return

    if (isSearchDisabled) {
      toast({
        title: 'Search credits exhausted',
        description: 'You have used all your search credits for this month. Credits will reset on the 1st of next month.',
        variant: 'destructive',
        duration: 8000
      })
      return
    }

    setIsGenerating(true)
    onGeneratingChange?.(true)
    try {
      // Step 1: Generate job spec
      const { data, error } = await supabase.functions.invoke('generate-job-spec', {
        body: { prompt }
      })

      if (error) {
        if (error.message?.includes('CREDITS_EXHAUSTED')) {
          throw new Error('Monthly search credit limit reached. Credits will reset on the 1st of next month.')
        }
        throw error
      }

      if (!data?.jobSpec) {
        throw new Error('Invalid response from AI service')
      }

      const generatedSpec = data.jobSpec
      const skills = generatedSpec.skills || []
      const title = generatedSpec.job_title

      // Step 2: Normalize location for sourcing
      const rawLocation = generatedSpec.location || ''
      let normalizedLocations: string[] = []
      
      if (isValidSourcingLocation(rawLocation)) {
        normalizedLocations = [rawLocation]
      } else {
        normalizedLocations = normalizeLocationForSourcing(rawLocation)
        
        // Fallback to location_details if normalization returned empty
        if (normalizedLocations.length === 0 && generatedSpec.location_details) {
          const details = generatedSpec.location_details
          if (details.country_code) {
            if (details.city && details.state) {
              normalizedLocations = [`${details.city},${details.state},${details.country_code}`]
            } else if (details.state) {
              normalizedLocations = [`${details.state},${details.country_code}`]
            } else {
              normalizedLocations = [details.country_code]
            }
          } else if (details.region && details.is_remote) {
            const regionCodes = {
              'LATAM': ['MX', 'CO', 'AR', 'BR', 'CL', 'PE'],
              'EMEA': ['GB', 'DE', 'FR', 'ES', 'IT', 'NL'],
              'APAC': ['IN', 'SG', 'AU', 'JP'],
              'NORTH_AMERICA': ['US', 'CA']
            }
            normalizedLocations = regionCodes[details.region as keyof typeof regionCodes] || []
          }
        }
      }

      // Step 3: Create sourcing project immediately (skip the modal)
      console.log('🚀 Creating sourcing project directly...')
      
      const { data: project, error: projectError } = await supabase.functions.invoke('create-sourcing-project', {
        body: {
          name: `${title} - ${generatedSpec.location}`,
          description: prompt,
          job_id: null,
          organization_id: organizationId,
          search_criteria: {
            skills: skills,
            locations: normalizedLocations,
            title_keywords: [title, ...(generatedSpec.alt_titles || [])],
            salary_min: generatedSpec.salary_range?.min,
            salary_max: generatedSpec.salary_range?.max,
            currency: generatedSpec.salary_range?.currency
          },
          job_spec_data: {
            job_title: title,
            alt_titles: generatedSpec.alt_titles,
            job_description: generatedSpec.job_description,
            level: generatedSpec.level,
            department: generatedSpec.department,
            location: generatedSpec.location,
            location_details: generatedSpec.location_details,
            salary_range: generatedSpec.salary_range,
            skills: skills,
            recommendations: generatedSpec.recommendations,
            research_metadata: generatedSpec.research_metadata
          }
        }
      })

      if (projectError) {
        throw new Error(projectError.message)
      }

      console.log('✅ Sourcing project created:', project.id)

      toast({
        title: 'Finding Candidates',
        description: `Searching for "${title}" matches...`,
      })

      // Navigate directly to project view
      if (onProjectCreated) {
        onProjectCreated(project.id)
      }

      // Reset state
      setPrompt('')
      
    } catch (error: any) {
      console.error('Error generating job spec:', error)
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate job specification. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsGenerating(false)
      onGeneratingChange?.(false)
    }
  }

  const handleToggleChatMode = (enabled: boolean) => {
    if (!enabled && chatMessages.length > 0) {
      // Show confirmation if user has active chat
      if (window.confirm('This will discard your conversation. Continue?')) {
        resetConversation()
        setChatMode(false)
      }
    } else {
      setChatMode(enabled)
    }
  }

  const handleSaveDraft = async () => {
    if (!editableJobSpec) return

    // Organization is now optional - no validation required

    setIsCreatingProject(true)
    try {
      console.log('🚀 Creating sourcing project...')
      console.log('📁 Organization ID:', selectedOrgId)
      console.log('🔗 Job ID (optional):', selectedJobId || 'none')

      // Normalize location for sourcing compatibility
      const rawLocation = editableJobSpec.location || ''
      let normalizedLocations: string[]
      
      // Check if location is already in valid sourcing format
      if (isValidSourcingLocation(rawLocation)) {
        normalizedLocations = [rawLocation]
        console.log('📍 Location already in sourcing format:', rawLocation)
      } else {
        // Normalize the freeform location
        normalizedLocations = normalizeLocationForSourcing(rawLocation)
        console.log('📍 Normalized location:', rawLocation, '→', normalizedLocations)
        
        // If normalization returned empty and we have location_details from AI, try using that
        if (normalizedLocations.length === 0 && (editableJobSpec as any).location_details) {
          const details = (editableJobSpec as any).location_details
          if (details.country_code) {
            if (details.city && details.state) {
              normalizedLocations = [`${details.city},${details.state},${details.country_code}`]
            } else if (details.state) {
              normalizedLocations = [`${details.state},${details.country_code}`]
            } else {
              normalizedLocations = [details.country_code]
            }
            console.log('📍 Used location_details for normalization:', normalizedLocations)
          } else if (details.region && details.is_remote) {
            // Handle regional remote - expand to country codes
            const regionCodes = {
              'LATAM': ['MX', 'CO', 'AR', 'BR', 'CL', 'PE'],
              'EMEA': ['GB', 'DE', 'FR', 'ES', 'IT', 'NL'],
              'APAC': ['IN', 'SG', 'AU', 'JP'],
              'NORTH_AMERICA': ['US', 'CA']
            }
            normalizedLocations = regionCodes[details.region as keyof typeof regionCodes] || []
            console.log('📍 Expanded region to countries:', details.region, '→', normalizedLocations)
          }
        }
      }

      const { data: project, error: projectError } = await supabase.functions.invoke('create-sourcing-project', {
        body: {
          name: `${selectedTitle} - ${editableJobSpec.location}`,
          description: prompt,
          job_id: selectedJobId || null,  // Optional job link
          organization_id: selectedOrgId,  // Direct org assignment
          conversationId: projectConversationId || undefined, // Link conversation to project
          search_criteria: {
            skills: editableSkills,
            locations: normalizedLocations,
            title_keywords: [
              selectedTitle,
              ...(editableJobSpec.alt_titles || [])
            ],
            salary_min: editableJobSpec.salary_range.min,
            salary_max: editableJobSpec.salary_range.max,
            currency: editableJobSpec.salary_range.currency
          },
          // Store full AI-generated job spec for later job creation
          job_spec_data: {
            job_title: selectedTitle,
            alt_titles: editableJobSpec.alt_titles,
            job_description: editableJobSpec.job_description,
            level: editableJobSpec.level,
            department: editableJobSpec.department,
            location: editableJobSpec.location,
            location_details: (editableJobSpec as any).location_details,
            salary_range: editableJobSpec.salary_range,
            skills: editableSkills,
            recommendations: editableJobSpec.recommendations,
            research_metadata: (editableJobSpec as any).research_metadata
          }
        }
      })

      if (projectError) {
        throw new Error(projectError.message)
      }

      console.log('✅ Sourcing project created:', project.id)

      toast({
        title: 'Search Created',
        description: selectedJobId 
          ? `Finding candidates for "${selectedTitle}" linked to job...`
          : `Finding candidates for "${selectedTitle}"...`,
      })

      if (onProjectCreated) {
        onProjectCreated(project.id)
      }

      setShowModal(false)
      setProjectConversationId(null) // Reset conversation link
      
    } catch (error: any) {
      console.error('Error creating sourcing project:', error)
      toast({
        title: 'Failed to Create Search',
        description: error.message || 'An error occurred while creating the search.',
        variant: 'destructive'
      })
    } finally {
      setIsCreatingProject(false)
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
        return isCreatingProject ? 'Creating Search...' : 'Find Candidates'
      default:
        return 'Continue'
    }
  }

  const canContinue = () => {
    switch (currentStep) {
      case 'prompt':
        return jobSpec !== null
      case 'specs':
        return editableJobSpec !== null && !isCreatingProject
      default:
        return false
    }
  }

  return (
    <>
      {/* Main Prompt Card - ChatGPT Style */}
      <div className="space-y-6">

        {/* Chat History - shown when in chat mode and has messages */}
        {chatMode && chatMessages.length > 0 && (
          <div className="max-w-3xl mx-auto mb-6 space-y-4 max-h-[400px] overflow-y-auto p-4 bg-surface-primary rounded-lg border border-border">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <img 
                    src={gioAvatar} 
                    alt="Gio"
                    className="h-8 w-8 rounded-full flex-shrink-0"
                  />
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-surface-secondary text-foreground'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold">
                    {user?.email?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            ))}
            {/* Show typing dots only when waiting for first token, not during streaming */}
            {isChatLoading && !isStreaming && (
              <div className="flex gap-3 justify-start">
                <img src={gioAvatar} alt="Gio" className="h-8 w-8 rounded-full" />
                <div className="bg-surface-secondary rounded-2xl px-4 py-3 flex items-center gap-1">
                  {/* Typing animation dots */}
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            {/* Auto-scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Create Job Specs Button - shown when ready */}
        {chatMode && isReadyForCreation && (
          <div className="max-w-3xl mx-auto mb-4">
            <Button 
              onClick={handleCreateJobSpecsFromChat}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Job Specs...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Create Job Specs from Conversation</>
              )}
            </Button>
          </div>
        )}

        {/* Restore Previous Conversation Button - PHASE 3 */}
        {!chatMode && preservedConversation.length > 0 && (
          <div className="max-w-3xl mx-auto mb-4">
            <Button 
              variant="outline"
              onClick={() => {
                restoreMessages(preservedConversation)
                setChatMode(true)
                setPreservedConversation([])
              }}
              className="w-full"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Restore Previous Conversation
            </Button>
          </div>
        )}
        
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
            
            {/* Toggle and Send Button */}
            <div className="flex items-center gap-2 flex-shrink-0 pb-1">
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                Chat with Gio
              </span>
              <Switch 
                checked={chatMode} 
                onCheckedChange={handleToggleChatMode}
              />
              {prompt.trim().length > 0 && (
                <button
                  onClick={chatMode ? handleSendChatMessage : handleGenerate}
                  disabled={chatMode ? isChatLoading : (!canGenerate || isGenerating || isSearchDisabled)}
                  title={
                    isSearchDisabled 
                      ? 'Monthly search credit limit reached' 
                      : chatMode 
                        ? 'Send message to Gio'
                        : canGenerate ? 'Generate job specification' : 'Enter at least 10 words'
                  }
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-virgilio-text hover:bg-black disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {(isGenerating || isChatLoading) ? (
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4 text-white" />
                  )}
                </button>
              )}
            </div>
          </div>
          
          {/* Word Count - hide in chat mode */}
          {!chatMode && (
            <div className="absolute -bottom-6 right-2 text-xs text-gray-400">
              {wordCount} words
            </div>
          )}
        </div>

        {/* Validation Pills - only show in normal mode */}
        {!chatMode && (
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
        )}
      </div>

      <Sheet open={showModal} onOpenChange={setShowModal}>
        <SheetContent side="right" className="w-full sm:w-[1050px] lg:w-[1400px] overflow-y-auto p-0">
          <SheetHeader className="space-y-4 border-b border-virgilio-border pb-6 px-6 pt-6 sticky top-0 bg-background z-10">
            <div className="flex items-center gap-3">
              <img 
                src={gioAvatar} 
                alt="Gio AI Assistant"
                className="h-12 w-12 rounded-full"
              />
              <div className="flex-1">
                <SheetTitle className="text-h4-mobile font-poppins font-bold text-virgilio-text tracking-page-title">
                  We're almost done<span className="text-virgilio-purple">.</span>
                </SheetTitle>
                <p className="text-sm text-virgilio-muted mt-1">
                  Review the final details
                </p>
              </div>
            </div>
            
          </SheetHeader>
          
          {editableJobSpec && (
            <>
              {/* Scrollable Content Area */}
              <div className="px-6 pb-32">
                {/* Step 1: Prompt */}
                {currentStep === 'prompt' && (
                  <div className="space-y-4 pt-6">
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2 text-text-secondary">Original Prompt</h4>
                      <p className="text-sm text-text-tertiary">{prompt}</p>
                    </div>
                  </div>
                )}

                {/* Step 2: Specs */}
                {currentStep === 'specs' && (
                  <div className="space-y-6 pt-6">
                    {/* Organization Selector - Optional */}
                    <div className="space-y-2">
                      <Label htmlFor="organization-select">
                        Job Folder (Department) <span className="text-muted-foreground text-xs">(optional)</span>
                      </Label>
                      <SearchableSelect
                        options={(childOrgs || []).map(org => ({
                          value: org.id,
                          label: org.name
                        }))}
                        value={selectedOrgId}
                        onValueChange={(value) => {
                          setSelectedOrgId(value)
                          setSelectedJobId('')  // Reset job selection when org changes
                        }}
                        placeholder={isLoadingOrgs ? "Loading organizations..." : "Select a job folder..."}
                        disabled={isLoadingOrgs}
                        searchPlaceholder="Search folders..."
                        onCreateNew={() => setIsOrgFormOpen(true)}
                        createNewLabel="Create Department"
                      />
                      <p className="text-xs text-muted-foreground">
                        You can link this search to a job later from the project settings.
                      </p>
                    </div>

                    {/* Job Selector - Optional */}
                    {selectedOrgId && jobsInOrg.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="job-select">
                          Link to Existing Job <span className="text-muted-foreground">(Optional)</span>
                        </Label>
                        <SearchableSelect
                          options={[
                            { value: '', label: 'No job (standalone search)' },
                            ...jobsInOrg.map(job => ({
                              value: job.id,
                              label: job.title,
                              badge: job.status === 'open' ? 'Open' : job.status === 'draft' ? 'Draft' : undefined
                            }))
                          ]}
                          value={selectedJobId}
                          onValueChange={setSelectedJobId}
                          placeholder="Select a job to link to..."
                          searchPlaceholder="Search jobs..."
                        />
                        <p className="text-xs text-muted-foreground">
                          {selectedJobId 
                            ? '✅ Candidates will be available in this job\'s pipeline' 
                            : '📊 Candidates will be saved for review without a specific job'}
                        </p>
                      </div>
                    )}

                    {/* Job Title */}
                    <div className="space-y-2">
                      <Label>Job Title</Label>
                      <Input
                        value={selectedTitle}
                        onChange={(e) => setSelectedTitle(e.target.value)}
                      />
                      
                      {editableJobSpec.alt_titles.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-text-tertiary">Suggested Alternatives</Label>
                          <div className="flex flex-wrap gap-2">
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
                      <Label>Department</Label>
                      <Input
                        value={editableJobSpec.department}
                        onChange={(e) => handleFieldUpdate('department', e.target.value)}
                      />
                    </div>

                    {/* Location */}
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        value={editableJobSpec.location}
                        onChange={(e) => handleFieldUpdate('location', e.target.value)}
                      />
                    </div>

                    {/* Salary Range */}
                    <div className="space-y-2">
                      <Label>Salary Range</Label>
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
                      <p className="text-xs text-text-tertiary">
                        Period: {editableJobSpec.salary_range.period}
                      </p>
                    </div>

                    {/* Skills */}
                    <div className="space-y-2">
                      <Label>Skills</Label>
                      <SkillsEditor
                        skills={editableSkills}
                        onSkillsChange={setEditableSkills}
                        location={editableJobSpec.location}
                        salaryMin={editableJobSpec.salary_range.min}
                        salaryMax={editableJobSpec.salary_range.max}
                        currency={editableJobSpec.salary_range.currency}
                      />
                    </div>

                    {/* Job Description */}
                    <div className="space-y-2">
                      <Label>Job Description</Label>
                      <RichTextEditor
                        value={editableJobSpec.job_description}
                        onChange={(value) => handleFieldUpdate('job_description', value)}
                        placeholder="Job description will appear here..."
                      />
                    </div>
                  </div>
                )}

              </div>

              {/* Sticky Footer */}
              <div className="p-6 border-t border-virgilio-border flex justify-end gap-2 sticky bottom-0 bg-background z-10">
                {currentStep === 'prompt' && (
                  <Button
                    onClick={handleContinue}
                    disabled={!canContinue()}
                    size="lg"
                    className="bg-virgilio-purple hover:bg-virgilio-purple/90"
                  >
                    <Sparkles className="h-5 w-5 mr-2" />
                    {getContinueButtonText()}
                  </Button>
                )}
                
                {currentStep === 'specs' && (
                  <Button
                    onClick={handleContinue}
                    disabled={!canContinue()}
                    size="lg"
                    className="bg-virgilio-purple hover:bg-virgilio-purple/90 text-white"
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
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Organization Creation Form */}
      <OrganizationFormSheet
        isOpen={isOrgFormOpen}
        onClose={() => setIsOrgFormOpen(false)}
        onSubmit={async (data) => {
          const result = await createOrganization({ 
            name: data.name, 
            status: data.status as 'active' | 'inactive' 
          })
          if (result && typeof result === 'object' && 'id' in result) {
            setSelectedOrgId(result.id)
            refetchOrgs()
          }
          setIsOrgFormOpen(false)
        }}
        isLoading={isCreatingOrg}
      />
    </>
  )
}