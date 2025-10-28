import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useResumeParsing } from '@/hooks/useResumeParsing'
import { useSkillsGeneration } from '@/hooks/useSkillsGeneration'
import { ParsingAnimation } from '@/components/ui/parsing-animation'
import { sanitizeHtmlForEditor } from '@/utils/htmlSanitizer'
import { markdownToHtml } from '@/utils/markdown'
import { getSkillColor } from '@/utils/skillColors'

export interface ParsedResumeData {
  name?: string
  email?: string
  phone?: string
  profileSummary?: string
}

interface EnhancedResumeDropzoneProps {
  onUpload?: (file: File) => Promise<void>
  onParsed?: (data: ParsedResumeData) => void
  onSkillsGenerated?: (skills: string[]) => void
  isUploading?: boolean
  accept?: string
  maxSizeMb?: number
  // Context for skills generation
  candidateId?: string
  candidateName?: string
  autoGenerateSkills?: boolean
  // UI customization
  className?: string
  showUpload?: boolean // Whether to actually upload files
  parseOnly?: boolean // Only parse, don't upload
}

export function EnhancedResumeDropzone({ 
  onUpload,
  onParsed,
  onSkillsGenerated,
  isUploading = false,
  accept = '.pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.gif,.webp',
  maxSizeMb = 15,
  candidateId,
  candidateName,
  autoGenerateSkills = false,
  className = '',
  showUpload = true,
  parseOnly = false
}: EnhancedResumeDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const { isParsing, parseResume, parseAndUpdateCandidate } = useResumeParsing()
  const { generateSkills, isGenerating, generatedSkills } = useSkillsGeneration()

  const isActive = isProcessing || isParsing || isGenerating || isUploading

  const handleFile = async (file?: File) => {
    if (!file) return
    
    // Validate file size
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast({ 
        title: 'File too large', 
        description: `Max size is ${maxSizeMb}MB`, 
        variant: 'destructive' 
      })
      return
    }

    try {
      setIsProcessing(true)
      
      // Upload file if needed (for existing candidates)
      if (showUpload && onUpload && !parseOnly) {
        await onUpload(file)
      }

      // ✨ PARALLEL EXECUTION: Start both operations simultaneously
      const parsingPromise = (async () => {
        if (candidateId && !parseOnly) {
          return await parseAndUpdateCandidate(file, candidateId)
        } else {
          return await parseResume(file)
        }
      })()

      const skillsPromise = autoGenerateSkills
        ? (async () => {
            // Wait for parsing to get profile summary
            const parsedData = await parsingPromise
            if (parsedData?.profileSummary) {
              try {
                return await generateSkills(
                  parsedData.profileSummary,
                  parsedData.name || candidateName || 'Candidate',
                  { 
                    context: 'candidate', 
                    desiredCount: 20, 
                    minCount: 12 
                  }
                )
              } catch (error) {
                console.error('Skills generation failed:', error)
                return null
              }
            }
            return null
          })()
        : null

      // Wait for both to complete (parsing finishes first, then skills)
      const [parsed, skillsResult] = await Promise.all([
        parsingPromise,
        skillsPromise
      ])

      if (parsed) {
        // Call onParsed callback
        onParsed?.(parsed)

        if (skillsResult?.skills) {
          const skillNames = skillsResult.skills.map(s => s.name).filter(Boolean)
          onSkillsGenerated?.(skillNames)
        }

        const message = autoGenerateSkills 
          ? 'Information extracted and skills generated from your resume.'
          : 'Information extracted from your resume.'
          
        toast({ 
          title: parseOnly ? 'Resume parsed' : 'Resume uploaded and parsed', 
          description: message 
        })
      }
    } catch (error) {
      console.error('Resume processing failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    void handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    void handleFile(file)
    e.currentTarget.value = ''
  }

  return (
    <div className={`relative group ${className}`}>
      <div className={`pointer-events-none absolute -inset-[2px] rounded-lg bg-gradient-to-r from-pastel-purple via-pastel-blue to-info blur-md transition-opacity duration-300 ${dragOver ? 'opacity-80' : 'opacity-50'} pulse`} />
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors bg-pastel-purple/10 ${dragOver ? 'border-pastel-purple bg-pastel-purple/15' : 'border-pastel-purple/70 hover:border-pastel-purple'}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        aria-busy={isActive}
        aria-live="polite"
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
          accept={accept}
        />
        <Sparkles className="h-8 w-8 mx-auto text-pastel-purple-foreground mb-2" />
        <p className="text-sm text-text-secondary mb-2">Upload here, and watch some magic!</p>
        <p className="text-xs text-text-secondary mb-4">
          {accept.includes('.jpg') ? 'PDF, DOC, DOCX, TXT or images' : 'PDF, DOC, DOCX, TXT'} up to {maxSizeMb}MB
        </p>
        <Button
          type="button"
          variant="default"
          onClick={() => inputRef.current?.click()}
          disabled={isActive}
          className="gap-sm bg-pastel-purple text-pastel-purple-foreground border border-pastel-purple-foreground/30 hover:bg-pastel-purple/80 shadow-button"
        >
          {isActive ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isParsing ? 'Parsing…' : isGenerating ? 'Generating skills…' : isUploading ? 'Uploading…' : 'Processing…'}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Choose File
            </>
          )}
        </Button>
        {isActive && (
          <div className="absolute inset-0 rounded-lg bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
            <Loader2 className="h-6 w-6 text-pastel-purple-foreground animate-spin mb-2" />
            <ParsingAnimation 
              isActive={isActive}
            />
          </div>
        )}
        {/* Display generated skills */}
        {generatedSkills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {generatedSkills.slice(0, 30).map((s, idx) => (
              <Badge key={`${s.name}-${idx}`} variant="outline" className={`bg-${getSkillColor(s.name)}/20 text-${getSkillColor(s.name)}-foreground border-${getSkillColor(s.name)}/40`}>
                {s.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}