import React, { useRef } from 'react'
import { FileText, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ParsedResumeChipProps {
  /** Visible filename */
  fileName: string
  /** Pre-formatted meta line, e.g. "324 KB · uploaded 14 sec ago · 23 fields auto-filled" */
  metaLine: string
  /** Whether to render the green "Parsed by Gio" badge */
  parsed?: boolean
  /** Replace handler — triggers a file picker */
  onReplace?: (file: File) => void
  onDelete?: () => void
  className?: string
}

/**
 * Compact resume chip shown inside the Resume card after parsing.
 * Icon + filename + "Parsed by Gio" badge + meta line + Replace + trash.
 */
export function ParsedResumeChip({
  fileName,
  metaLine,
  parsed = true,
  onReplace,
  onDelete,
  className,
}: ParsedResumeChipProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handlePick = () => inputRef.current?.click()
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onReplace) onReplace(file)
    e.target.value = ''
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg ring-1 ring-virgilio-border/60 bg-background px-3 py-2.5',
        className,
      )}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-badge-lilac/70">
        <FileText className="h-4 w-4 text-virgilio-purple" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-virgilio-text">{fileName}</span>
          {parsed && (
            <Badge tone="green" dot size="xs">
              Parsed by Gio
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-virgilio-muted">{metaLine}</p>
      </div>

      <div className="flex items-center gap-1">
        {onReplace && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePick}
              icon={Upload}
            >
              Replace
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.rtf"
              onChange={handleChange}
            />
          </>
        )}
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Delete resume"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4 text-destructive" strokeWidth={1.75} />
          </Button>
        )}
      </div>
    </div>
  )
}

export default ParsedResumeChip
