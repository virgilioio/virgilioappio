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
import { Loader2, Sparkles, CheckCircle2, Circle, Briefcase, DollarSign, MapPin, Target, ChevronDown, ChevronUp, TrendingUp, Clock, Users, Award, Building2, Edit2, BarChart3, AlertTriangle, PieChart, RefreshCw, ArrowUp, ArrowRight, MessageSquare, Paperclip, Link2 } from 'lucide-react'
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
  variant?: 'default' | 'find'
}

// Fallback: detect and fix Spanish job titles when prompt was in English
const SPANISH_TO_ENGLISH_TITLES: Record<string, string> = {
  'Gerente': 'Manager', 'Director': 'Director', 'Ingeniero': 'Engineer',
  'Desarrollador': 'Developer', 'Analista': 'Analyst', 'Analistas': 'Analysts',
  'Coordinador': 'Coordinator', 'Especialista': 'Specialist', 'Consultor': 'Consultant',
  'Ejecutivo': 'Executive', 'Representante': 'Representative', 'Arquitecto': 'Architect',
  'Diseñador': 'Designer', 'Disenador': 'Designer', 'Investigador': 'Researcher',
  'Administrador': 'Administrator', 'Contador': 'Accountant', 'Vendedor': 'Sales Representative',
  'Reclutador': 'Recruiter', 'Programador': 'Programmer',
  'Líder': 'Lead', 'Lider': 'Lead', 'Jefe': 'Head', 'Supervisor': 'Supervisor',
  'Equipo': 'Team', 'Ventas': 'Sales', 'Comercial': 'Commercial', 'Comerciales': 'Commercial',
  'Operaciones': 'Operations', 'Recursos': 'Resources', 'Humanos': 'Human',
  'Recursos Humanos': 'Human Resources', 'Mercadotecnia': 'Marketing', 'Mercadeo': 'Marketing',
  'Tecnología': 'Technology', 'Finanzas': 'Finance', 'Contabilidad': 'Accounting',
  'Tecnico': 'Technical', 'Producto': 'Product', 'Proyecto': 'Project', 'Proyectos': 'Projects',
  'Datos': 'Data', 'Seguridad': 'Security', 'Calidad': 'Quality', 'Investigacion': 'Research',
  'Soporte': 'Support', 'Atencion': 'Service', 'Cliente': 'Client', 'Clientes': 'Clients',
  'Cuenta': 'Account', 'Cuentas': 'Accounts', 'Negocios': 'Business', 'Gestion': 'Management',
  'Estrategia': 'Strategy', 'Analisis': 'Analysis',
  'Asistente': 'Assistant', 'Asociado': 'Associate',
}

function sanitizeText(text: string): string {
  let sanitized = text
  for (const [es, en] of Object.entries(SPANISH_TO_ENGLISH_TITLES)) {
    const regex = new RegExp(`\\b${es}\\b`, 'gi')
    if (regex.test(sanitized)) {
      sanitized = sanitized.replace(regex, en)
    }
  }
  sanitized = sanitized.replace(/\bde\b/gi, 'of').replace(/\bdel\b/gi, 'of the').replace(/\bel\b/gi, 'the').replace(/\bla\b/gi, 'the').replace(/\blos\b/gi, 'the').replace(/\blas\b/gi, 'the').replace(/\by\b/gi, 'and').replace(/\s+/g, ' ').trim()
  return sanitized
}

function isEnglishPrompt(promptText: string): boolean {
  const englishWords = ['need', 'looking', 'want', 'hire', 'find', 'with', 'the', 'for', 'who', 'manager', 'engineer', 'developer']
  const lowerPrompt = promptText.toLowerCase()
  return englishWords.filter(w => lowerPrompt.includes(w)).length >= 2
}

function sanitizeJobTitle(title: string, promptText: string): string {
  if (!isEnglishPrompt(promptText)) return title
  return sanitizeText(title)
}

