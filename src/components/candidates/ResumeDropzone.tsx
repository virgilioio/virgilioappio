import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface ResumeDropzoneProps {
  onUpload: (file: File) => Promise<void>
  isUploading?: boolean
  accept?: string
  maxSizeMb?: number
}

export function ResumeDropzone({ onUpload, isUploading = false, accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp', maxSizeMb = 15 }: ResumeDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file?: File) => {
    if (!file) return
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast({ title: 'File too large', description: `Max size is ${maxSizeMb}MB`, variant: 'destructive' })
      return
    }
    await onUpload(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    void handleFile(file)
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    void handleFile(file)
    e.currentTarget.value = ''
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
      onDrop={onDrop}
    >
      <input ref={inputRef} type="file" className="hidden" onChange={onChange} accept={accept} />
      <Upload className="h-8 w-8 mx-auto text-text-secondary mb-2" />
      <p className="text-sm text-text-secondary mb-2">Drop your resume here, or click to browse</p>
      <p className="text-xs text-text-secondary mb-4">PDF, DOC, DOCX, or images up to {maxSizeMb}MB</p>
      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={isUploading} className="gap-sm">
        <Upload className="h-4 w-4" />
        {isUploading ? 'Uploading…' : 'Upload Resume'}
      </Button>
    </div>
  )
}
