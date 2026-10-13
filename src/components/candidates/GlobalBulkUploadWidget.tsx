import { useState, useEffect, useRef } from "react"
import { X, Minimize2, Maximize2, CircleStop } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import { BulkUploadProgressList } from "./BulkUploadProgressList"
import { BulkUploadSummary } from "./BulkUploadSummary"
import { useBulkCandidateUpload } from "@/hooks/useBulkCandidateUpload"
import { useBulkUploadContext } from "@/contexts/BulkUploadContext"
import { useNavigate } from "react-router-dom"
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { IconTip } from '@/components/ui/tooltip'

export function GlobalBulkUploadWidget() {
  const { isUploadActive, isMinimized, files, options, closeUpload, setMinimized } = useBulkUploadContext()
  const { uploadCandidates, cancelUpload, isProcessing, fileResults, progress, resetUploadState } = useBulkCandidateUpload()
  const [step, setStep] = useState<"processing" | "summary">("processing")
  const [hasManuallyInteracted, setHasManuallyInteracted] = useState(false)
  const hasStartedRef = useRef(false)
  const navigate = useNavigate()

  // Start upload when context is activated (guarded to fire only once per session)
  useEffect(() => {
    if (isUploadActive && files.length > 0 && options && step === "processing" && !hasStartedRef.current) {
      hasStartedRef.current = true
      resetUploadState()
      uploadCandidates(files, options)
    }
  }, [isUploadActive, files, options, step, resetUploadState, uploadCandidates])

  // Reset guard when upload becomes inactive
  useEffect(() => {
    if (!isUploadActive) {
      hasStartedRef.current = false
    }
  }, [isUploadActive])

  // Auto-minimize 2 seconds after processing starts (only if user hasn't manually interacted)
  useEffect(() => {
    if (step === "processing" && isProcessing && !isMinimized && !hasManuallyInteracted) {
      const timer = setTimeout(() => {
        setMinimized(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [step, isProcessing, isMinimized, hasManuallyInteracted, setMinimized])

  // Auto-advance to summary when processing completes
  useEffect(() => {
    if (step === "processing" && !isProcessing && fileResults.length > 0) {
      const hasResults = fileResults.some(
        (r) => r.status === "success" || r.status === "error" || r.status === "duplicate"
      )
      if (hasResults) {
        setStep("summary")
        setMinimized(false)
      }
    }
  }, [isProcessing, fileResults, step, setMinimized])

  // Reset step and interaction flag when upload becomes active
  useEffect(() => {
    if (isUploadActive) {
      setStep("processing")
      setHasManuallyInteracted(false)
    }
  }, [isUploadActive])

  const handleClose = async () => {
    if (isProcessing) {
      // C26 (Block B §16, Pattern 1): say how many are in and what stops.
      const total = files.length
      const done = fileResults.filter((r) => r.status === 'success' || r.status === 'duplicate' || r.status === 'error').length
      const left = Math.max(total - done, 0)
      const confirmed = await confirmDestructive({
        icon: CircleStop,
        title: left > 0 ? `Stop uploading the last ${left} r\u00e9sum\u00e9${left === 1 ? '' : 's'}?` : 'Stop the upload?',
        description: `${done} of ${total} are done, and the candidates already added stay. Files being read right now finish; the rest aren\u2019t uploaded, and you can upload them again later.`,
        confirmLabel: 'Stop upload',
        cancelLabel: 'Keep uploading',
      })
      if (!confirmed) return
      cancelUpload()
    }
    closeUpload()
    setStep("processing")
  }

  const handleViewCandidates = () => {
    navigate('/candidates')
    closeUpload()
    setStep("processing")
  }

  if (!isUploadActive) return null

  if (isMinimized) {
    return (
      <Card className="fixed bottom-4 right-4 w-96 shadow-lg z-50 bg-background border">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Bulk Upload in Progress</h3>
            </div>
            <div className="flex gap-1">
              <IconTip label="Expand upload">
              <Button
                aria-label="Expand upload"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMinimized(false)
                  setHasManuallyInteracted(true)
                }}
                className="h-6 w-6 p-0"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
              </IconTip>
              <IconTip label="Close upload">
              <Button
                aria-label="Close upload"
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
              </IconTip>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {fileResults.filter((r) => r.status === "success" || r.status === "duplicate").length} of {files.length} completed
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="fixed bottom-4 right-4 w-[600px] max-h-[80vh] shadow-lg z-50 bg-background border flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Bulk Upload Candidates</h2>
        </div>
        <div className="flex gap-1">
          {step === "processing" && (
            <IconTip label="Minimize upload">
            <Button
              aria-label="Minimize upload"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMinimized(true)
                setHasManuallyInteracted(true)
              }}
              className="h-8 w-8 p-0"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            </IconTip>
          )}
          <IconTip label="Close upload">
          <Button
            aria-label="Close upload"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
          </IconTip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {step === "processing" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <BulkUploadProgressList
              fileResults={fileResults}
              isProcessing={isProcessing}
            />
          </div>
        )}

        {step === "summary" && (
          <BulkUploadSummary
            results={fileResults}
            onClose={handleClose}
            onViewCandidates={handleViewCandidates}
          />
        )}
      </div>
    </Card>
  )
}