function sanitizeJobSpec(spec: any, promptText: string): any {
  if (!isEnglishPrompt(promptText)) return spec
  const sanitized = {
    ...spec,
    job_title: sanitizeText(spec.job_title || ''),
    alt_titles: (spec.alt_titles || []).map((t: string) => sanitizeText(t)),
    department: spec.department ? sanitizeText(spec.department) : spec.department,
  }
  // Also sanitize research metadata if present
  if (sanitized.research_metadata) {
    sanitized.research_metadata = {
      ...sanitized.research_metadata,
      researched_titles: (sanitized.research_metadata.researched_titles || []).map((t: string) => sanitizeText(t)),
      researched_keywords: (sanitized.research_metadata.researched_keywords || []).map((k: string) => sanitizeText(k)),
    }
  }
  return sanitized
}

export function AIJobAssistant({ onProjectCreated, onGeneratingChange, variant = 'default' }: AIJobAssistantProps = {}) {
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
  const [orgSelectError, setOrgSelectError] = useState<string | null>(null)
  const orgSelectRef = useRef<HTMLDivElement>(null)
  
  // Chat mode state
  const [chatMode, setChatMode] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { jobs } = useJobs()
  const navigate = useNavigate()
  const { user, organizationId, userType } = useAuth()
  useSourcingCreditWarnings() // Initialize credit warnings
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
    // Submit on Enter (without Shift) or Cmd/Ctrl+Enter
    if ((e.key === 'Enter' && !e.shiftKey) || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
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
        setSelectedTitle(sanitizeJobTitle(data.jobSpec.job_title, chatMessages.map(m => m.content).join(' ')))
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

      const generatedSpec = sanitizeJobSpec(data.jobSpec, prompt)
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
          
          // Priority 1: Explicit country_codes array (e.g., ["IN", "PH"] from "India or Philippines")
          if (details.country_codes && Array.isArray(details.country_codes) && details.country_codes.length > 0) {
            normalizedLocations = details.country_codes
            console.log('Using explicit country_codes from AI:', details.country_codes)
          }
          // Priority 2: Single country_code (legacy path)
          else if (details.country_code) {
            if (details.city && details.state) {
              normalizedLocations = [`${details.city},${details.state},${details.country_code}`]
            } else if (details.state) {
              normalizedLocations = [`${details.state},${details.country_code}`]
            } else {
              normalizedLocations = [details.country_code]
            }
          }
          // Priority 3: Region expansion (only when no specific countries given)
          else if (details.region && details.is_remote) {
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
            title_keywords: [title, ...(generatedSpec.alt_titles || [])].filter((t: string) => t && t.length > 0).map((t: string) => isEnglishPrompt(prompt) ? sanitizeText(t) : t),
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

    // Clear previous errors
    setOrgSelectError(null)

    // Validate required fields - Job Folder is mandatory
    if (!selectedOrgId && !selectedJobId) {
      setOrgSelectError('Please select a Job Folder (Department)')
      
      // Scroll to the field with highlight
      if (orgSelectRef.current) {
        orgSelectRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        })
        
        // Add highlight animation
        orgSelectRef.current.classList.add('onboarding-highlight')
        setTimeout(() => {
          orgSelectRef.current?.classList.remove('onboarding-highlight')
        }, 3000)
      }
      return
    }

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
        
        {/* Composer */}
        {variant === 'find' ? (
          <FindComposer
            prompt={prompt}
            textareaRef={textareaRef}
            handlePromptChange={handlePromptChange}
            handleKeyDown={handleKeyDown}
            setIsFocused={setIsFocused}
            isFocused={isFocused}
            chatMode={chatMode}
            handleToggleChatMode={handleToggleChatMode}
            onSubmit={chatMode ? handleSendChatMessage : handleGenerate}
            canSubmit={chatMode ? !!prompt.trim() && !isChatLoading : (canGenerate && !isGenerating)}
            isWorking={isGenerating || isChatLoading}
            validation={currentValidation}
            validCount={validItemsCount}
          />
        ) : (
          <>
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
                      disabled={chatMode ? isChatLoading : (!canGenerate || isGenerating)}
                      title={
                        chatMode 
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
          </>
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
                    {/* Organization Selector - Required */}
                    <div ref={orgSelectRef} className="space-y-2">
                      <Label htmlFor="organization-select">
                        Job Folder (Department) <span className="text-destructive">*</span>
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
                          setOrgSelectError(null)  // Clear error on selection
                        }}
                        placeholder={isLoadingOrgs ? "Loading organizations..." : "Select a job folder..."}
                        disabled={isLoadingOrgs}
                        searchPlaceholder="Search folders..."
                        onCreateNew={() => setIsOrgFormOpen(true)}
                        createNewLabel="Create Department"
                        error={orgSelectError || undefined}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Select or create a job folder to organize your search.
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
// ---------------------------------------------------------------------------
// FindComposer — card-style composer used on the Find page (variant="find")
// ---------------------------------------------------------------------------

interface FindComposerProps {
  prompt: string
  textareaRef: React.RefObject<HTMLTextAreaElement>
  handlePromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  setIsFocused: (v: boolean) => void
  isFocused: boolean
  chatMode: boolean
  handleToggleChatMode: (enabled: boolean) => void
  onSubmit: () => void
  canSubmit: boolean
  isWorking: boolean
  validation: ValidationItem[]
  validCount: number
}

function FindComposer({
  prompt,
  textareaRef,
  handlePromptChange,
  handleKeyDown,
  setIsFocused,
  isFocused,
  chatMode,
  handleToggleChatMode,
  onSubmit,
  canSubmit,
  isWorking,
  validation,
  validCount,
}: FindComposerProps) {
  const total = validation.length || 5
  const missing = validation.filter(v => !v.checked).map(v => v.label.toLowerCase())

  let caption = ''
  let captionClass = 'text-text-secondary'
  if (validCount === 0) {
    caption = 'Add a role, location, and what success looks like.'
  } else if (validCount >= total) {
    caption = 'Ready to search.'
    captionClass = 'text-emerald-600'
  } else if (validCount <= 2) {
    caption = `Looking good — add ${missing.slice(0, 2).join(' and ')} for stronger matches.`
  } else {
    caption = `Strong prompt. Add ${missing[0]} to tighten results.`
  }

  return (
    <div className="space-y-2">
      <div
        className={`rounded-2xl border bg-white transition-all ${
          isFocused
            ? 'border-virgilio-purple/40 ring-1 ring-virgilio-purple/30'
            : 'border-border shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
        }`}
      >
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handlePromptChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={
            chatMode
              ? 'Tell Gio what you need…'
              : 'Senior product designer with design-systems experience at a B2B SaaS startup. Open to remote (US), 6+ years…'
          }
          rows={3}
          className="w-full resize-none bg-transparent border-none outline-none px-4 pt-3.5 pb-2 text-[14px] leading-relaxed text-text-primary placeholder:text-text-tertiary min-h-[84px] max-h-[260px]"
          style={{ scrollbarWidth: 'thin' }}
        />

        <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-lg text-[12.5px] font-poppins font-medium text-text-secondary hover:text-text-primary hover:bg-[#F1F0EC] transition-colors"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Attach JD
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-lg text-[12.5px] font-poppins font-medium text-text-secondary hover:text-text-primary hover:bg-[#F1F0EC] transition-colors"
            >
              <Link2 className="h-3.5 w-3.5" />
              Paste LinkedIn URL
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-lg text-[12.5px] font-poppins font-medium text-text-secondary hover:text-text-primary hover:bg-[#F1F0EC] transition-colors"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Use an open job
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] text-text-tertiary">
              <kbd className="px-1 py-0.5 rounded border border-border bg-[#FAFAF7] font-mono text-[10px]">⌘</kbd>
              <span>+</span>
              <kbd className="px-1 py-0.5 rounded border border-border bg-[#FAFAF7] font-mono text-[10px]">Enter</kbd>
            </span>
            <Button
              variant="purple"
              size="md"
              icon={Sparkles}
              iconRight={ArrowRight}
              onClick={onSubmit}
              disabled={!canSubmit}
              loading={isWorking}
            >
              {chatMode ? 'Send' : 'Find candidates'}
            </Button>
          </div>
        </div>
      </div>

      {/* Strength meter + Chat with Gio link */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i < validCount ? 'bg-virgilio-purple' : 'bg-text-tertiary/25'
                }`}
              />
            ))}
          </div>
          <span className={`text-[11.5px] truncate ${captionClass}`}>{caption}</span>
        </div>
        <button
          type="button"
          onClick={() => handleToggleChatMode(!chatMode)}
          className="inline-flex items-center gap-1 text-[11.5px] font-poppins font-medium text-virgilio-purple hover:underline shrink-0"
        >
          {chatMode ? 'Switch back to prompt' : 'Chat with Gio instead'}
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
