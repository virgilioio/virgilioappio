import React, { useRef } from 'react'
import { UploadCloud, FileText, Sparkles, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type ParseStep = 'idle' | 'parsing' | 'done'
export type EnrichStep = 'idle' | 'working' | 'done'

interface ResumeUploadFieldProps {
  parseStep: ParseStep
  enrich: EnrichStep
  fileName?: string
  fileSizeBytes?: number
  parsedFieldsCount?: number
  accept?: string
  maxSizeMb?: number
  onFile: (file: File) => void
  onClear: () => void
  /** Same as onFile but signals an explicit re-parse (Replace button) */
  onReplace?: (file: File) => void
}

const ACCEPT = '.pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.gif,.webp'

/**
 * Three-state résumé dropzone matching the Add candidate sheet spec.
 *
 *  idle    → dashed dropzone with upload-cloud tile
 *  parsing → solid lilac-card row with spinner + indeterminate progress bar
 *  done    → white row with file icon + "Parsed by Gio" + Replace + trash
 */
export function ResumeUploadField({
  parseStep,
  enrich,
  fileName,
  fileSizeBytes,
  parsedFieldsCount = 0,
  accept = ACCEPT,
  maxSizeMb = 10,
  onFile,
  onClear,
  onReplace,
}: ResumeUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = React.useState(false)

  const pickFile = (input: HTMLInputElement | null) => input?.click()

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    handler: (f: File) => void,
  ) => {
    const f = e.target.files?.[0]
    if (f) handler(f)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  const sizeKb = fileSizeBytes ? Math.round(fileSizeBytes / 1024) : null

  // ─── PARSING ─────────────────────────────────────────────────
  if (parseStep === 'parsing') {
    return (
      <div
        className="rounded-[10px] p-3 space-y-3"
        style={{ background: '#FAF8FF', boxShadow: 'inset 0 0 0 1px #EDE4FF' }}
        aria-busy
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
            style={{ background: '#EDE4FF' }}
          >
            <span className="gio-spinner" style={{ width: 14, height: 14 }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-inter font-medium" style={{ color: '#1F2230' }}>
                {fileName || 'Resume'}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 h-[18px] font-poppins text-[10.5px] font-semibold"
                style={{ background: '#EDE4FF', color: '#5B21B6' }}
              >
                <Sparkles className="h-3 w-3 gio-pulse" strokeWidth={1.75} />
                Parsing…
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] font-inter" style={{ color: '#5A6072' }}>
              Reading contact info, experience &amp; skills…
            </p>
          </div>
        </div>
        <div className="gio-progress">
          <span />
        </div>
      </div>
    )
  }

  // ─── DONE ────────────────────────────────────────────────────
  if (parseStep === 'done' && fileName) {
    const subLine =
      enrich === 'working'
        ? `${sizeKb ?? '–'} KB · contact & experience ready · skills + summary finishing…`
        : `${sizeKb ?? '–'} KB · uploaded just now${
            parsedFieldsCount > 0 ? ` · ${parsedFieldsCount} fields auto-filled` : ''
          }`

    return (
      <div
        className="flex items-center gap-3 rounded-[10px] bg-white px-3 py-2.5"
        style={{ boxShadow: 'inset 0 0 0 1px #E7E8EE' }}
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
          style={{ background: '#EDE4FF' }}
        >
          <FileText className="h-4 w-4" style={{ color: '#6F3FF5' }} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-inter font-medium" style={{ color: '#1F2230' }}>
              {fileName}
            </span>
            <Badge tone="green" dot size="xs">
              Parsed by Gio
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-[11.5px] font-inter" style={{ color: '#5A6072' }}>
            {subLine}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={Upload}
            onClick={() => pickFile(replaceRef.current)}
          >
            Replace
          </Button>
          <input
            ref={replaceRef}
            type="file"
            className="hidden"
            accept={accept}
            onChange={(e) => handleChange(e, onReplace ?? onFile)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Remove resume"
            onClick={onClear}
          >
            <Trash2 className="h-4 w-4" style={{ color: '#FA5252' }} strokeWidth={1.75} />
          </Button>
        </div>
      </div>
    )
  }

  // ─── IDLE ────────────────────────────────────────────────────
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => pickFile(inputRef.current)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          pickFile(inputRef.current)
        }
      }}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setDragOver(false)
      }}
      className={cn(
        'cursor-pointer rounded-[10px] px-4 py-6 text-center transition-colors',
        'flex flex-col items-center justify-center gap-2',
      )}
      style={{
        background: '#FAFAF7',
        border: '1.5px dashed',
        borderColor: dragOver ? '#6F3FF5' : '#D1D0CB',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => handleChange(e, onFile)}
      />
      <div
        className="flex h-9 w-9 items-center justify-center rounded-md"
        style={{ background: '#EDE4FF' }}
      >
        <UploadCloud className="h-5 w-5" style={{ color: '#6F3FF5' }} strokeWidth={1.75} />
      </div>
      <p className="font-inter text-[13px]" style={{ color: '#1F2230' }}>
        Drop résumé here, or{' '}
        <span className="font-semibold" style={{ color: '#6F3FF5' }}>
          browse
        </span>
      </p>
      <p className="font-inter text-[11.5px]" style={{ color: '#8B8F9E' }}>
        PDF, DOCX, or image · up to {maxSizeMb} MB · Gio will parse contact info, skills, and experience
      </p>
    </div>
  )
}

export default ResumeUploadField
