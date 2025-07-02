
import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'

interface ResumeUploadProps {
  onDataExtracted: (data: any) => void
  className?: string
}

interface ExtractedData {
  candidate_name: string | null
  location_country: string | null
  location_state: string | null
  location_city: string | null
  salary_amount: number | null
  salary_currency: string | null
  salary_period: string | null
  profile_summary: string | null
  linkedin_url: string | null
  notes: string | null
}

export function ResumeUpload({ onDataExtracted, className }: ResumeUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const acceptedFileTypes = ['.pdf', '.docx', '.txt']
  const maxFileSize = 10 * 1024 * 1024 // 10MB

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const validateFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()
    
    if (!acceptedFileTypes.includes(extension)) {
      return `Unsupported file type. Please upload ${acceptedFileTypes.join(', ')} files.`
    }
    
    if (file.size > maxFileSize) {
      return 'File size must be less than 10MB.'
    }
    
    return null
  }

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const processFile = async (file: File) => {
    setIsProcessing(true)
    setProcessingStatus('processing')
    setErrorMessage(null)

    try {
      // Read file content
      const fileContent = await readFileAsBase64(file)
      
      // Call the edge function to parse the resume
      const { data, error } = await supabase.functions.invoke('parse-resume', {
        body: {
          fileContent,
          fileName: file.name
        }
      })

      if (error) {
        throw new Error(error.message || 'Failed to parse resume')
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to parse resume')
      }

      console.log('Resume parsing successful:', data.data)
      setProcessingStatus('success')
      onDataExtracted(data.data)

    } catch (error) {
      console.error('Resume processing error:', error)
      setProcessingStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process resume')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setErrorMessage(validationError)
      setProcessingStatus('error')
      return
    }

    setSelectedFile(file)
    setErrorMessage(null)
    processFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setProcessingStatus('idle')
    setErrorMessage(null)
  }

  const getStatusIcon = () => {
    switch (processingStatus) {
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <FileText className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusMessage = () => {
    switch (processingStatus) {
      case 'processing':
        return 'Parsing resume with AI...'
      case 'success':
        return 'Resume parsed successfully! Check the form fields below.'
      case 'error':
        return errorMessage || 'Failed to parse resume'
      default:
        return 'Upload a resume to auto-fill candidate information'
    }
  }

  return (
    <Card className={cn("border-2 border-dashed", className)}>
      <CardContent className="p-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "transition-colors duration-200 rounded-lg p-6 text-center",
            isDragging && "border-blue-500 bg-blue-50",
            processingStatus === 'success' && "border-green-500 bg-green-50",
            processingStatus === 'error' && "border-red-500 bg-red-50"
          )}
        >
          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                {getStatusIcon()}
                <span className="font-medium">{selectedFile.name}</span>
                {processingStatus !== 'processing' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFile}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <p className={cn(
                "text-sm",
                processingStatus === 'success' && "text-green-600",
                processingStatus === 'error' && "text-red-600",
                processingStatus === 'processing' && "text-blue-600"
              )}>
                {getStatusMessage()}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Upload className="h-12 w-12 text-gray-400" />
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">
                  Upload Resume for Auto-Fill
                </h3>
                <p className="text-sm text-gray-500">
                  {getStatusMessage()}
                </p>
              </div>

              <div className="space-y-2">
                <input
                  type="file"
                  accept={acceptedFileTypes.join(',')}
                  onChange={handleFileInput}
                  className="hidden"
                  id="resume-upload"
                  disabled={isProcessing}
                />
                <Button 
                  onClick={() => document.getElementById('resume-upload')?.click()}
                  disabled={isProcessing}
                  className="cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-gray-500">
                  Supports PDF, DOCX, TXT • Max 10MB
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
