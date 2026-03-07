import { useState, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react'
import { parseCSV, autoMapHeaders, CandidateField, CANDIDATE_FIELD_OPTIONS, ParsedCSV } from '@/lib/csvParser'
import { useCSVCandidateImport } from '@/hooks/useCSVCandidateImport'
import { ScrollArea } from '@/components/ui/scroll-area'

interface CSVImportDialogProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

type Step = 'upload' | 'mapping' | 'importing' | 'done'

export function CSVImportDialog({ isOpen, onClose, onComplete }: CSVImportDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [parsed, setParsed] = useState<ParsedCSV | null>(null)
  const [mapping, setMapping] = useState<Record<number, CandidateField>>({})
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { progress, importRows, abort, reset } = useCSVCandidateImport()

  const handleFileSelect = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const result = parseCSV(text)
      if (result.headers.length === 0) return
      setParsed(result)
      setMapping(autoMapHeaders(result.headers))
      setFileName(file.name)
      setStep('mapping')
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFileSelect(file)
    }
  }, [handleFileSelect])

  const handleMappingChange = (colIndex: number, field: CandidateField) => {
    setMapping(prev => ({ ...prev, [colIndex]: field }))
  }

  const hasNameMapped = Object.values(mapping).includes('candidate_name')
  const mappedFieldCount = Object.values(mapping).filter(f => f !== '__skip__').length

  const handleImport = async () => {
    if (!parsed) return
    setStep('importing')
    const result = await importRows(parsed.rows, mapping)
    setStep('done')
  }

  const handleClose = () => {
    if (progress.isRunning) {
      abort()
    }
    setParsed(null)
    setMapping({})
    setFileName('')
    setStep('upload')
    reset()
    onClose()
    if (step === 'done') {
      onComplete()
    }
  }

  const previewRows = parsed?.rows.slice(0, 5) || []

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Candidates from CSV
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV file with your candidate data.'}
            {step === 'mapping' && `${fileName} — ${parsed?.totalRows} rows found. Map columns to candidate fields.`}
            {step === 'importing' && 'Importing candidates...'}
            {step === 'done' && 'Import complete!'}
          </DialogDescription>
        </DialogHeader>

        {/* Upload Step */}
        {step === 'upload' && (
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a CSV file here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Supports .csv files with headers</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
              }}
            />
          </div>
        )}

        {/* Mapping Step */}
        {step === 'mapping' && parsed && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Column Mapping */}
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-2 pr-4">
                {parsed.headers.map((header, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-[140px] truncate">
                      {header}
                    </span>
                    <span className="text-muted-foreground text-sm">→</span>
                    <Select
                      value={mapping[index] || '__skip__'}
                      onValueChange={(value) => handleMappingChange(index, value as CandidateField)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CANDIDATE_FIELD_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {!hasNameMapped && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                You must map at least one column to "Full Name"
              </div>
            )}

            {/* Preview */}
            {previewRows.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Preview (first {previewRows.length} rows)</p>
                <ScrollArea className="max-h-[150px]">
                  <table className="w-full text-xs border">
                    <thead>
                      <tr className="bg-muted">
                        {parsed.headers.map((h, i) => (
                          mapping[i] !== '__skip__' && (
                            <th key={i} className="px-2 py-1 text-left border-r font-medium">
                              {CANDIDATE_FIELD_OPTIONS.find(o => o.value === mapping[i])?.label || h}
                            </th>
                          )
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => (
                        <tr key={ri} className="border-t">
                          {parsed.headers.map((_, ci) => (
                            mapping[ci] !== '__skip__' && (
                              <td key={ci} className="px-2 py-1 border-r truncate max-w-[150px]">
                                {row[ci] || '—'}
                              </td>
                            )
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* Importing Step */}
        {step === 'importing' && (
          <div className="py-6 space-y-4">
            <Progress value={progress.total > 0 ? (progress.processed / progress.total) * 100 : 0} />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{progress.processed} / {progress.total} processed</span>
              <span>{progress.created} created · {progress.duplicates} skipped</span>
            </div>
          </div>
        )}

        {/* Done Step */}
        {step === 'done' && (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto text-primary" />
            <div className="space-y-1">
              <p className="font-medium">{progress.created} candidates imported</p>
              <p className="text-sm text-muted-foreground">
                {progress.duplicates > 0 && `${progress.duplicates} duplicates skipped. `}
                {progress.errors > 0 && `${progress.errors} errors. `}
              </p>
              {progress.created > 0 && Object.values(mapping).includes('resume_url') && (
                <p className="text-sm text-primary mt-2">
                  💡 Candidates with resume URLs can be enriched via Batch Enrichment in Platform Settings.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleImport} disabled={!hasNameMapped}>
                Import {parsed?.totalRows} Candidates
              </Button>
            </>
          )}
          {step === 'importing' && (
            <Button variant="outline" onClick={abort}>Cancel Import</Button>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
