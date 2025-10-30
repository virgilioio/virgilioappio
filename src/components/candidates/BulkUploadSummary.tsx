import { useMemo } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileProcessingResult } from '@/hooks/useBulkCandidateUpload'

interface BulkUploadSummaryProps {
  results: FileProcessingResult[]
  onClose: () => void
  onViewCandidates: () => void
}

export function BulkUploadSummary({
  results,
  onClose,
  onViewCandidates
}: BulkUploadSummaryProps) {
  const summary = useMemo(() => {
    return {
      created: results.filter(r => r.status === 'success').length,
      merged: results.filter(r => r.status === 'duplicate').length,
      failed: results.filter(r => r.status === 'error').length,
      total: results.length
    }
  }, [results])

  const failedFiles = results.filter(r => r.status === 'error')

  return (
    <div className="space-y-6">
      {/* Success message */}
      <div className="text-center">
        <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
        <h3 className="text-2xl font-bold font-poppins text-virgilio-text">
          Upload Complete<span className="text-virgilio-purple">.</span>
        </h3>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center bg-green-50/50 border-green-500/30 dark:bg-green-950/20">
          <div className="text-3xl font-bold text-green-600">{summary.created}</div>
          <div className="text-sm text-muted-foreground">New Candidates</div>
        </Card>
        <Card className="p-4 text-center bg-amber-50/50 border-amber-500/30 dark:bg-amber-950/20">
          <div className="text-3xl font-bold text-amber-600">{summary.merged}</div>
          <div className="text-sm text-muted-foreground">Duplicates Merged</div>
        </Card>
        <Card className="p-4 text-center bg-red-50/50 border-red-500/30 dark:bg-red-950/20">
          <div className="text-3xl font-bold text-red-600">{summary.failed}</div>
          <div className="text-sm text-muted-foreground">Failed</div>
        </Card>
      </div>

      {/* Failed files list */}
      {failedFiles.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 text-virgilio-text">Failed Files:</h4>
          <div className="space-y-1">
            {failedFiles.map((result, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-virgilio-text">{result.file.name}</span>
                  <span className="text-muted-foreground"> - {result.error}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button
          onClick={onViewCandidates}
          className="bg-virgilio-purple hover:bg-virgilio-purple/90 shadow-calendly"
        >
          View Candidates →
        </Button>
      </div>
    </div>
  )
}
