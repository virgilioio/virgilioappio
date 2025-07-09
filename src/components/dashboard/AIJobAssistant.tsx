import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Sparkles, CheckCircle2, Circle, Briefcase, DollarSign, MapPin, Target, ChevronDown, ChevronUp, TrendingUp, Clock, Users, Award, ArrowLeft } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { validateJobPrompt, getValidationStats, type ValidationItem } from '@/utils/jobPromptValidation'

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

export function AIJobAssistant() {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [jobSpec, setJobSpec] = useState<JobSpec | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedTitle, setSelectedTitle] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [dialogStep, setDialogStep] = useState<'review' | 'proceed'>('review')
  const [isFocused, setIsFocused] = useState(false)
  const { toast } = useToast()

  const currentValidation = validateJobPrompt(prompt)
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
        setDialogStep('review')
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
                        {jobSpec.skills.map((skill, index) => {
                          const pastelColors = [
                            'bg-pink-100 text-pink-700 border-pink-200',
                            'bg-blue-100 text-blue-700 border-blue-200',
                            'bg-green-100 text-green-700 border-green-200',
                            'bg-yellow-100 text-yellow-700 border-yellow-200',
                            'bg-purple-100 text-purple-700 border-purple-200',
                            'bg-indigo-100 text-indigo-700 border-indigo-200',
                            'bg-orange-100 text-orange-700 border-orange-200',
                            'bg-teal-100 text-teal-700 border-teal-200'
                          ]
                          const colorClass = pastelColors[index % pastelColors.length]
                          
                          return (
                            <span key={index} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
                              {skill}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Job Description */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Job Description</h4>
                  <div className="p-4 bg-muted rounded-lg text-sm" dangerouslySetInnerHTML={{ __html: jobSpec.job_description }} />
                </div>

                {/* Continue/Service Selection */}
                {dialogStep === 'review' ? (
                  <div className="border-t pt-6 flex justify-end">
                    <Button
                      onClick={() => setDialogStep('proceed')}
                      className="px-8 py-3 text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#7e3eff' }}
                    >
                      Continue
                    </Button>
                  </div>
                ) : (
                  <div className="border-t pt-6">
                    <div className="flex items-center gap-3 mb-8">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDialogStep('review')}
                        className="flex items-center gap-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <h4 className="text-xl font-semibold">How would you like to proceed?</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Self-Service Option */}
                      <div className="relative group">
                        <div className="h-full p-8 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl transition-all duration-300 hover:shadow-lg hover:border-yellow-300">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <h5 className="text-lg font-bold text-yellow-700">Self-Service</h5>
                          </div>
                          
                          <div className="space-y-4 mb-6">
                            <p className="text-yellow-800 font-medium">Take control and manage everything yourself</p>
                            <ul className="space-y-2 text-sm text-yellow-700">
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-yellow-600" />
                                Pay-per-job via Stripe
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-yellow-600" />
                                Full dashboard access
                              </li>
                              <li className="flex items-center gap-2">
                                <Circle className="h-4 w-4 text-yellow-400" />
                                No dedicated recruiter
                              </li>
                              <li className="flex items-center gap-2">
                                <Circle className="h-4 w-4 text-yellow-400" />
                                No guarantee
                              </li>
                            </ul>
                          </div>
                          
                          <Button
                            onClick={handleSelfService}
                            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3"
                          >
                            Choose Self-Service
                          </Button>
                        </div>
                      </div>

                      {/* Full-Service Option */}
                      <div className="relative group">
                        <div className="h-full p-8 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl transition-all duration-300 hover:shadow-lg hover:border-green-300">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <h5 className="text-lg font-bold text-green-700">Full-Service by Virgilio</h5>
                          </div>
                          
                          <div className="space-y-4 mb-6">
                            <p className="text-green-800 font-medium">Let our experts handle everything for you</p>
                            <ul className="space-y-2 text-sm text-green-700">
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                Dedicated CSM + recruiter
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                Professional sourcing & vetting
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                Offer management
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                Success guarantee
                              </li>
                            </ul>
                          </div>
                          
                          <Button
                            onClick={handleFullService}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                          >
                            Request Virgilio Support
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - AI Insights & Recommendations */}
              <div className="lg:col-span-1">
                <div className="sticky top-4">
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
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}