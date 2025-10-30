import { useState } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

interface BulkUploadDropzoneProps {
  files: File[]
  onFilesSelected: (files: File[]) => void
  maxFiles?: number
  maxSizeMb?: number
}

export function BulkUploadDropzone({
  files,
  onFilesSelected,
  maxFiles = 50,
  maxSizeMb = 15
}: BulkUploadDropzoneProps) {
  const [dragOver, setDragOver] = useState(false)

  const validateAndAddFiles = (newFiles: File[]) => {
    const validFiles: File[] = []
    const errors: string[] = []

    // Check total count
    if (files.length + newFiles.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`)
      toast({
        title: 'Too Many Files',
        description: `You can only upload up to ${maxFiles} files at once`,
        variant: 'destructive'
      })
      return
    }

    for (const file of newFiles) {
      // Check file type
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain'
      ]
      
      if (!validTypes.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type`)
        continue
      }

      // Check file size
      const sizeMb = file.size / (1024 * 1024)
      if (sizeMb > maxSizeMb) {
        errors.push(`${file.name}: File too large (${sizeMb.toFixed(1)}MB)`)
        continue
      }

      validFiles.push(file)
    }

    if (errors.length > 0) {
      toast({
        title: 'Some Files Invalid',
        description: errors.slice(0, 3).join(', '),
        variant: 'destructive'
      })
    }

    if (validFiles.length > 0) {
      onFilesSelected([...files, ...validFiles])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    validateAndAddFiles(droppedFiles)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      validateAndAddFiles(selectedFiles)
    }
  }

  const removeFile = (index: number) => {
    onFilesSelected(files.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)}MB`
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
          "hover:border-virgilio-purple/50 hover:bg-virgilio-purple/5",
          dragOver && "border-virgilio-purple bg-virgilio-purple/10 shadow-lg"
        )}
      >
        <Upload className={cn(
          "h-12 w-12 mx-auto mb-4 transition-colors",
          dragOver ? "text-virgilio-purple" : "text-muted-foreground"
        )} />
        
        <h3 className="font-semibold text-lg mb-2 text-virgilio-text">
          Drop resumes here or click to browse
        </h3>
        
        <p className="text-sm text-muted-foreground mb-4">
          PDF, DOCX, TXT • Max {maxFiles} files • Up to {maxSizeMb}MB each
        </p>

        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        
        <label htmlFor="file-upload">
          <Button 
            type="button" 
            variant="outline"
            className="cursor-pointer"
            asChild
          >
            <span>Browse Files</span>
          </Button>
        </label>
      </div>

      {/* File List Preview */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-virgilio-text">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFilesSelected([])}
              className="text-muted-foreground hover:text-destructive"
            >
              Clear All
            </Button>
          </div>
          
          <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="flex-shrink-0 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
