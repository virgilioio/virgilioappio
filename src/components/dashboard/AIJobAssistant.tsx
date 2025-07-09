import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Sparkles, CheckCircle2, Circle, Briefcase, DollarSign, MapPin, Target, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

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
  }
  skills: string[]
  recommendations: string[]
}

interface ValidationItem {
  id: string
  label: string
  regex: RegExp
  checked: boolean
}

export function AIJobAssistant() {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [jobSpec, setJobSpec] = useState<JobSpec | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedTitle, setSelectedTitle] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { toast } = useToast()

  const validationItems: ValidationItem[] = [
    {
      id: 'role',
      label: 'Role or position title',
      regex: /(engineer|developer|manager|sales|marketing|designer|analyst|coordinator|specialist|director|lead|senior|junior|intern)/i,
      checked: false
    },
    {
      id: 'responsibilities',
      label: 'Key responsibilities or goals',
      regex: /(build|develop|manage|create|lead|implement|design|analyze|coordinate|optimize|drive|execute)/i,
      checked: false
    },
    {
      id: 'industry',
      label: 'Industry or team context',
      regex: /(fintech|startup|ecommerce|saas|healthcare|education|finance|tech|marketing|sales)/i,
      checked: false
    },
    {
      id: 'location',
      label: 'Location or region',
      regex: /(remote|city|country|mexico|usa|canada|europe|asia|latin|america|office|hybrid)/i,
      checked: false
    },
    {
      id: 'outcomes',
      label: 'Desired outcomes or metrics',
      regex: /(revenue|growth|launch|improve|increase|scale|optimize|reduce|enhance|achieve)/i,
      checked: false
    }
  ]

  const checkValidation = (text: string) => {
    return validationItems.map(item => ({
      ...item,
      checked: item.regex.test(text)
    }))
  }

  const currentValidation = checkValidation(prompt)
  const validItemsCount = currentValidation.filter(item => item.checked).length
  const wordCount = prompt.trim().split(/\s+/).filter(word => word.length > 0).length
  const canGenerate = wordCount >= 10

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
        setSelectedTitle(data.jobSpec.job_title)
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

  const handleSelfService = () => {
    // TODO: Implement Stripe payment flow
    toast({
      title: 'Self-Service Option',
      description: 'Payment integration coming soon!',
    })
  }

  const handleFullService = () => {
    // TODO: Submit job request to CSM/recruiter
    toast({
      title: 'Full-Service Request',
      description: 'Your request has been submitted to our team!',
    })
    setShowModal(false)
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
                AI Job Assistant
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
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the role you're looking to fill... (e.g., 'I need a senior sales rep for our fintech startup to build outbound pipeline in Mexico City and drive 30% revenue growth')"
                  className="min-h-[100px] resize-none border-2 bg-background/50 backdrop-blur-sm focus:border-primary transition-all duration-300"
                  style={{
                    background: 'hsl(var(--background))',
                    borderImage: canGenerate ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary))) 1' : undefined
                  }}
                />
                <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
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

              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
                className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
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
            </CardContent>
          </div>
        </Card>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI-Generated Job Specification</DialogTitle>
          </DialogHeader>
          
          {jobSpec && (
            <div className="space-y-6">
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
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Required Skills</h4>
                    <div className="flex flex-wrap gap-1">
                      {jobSpec.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="bg-gradient-to-r from-primary/10 to-accent/10">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Job Description */}
              <div>
                <h4 className="text-sm font-medium mb-2">Job Description</h4>
                <div className="p-4 bg-muted rounded-lg text-sm">
                  {jobSpec.job_description}
                </div>
              </div>

              {/* AI Recommendations */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  AI Insights & Recommendations
                </h4>
                <div className="space-y-2">
                  {jobSpec.recommendations.map((rec, index) => (
                    <div key={index} className="p-3 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border border-primary/10">
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Service Selection */}
              <div className="border-t pt-6">
                <h4 className="text-lg font-semibold mb-4">How would you like to proceed?</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <Button
                    onClick={handleSelfService}
                    className="h-auto p-6 flex-col items-start text-left space-y-2"
                    variant="outline"
                  >
                    <div className="font-semibold text-yellow-600">🟡 Self-Service</div>
                    <div className="text-sm text-muted-foreground">
                      Pay-per-job via Stripe • Dashboard access • No recruiter • No guarantee
                    </div>
                    <div className="text-sm font-medium">Pay & Manage Myself</div>
                  </Button>
                  
                  <Button
                    onClick={handleFullService}
                    className="h-auto p-6 flex-col items-start text-left space-y-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                  >
                    <div className="font-semibold text-white">🟢 Full-Service by Virgilio</div>
                    <div className="text-sm text-green-100">
                      CSM + recruiter • Sourcing • Vetting • Offers • Guarantee
                    </div>
                    <div className="text-sm font-medium text-white">Request Virgilio Support</div>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}