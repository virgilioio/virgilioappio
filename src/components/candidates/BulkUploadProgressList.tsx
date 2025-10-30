import { CheckCircle2, XCircle, AlertCircle, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileProcessingResult } from '@/hooks/useBulkCandidateUpload'

interface BulkUploadProgressListProps {
  fileResults: FileProcessingResult[]
  isProcessing: boolean
}

export function BulkUploadProgressList({
  fileResults,
  isProcessing
}: BulkUploadProgressListProps) {
  const getStatusIcon = (status: FileProcessingResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'duplicate':
        return <AlertCircle className="h-5 w-5 text-amber-600" />
      case 'parsing':
      case 'creating':
        return <Loader2 className="h-5 w-5 animate-spin text-virgilio-purple" />
      case 'pending':
        return <Clock className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusMessage = (result: FileProcessingResult) => {
    switch (result.status) {
      case 'success':
        return `Candidate created: ${result.candidate?.candidate_name || 'Unknown'}`
      case 'duplicate':
        return 'Merged with existing candidate'
      case 'error':
        return result.error || 'Unknown error'
      case 'parsing':
        return 'Extracting information...'
      case 'creating':
        return 'Creating candidate...'
      case 'pending':
        return 'Waiting...'
    }
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-2">
        {fileResults.map((result, index) => (
          <Card
            key={index}
            className={cn(
              "p-3 transition-all duration-300",
              result.status === 'success' && "border-green-500/50 bg-green-50/50 dark:bg-green-950/20",
              result.status === 'error' && "border-red-500/50 bg-red-50/50 dark:bg-red-950/20",
              result.status === 'duplicate' && "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20",
            )}
          >
            <div className="flex items-center gap-3">
              {/* Status icon */}
              <div className="flex-shrink-0">
                {getStatusIcon(result.status)}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-virgilio-text">
                  {result.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getStatusMessage(result)}
                </p>
              </div>

              {/* Progress indicator */}
              {isProcessing && 
                result.status !== 'success' && 
                result.status !== 'error' && 
                result.status !== 'duplicate' && (
                <Progress value={result.progress} className="w-24" />
              )}
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  )
}
