import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Sparkles, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { sanitizeHtmlForEditor } from '@/utils/htmlSanitizer'
import { markdownToHtml } from '@/utils/markdown'
import { useResumeParsing } from '@/hooks/useResumeParsing'
import { useSkillsGeneration } from '@/hooks/useSkillsGeneration'
import { useCandidates } from '@/hooks/useCandidates'
import { useIndependentCandidates } from '@/hooks/useIndependentCandidates'
import { supabase } from '@/integrations/supabase/client'
import { getSkillColor } from '@/utils/skillColors'
import { EnhancedResumeDropzone, ParsedResumeData } from './EnhancedResumeDropzone'

interface CandidateFormSheetProps {
  isOpen: boolean
  onClose: () => void
  jobId?: string
}

interface FormValues {
  candidate_name: string
  email?: string
  phone?: string
  linkedin_url?: string
  source?: string
}

export default function CandidateFormSheet({ isOpen, onClose, jobId }: CandidateFormSheetProps) {
  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<FormValues>({
    defaultValues: { candidate_name: '', email: '', phone: '', linkedin_url: '', source: 'direct' }
  })

  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [profileSummary, setProfileSummary] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const { isParsing, parseResume, parseAndUpdateCandidate } = useResumeParsing()
  const { generateSkills, isGenerating } = useSkillsGeneration()

  // Hooks for submission depending on context
  const jobCandidates = useCandidates(jobId || '')
  const independent = useIndependentCandidates()

  const resetAll = () => {
    reset({ candidate_name: '', email: '', phone: '', linkedin_url: '', source: 'direct' })
    setSkills([])
    setNewSkill('')
    setProfileSummary('')
    setPendingFiles([])
  }

  useEffect(() => {
    if (!isOpen) {
      resetAll()
    }
  }, [isOpen])

  const addSkill = () => {
    const s = newSkill.trim()
    if (!s) return
    if (!skills.includes(s)) setSkills((v) => [...v, s])
    setNewSkill('')
  }
  const removeSkill = (s: string) => setSkills((v) => v.filter((x) => x !== s))


  const removePendingFile = (name: string, size: number) => {
    setPendingFiles((prev) => prev.filter((f) => !(f.name === name && f.size === size)))
  }

  // Upload resume for job candidate (attachments table)
  const uploadForJobCandidate = async (jobCandidateId: string, file: File) => {
    const ext = file.name.split('.').pop()
    const storagePath = `${jobCandidateId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: storageError } = await supabase.storage
      .from('candidate-attachments')
      .upload(storagePath, file)
    if (storageError) throw storageError

    const { error: dbError } = await supabase
      .from('candidate_attachments')
      .insert({
        candidate_id: jobCandidateId,
        file_name: file.name,
        file_url: storagePath,
        file_size_bytes: file.size,
        file_type: file.type,
      })
    if (dbError) {
      await supabase.storage.from('candidate-attachments').remove([storagePath])
      throw dbError
    }
  }

  // Upload resume for independent candidate (store path in candidates.resume_url)
  const uploadForIndependentCandidate = async (independentId: string, file: File) => {
    const ext = file.name.split('.').pop()
    const path = `independent/${independentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: storageError } = await supabase.storage
      .from('candidate-attachments')
      .upload(path, file)
    if (storageError) throw storageError

    const { error: dbError } = await supabase
      .from('candidates')
      .update({ resume_url: path })
      .eq('id', independentId)
    if (dbError) throw dbError
    return path
  }

  const onSubmit = handleSubmit(async (data) => {
    try {
      const sanitizedSummary = profileSummary?.trim() ? sanitizeHtmlForEditor(profileSummary) : null
      const basePayload = {
        candidate_name: data.candidate_name,
        linkedin_url: data.linkedin_url?.trim() || null,
        profile_summary: sanitizedSummary,
        skills: skills.length ? skills : null,
      }

      if (jobId) {
        // Create as job candidate (this also ensures global candidate record exists)
        const result = await jobCandidates.addCandidate({
          ...basePayload,
          email: data.email?.trim() || null,
          phone: data.phone?.trim() || null,
        })

        // Upload any queued files to job candidate attachments
        if (pendingFiles.length > 0 && (result as any)?.id) {
          setIsUploading(true)
          for (const f of pendingFiles) {
            await uploadForJobCandidate((result as any).id, f)
          }
          setIsUploading(false)
          toast({ title: 'Resume uploaded', description: 'Attachment added to candidate.' })
        }
      } else {
        // Create independent candidate
        const created = await independent.addCandidate({
          ...basePayload,
          email: data.email?.trim() || null,
          phone: data.phone?.trim() || null,
          source: data.source || 'direct',
        })

        // Upload queued files and parse to enrich profile
        if (created?.id && pendingFiles.length > 0) {
          setIsUploading(true)
          const first = pendingFiles[0]
          await uploadForIndependentCandidate(created.id, first)
          // Parse to update name/email/phone/summary if useful
          await parseAndUpdateCandidate(first, created.id)
          setIsUploading(false)
          toast({ title: 'Resume uploaded', description: 'Resume saved and profile updated.' })
        }
      }

      // Cleanup and close
      resetAll()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add candidate'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    }
  })

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-[640px] h-full p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-4 border-b border-border">
            <SheetTitle className="text-lg">Add New Candidate</SheetTitle>
            <SheetDescription>Quickly add a candidate. Resume upload is optional and will be parsed.</SheetDescription>
          </SheetHeader>

          <form onSubmit={onSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Resume Upload */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-primary">Resume</h3>
              <EnhancedResumeDropzone
                onUpload={async (file) => {
                  setPendingFiles(prev => [...prev, file])
                }}
                onParsed={(parsed: ParsedResumeData) => {
                  if (parsed.name) setValue('candidate_name', parsed.name)
                  if (parsed.email) setValue('email', parsed.email)
                  if (parsed.phone) setValue('phone', parsed.phone)
                  if (parsed.profileSummary && parsed.profileSummary.trim().length > 0) {
                    const html = markdownToHtml(parsed.profileSummary)
                    const sanitized = sanitizeHtmlForEditor(html)
                    setProfileSummary(sanitized)
                  }
                }}
                onSkillsGenerated={(newSkills: string[]) => {
                  const uniqueSkills = [...new Set([...skills, ...newSkills])]
                  setSkills(uniqueSkills)
                }}
                candidateName={watch('candidate_name')}
                autoGenerateSkills={true}
                showUpload={false}
                parseOnly={true}
                accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.gif,.webp"
                maxSizeMb={15}
              />

              {pendingFiles.length > 0 && (
                <div className="mt-2 text-left space-y-2">
                  {pendingFiles.map((f) => (
                    <div key={f.name + f.size} className="flex items-center justify-between p-2 border border-border rounded-md">
                      <span className="text-sm text-text-primary truncate mr-2">{f.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removePendingFile(f.name, f.size)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="candidate_name">Full Name *</Label>
                  <Input id="candidate_name" placeholder="John Doe" {...register('candidate_name', { required: 'Name is required' })} />
                  {errors.candidate_name && <p className="text-sm text-destructive">{errors.candidate_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="john@example.com" {...register('email')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="+1 (555) 123-4567" {...register('phone')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                  <Input id="linkedin_url" placeholder="https://linkedin.com/in/johndoe" {...register('linkedin_url')} />
                </div>
              </div>
            </div>

            {/* Skills */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-primary">Skills</h3>
              <div className="flex gap-2">
                <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }} placeholder="Add a skill (e.g., React)" className="flex-1" />
                <Button type="button" onClick={addSkill} variant="outline" size="sm"><Plus className="h-4 w-4" /></Button>
              </div>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <Badge key={s} variant={getSkillColor(s)} className="flex items-center gap-1">
                      {s}
                      <button type="button" onClick={() => removeSkill(s)} className="ml-1 rounded-full hover:bg-destructive hover:text-destructive-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Profile Summary */}
            <div className="space-y-2">
              <Label htmlFor="profile_summary">Profile Summary</Label>
              <RichTextEditor value={profileSummary} onChange={setProfileSummary} placeholder="Brief summary of the candidate's background and experience..." minHeight="150px" />
            </div>

            {/* Source (independent only) */}
            {!jobId && (
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select defaultValue="direct" onValueChange={(v) => setValue('source', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="job_import">Job Import</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form>

          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => { resetAll(); onClose(); }}>Cancel</Button>
            <Button type="submit" onClick={() => { const form = document.querySelector('form'); (form as HTMLFormElement | null)?.requestSubmit?.() }}>Save Candidate</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
