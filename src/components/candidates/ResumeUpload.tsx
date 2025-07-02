import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface ResumeUploadProps {
  onDataExtracted: (data: any, metadata?: { confidence?: Record<string, 'high' | 'medium' | 'low'>, extractedSections?: string[] }) => void
  isLoading?: boolean
}

interface ParsedResumeData {
  candidate_name: string
  linkedin_url: string
  location_country: string
  location_state: string
  location_city: string
  salary_amount: number | null
  salary_currency: string
  profile_summary: string
  notes: string
}

export function ResumeUpload({ onDataExtracted, isLoading = false }: ResumeUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [extractedSections, setExtractedSections] = useState<string[]>([])
  const [errorReason, setErrorReason] = useState<string>('')
  const { toast } = useToast()

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOCX, or TXT file.",
        variant: "destructive"
      })
      return
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB.",
        variant: "destructive"
      })
      return
    }

    setUploadedFile(file)
    setUploading(true)
    setUploadStatus('processing')

    try {
      // Convert file to base64
      const fileReader = new FileReader()
      
      fileReader.onload = async () => {
        try {
          const base64Content = (fileReader.result as string).split(',')[1]
          
          console.log(`Uploading file: ${file.name} (${file.type})`)
          
          // Call the edge function
          const { data, error } = await supabase.functions.invoke('parse-resume', {
            body: {
              fileContent: base64Content,
              fileName: file.name,
              fileType: file.type
            }
          })

          if (error) {
            throw new Error(error.message)
          }

          if (!data.success) {
            console.error('Resume parsing failed:', data.error);
            console.log('Error details:', data.details);
            setUploadStatus('error')
            setErrorReason(data.error || 'Processing failed')
            
            // Show detailed error message based on the type of failure
            let errorTitle = "Resume parsing failed";
            let errorDescription = data.error || "Please try again or fill the form manually.";
            
            if (data.details) {
              console.log('Validation details:', data.details);
              
              // Provide more specific guidance based on the validation failure
              if (data.details.textLength < 200) {
                errorTitle = "File appears empty or corrupted";
                errorDescription = "We couldn't extract enough text from this file. Please try a different file format.";
              } else if (data.details.keywordCount === 0 && !data.details.contactInfo?.hasPersonalInfo) {
                errorTitle = "This doesn't appear to be a resume";
                errorDescription = "We couldn't find resume-related content. Please upload a resume document.";
              } else if (data.details.wordCount < 50) {
                errorTitle = "File content is too short";
                errorDescription = "The file doesn't contain enough readable text. Please try a different format.";
              }
            }
            
            toast({
              title: errorTitle,
              description: errorDescription,
              variant: "destructive"
            })
            return;
          }

          console.log('Resume parsed successfully:', data.data)
          console.log('Debug info:', data.debug);
          
          // Check if we actually got meaningful data
          const hasData = data.data && (
            data.data.candidate_name || 
            data.data.linkedin_url || 
            data.data.location_country || 
            data.data.profile_summary
          );
          
          if (!hasData) {
            console.warn('Resume parsing returned empty data');
            setUploadStatus('error')
            setErrorReason('No readable content found')
            toast({
              title: "Resume parsing incomplete",
              description: "The resume was processed but no readable text was found. Please try a different file or enter information manually.",
              variant: "destructive"
            })
            return;
          }
          
          // Determine confidence levels and extracted sections
          const confidence: Record<string, 'high' | 'medium' | 'low'> = {
            candidate_name: data.data.candidate_name ? 'high' : 'low',
            linkedin_url: data.data.linkedin_url ? 'high' : 'low',
            location_country: data.data.location_country ? 'medium' : 'low',
            location_state: data.data.location_state ? 'medium' : 'low',
            location_city: data.data.location_city ? 'medium' : 'low',
            salary_amount: data.data.salary_amount ? 'low' : 'low', // Salary is usually inferred
            profile_summary: data.data.profile_summary ? 'medium' : 'low',
          }
          
          const sections = []
          if (data.data.candidate_name) sections.push('Contact Info')
          if (data.data.profile_summary) sections.push('Summary')
          if (data.data.linkedin_url) sections.push('URLs')
          if (data.data.location_country || data.data.location_state || data.data.location_city) sections.push('Location')
          if (data.data.salary_amount) sections.push('Salary Information')
          
          setExtractedSections(sections)
          setUploadStatus('success')
          onDataExtracted(data.data, { confidence, extractedSections: sections })
          
          toast({
            title: "Resume processed successfully!",
            description: "Form fields have been auto-filled. Please review and edit as needed.",
          })

        } catch (error) {
          console.error('Resume parsing error:', error)
          setUploadStatus('error')
          setErrorReason(error instanceof Error ? error.message : 'Processing failed')
          
          // Provide helpful error messages for different types of failures
          let errorTitle = "Failed to process resume";
          let errorDescription = "Please try again or fill the form manually.";
          
          if (error instanceof Error) {
            if (error.message.includes('timeout') || error.message.includes('timed out')) {
              errorTitle = "Processing timed out";
              errorDescription = "The file took too long to process. Please try a shorter resume or different format.";
            } else if (error.message.includes('file type') || error.message.includes('format')) {
              errorTitle = "Unsupported file format";
              errorDescription = "Please upload a PDF, DOCX, or TXT file.";
            } else if (error.message.includes('size') || error.message.includes('large')) {
              errorTitle = "File too large";
              errorDescription = "Please upload a file smaller than 5MB.";
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
              errorTitle = "Network error";
              errorDescription = "Please check your connection and try again.";
            } else {
              errorDescription = error.message;
            }
          }
          
          toast({
            title: errorTitle,
            description: errorDescription,
            variant: "destructive"
          })
        } finally {
          setUploading(false)
        }
      }

      fileReader.onerror = () => {
        setUploadStatus('error')
        setUploading(false)
        toast({
          title: "File read error",
          description: "Failed to read the uploaded file.",
          variant: "destructive"
        })
      }

      fileReader.readAsDataURL(file)

    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus('error')
      setUploading(false)
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive"
      })
    }
  }

  const resetUpload = () => {
    setUploadedFile(null)
    setUploadStatus('idle')
    setExtractedSections([])
    setErrorReason('')
    // Clear the input
    const input = document.getElementById('resume-upload') as HTMLInputElement
    if (input) input.value = ''
  }

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      default:
        return <Upload className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusMessage = () => {
    switch (uploadStatus) {
      case 'processing':
        return 'Extracting resume details... This may take up to 30 seconds.'
      case 'success':
        return `Successfully processed ${uploadedFile?.name}`
      case 'error':
        return errorReason || 'Failed to process resume'
      default:
        return 'Upload a resume to auto-fill form fields (PDF, DOCX, or TXT)'
    }
  }

  return (
    <div className="space-y-4 p-4 bg-surface-secondary rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="font-medium text-text-primary">Resume Upload</h3>
      </div>

      <FormField 
        label="Upload Resume" 
        htmlFor="resume-upload"
        helpText="Upload PDF, DOCX, or TXT resume to auto-fill candidate information"
      >
        <div className="space-y-3">
          <Input
            id="resume-upload"
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileUpload}
            disabled={uploading || isLoading}
            className="h-[44px] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getStatusIcon()}
            <span>{getStatusMessage()}</span>
          </div>

          {uploadedFile && uploadStatus !== 'idle' && (
            <div className="flex items-center justify-between p-3 bg-surface-primary rounded-md border border-border">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">{uploadedFile.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(uploadedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              
              {uploadStatus !== 'processing' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetUpload}
                  disabled={uploading}
                >
                  Upload Different File
                </Button>
              )}
            </div>
          )}
        </div>
      </FormField>

      {uploadStatus === 'success' && extractedSections.length > 0 && (
        <div className="space-y-3">
          <div className="p-3 bg-success/10 border border-success/20 rounded-md">
            <p className="text-sm text-success font-medium mb-2">
              Resume parsed successfully! Please review and edit as needed.
            </p>
          </div>
          
          <div className="p-3 bg-surface-primary border border-border rounded-md">
            <h4 className="text-sm font-medium text-text-primary mb-2">Resume Insights</h4>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Extracted sections: {extractedSections.join(', ')}
              </p>
              <p className="text-xs text-muted-foreground">
                Fields filled automatically - review for accuracy
              </p>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive font-medium mb-1">
            Resume processing failed
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            {errorReason}
          </p>
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Tips for better results:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Use text-based PDFs (not scanned images)</li>
              <li>Ensure the file contains standard resume sections</li>
              <li>Keep file size under 5MB</li>
              <li>Try DOCX format for better text extraction</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}