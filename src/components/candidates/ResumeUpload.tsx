
import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
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
  const [retryCount, setRetryCount] = useState(0)

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

    if (file.size === 0) {
      return 'File appears to be empty. Please select a valid file.'
    }
    
    return null
  }

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        console.log('File read successfully:', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          resultLength: result.length,
          isDataURL: result.startsWith('data:')
        })
        resolve(result)
      }
      reader.onerror = (error) => {
        console.error('File reading error:', error)
        reject(new Error('Failed to read file. Please try again.'))
      }
      reader.readAsDataURL(file)
    })
  }

  const processFile = async (file: File, isRetry: boolean = false) => {
    setIsProcessing(true)
    setProcessingStatus('processing')
    setErrorMessage(null)

    if (!isRetry) {
      setRetryCount(0)
    }

    try {
      console.log('Starting file processing:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isRetry,
        retryCount
      })

      // Read file content
      const fileContent = await readFileAsBase64(file)
      
      console.log('Calling parse-resume function...')
      
      // Call the edge function to parse the resume
      const { data, error } = await supabase.functions.invoke('parse-resume', {
        body: {
          fileContent,
          fileName: file.name
        }
      })

      console.log('Parse-resume response:', { data, error })

      if (error) {
        throw new Error(error.message || 'Failed to parse resume')
      }

      if (!data) {
        throw new Error('No response data received from parsing service')
      }

      if (!data.success) {
        throw new Error(data.error || 'Resume parsing failed')
      }

      console.log('Resume parsing successful:', data.data)
      setProcessingStatus('success')
      setRetryCount(0)
      onDataExtracted(data.data)

    } catch (error) {
      console.error('Resume processing error:', error)
      setProcessingStatus('error')
      
      const errorMsg = error instanceof Error ? error.message : 'Failed to process resume'
      setErrorMessage(errorMsg)
      
      // Don't auto-retry on certain errors
      const noRetryErrors = [
        'Unsupported file format',
        'No file content provided',
        'No readable text found',
        'Invalid request body'
      ]
      
      const shouldNotRetry = noRetryErrors.some(noRetryError => errorMsg.includes(noRetryError))
      
      if (shouldNotRetry) {
        setRetryCount(0)
      } else {
        setRetryCount(prev => prev + 1)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setErrorMessage(validationError)
      setProcessingStatus('error')
      setSelectedFile(null)
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
    setRetryCount(0)
  }

  const retryProcessing = () => {
    if (selectedFile) {
      processFile(selectedFile, true)
    }
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
        return 'Parsing resume with AI... This may take a moment.'
      case 'success':
        return 'Resume parsed successfully! Check the form fields below.'
      case 'error':
        return errorMessage || 'Failed to parse resume'
      default:
        return 'Upload a resume to auto-fill candidate information'
    }
  }

  const canRetry = processingStatus === 'error' && retryCount < 3 && selectedFile

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
                <span className="font-medium truncate max-w-xs" title={selectedFile.name}>
                  {selectedFile.name}
                </span>
                {!isProcessing && (
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

              {canRetry && (
                <div className="flex justify-center">
                  <Button
                    onClick={retryProcessing}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry ({retryCount}/3)
                  </Button>
                </div>
              )}

              {processingStatus === 'error' && retryCount >= 3 && (
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Having trouble? Try:</p>
                  <ul className="list-disc list-inside text-left space-y-1">
                    <li>Using a different file format (PDF, DOCX, or TXT)</li>
                    <li>Ensuring the file contains readable text</li>
                    <li>Checking that the file isn't corrupted</li>
                  </ul>
                </div>
              )}
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
