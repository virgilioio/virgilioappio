import { useState, useEffect } from "react"
import { X, Minimize2, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import { BulkUploadProgressList } from "./BulkUploadProgressList"
import { BulkUploadSummary } from "./BulkUploadSummary"
import { useBulkCandidateUpload } from "@/hooks/useBulkCandidateUpload"
import { useBulkUploadContext } from "@/contexts/BulkUploadContext"
import { useNavigate } from "react-router-dom"

export function GlobalBulkUploadWidget() {
  const { isUploadActive, isMinimized, files, options, closeUpload, setMinimized } = useBulkUploadContext()
  const { uploadCandidates, isProcessing, fileResults, progress } = useBulkCandidateUpload()
  const [step, setStep] = useState<"processing" | "summary">("processing")
  const navigate = useNavigate()

  // Start upload when context is activated
  useEffect(() => {
    if (isUploadActive && files.length > 0 && options && step === "processing" && fileResults.length === 0) {
      uploadCandidates(files, options)
    }
  }, [isUploadActive, files, options])

  // Auto-minimize 2 seconds after processing starts
  useEffect(() => {
    if (step === "processing" && isProcessing && !isMinimized) {
      const timer = setTimeout(() => {
        setMinimized(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [step, isProcessing, isMinimized, setMinimized])

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

  // Reset step when upload becomes active
  useEffect(() => {
    if (isUploadActive) {
      setStep("processing")
    }
  }, [isUploadActive])

  const handleClose = () => {
    if (isProcessing) {
      const confirmed = window.confirm(
        "Upload is still in progress. Are you sure you want to close? This will cancel the upload."
      )
      if (!confirmed) return
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMinimized(false)}
                className="h-6 w-6 p-0"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMinimized(true)}
              className="h-8 w-8 p-0"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
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
