import { useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Trash2, Download, Paperclip } from 'lucide-react'
import { useDealInvoices, type DealInvoice } from '@/hooks/useDealInvoices'
import { InlineEmpty } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DealInvoicesCard({ dealId }: { dealId: string }) {
  const invoices = useDealInvoices(dealId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    for (const f of Array.from(files)) {
      await invoices.upload.mutateAsync(f)
    }
  }

  const handleDownload = async (inv: DealInvoice) => {
    const url = await invoices.getDownloadUrl(inv.file_path)
    if (url) window.open(url, '_blank')
  }

  return (
    <Card className="bg-surface-primary border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="h-4 w-4" />
          Invoices & Documents
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={invoices.upload.isPending}>
          <Upload className="h-4 w-4 mr-2" />
          {invoices.upload.isPending ? 'Uploading…' : 'Upload'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
            dragOver ? 'border-virgilio-purple bg-virgilio-purple/5' : 'border-border'
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
        >
          <Upload className="h-6 w-6 mx-auto text-text-tertiary mb-2" />
          <p className="text-sm text-text-secondary">
            Drop invoices or documents here, or <span className="text-virgilio-purple font-medium">browse</span>
          </p>
        </div>

        {invoices.isLoading ? (
          <div className="text-sm text-virgilio-muted">Loading…</div>
        ) : (invoices.data ?? []).length === 0 ? (
          <InlineEmpty text="No invoices yet." action="Upload" onAction={() => inputRef.current?.click()} />
        ) : (
          <ul className="space-y-2">
            {(invoices.data ?? []).map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 rounded-lg border border-border p-3 bg-card">
                <FileText className="h-4 w-4 text-text-tertiary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary truncate">{inv.file_name}</div>
                  <div className="text-xs text-text-tertiary">
                    {formatBytes(inv.file_size)} • {new Date(inv.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleDownload(inv)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-virgilio-error hover:text-virgilio-error"
                  onClick={() => {
                    if (confirm('Delete this document?')) invoices.remove.mutate(inv)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
