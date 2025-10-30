import { useState, useEffect } from "react";
import { X, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { BulkUploadDropzone } from "./BulkUploadDropzone";
import { BulkUploadProgressList } from "./BulkUploadProgressList";
import { BulkUploadSummary } from "./BulkUploadSummary";
import { useBulkCandidateUpload } from "@/hooks/useBulkCandidateUpload";
import { useJobs } from "@/hooks/useJobs";
import { useJobHiringPlan } from "@/hooks/useJobHiringPlan";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface MinimizableBulkUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function MinimizableBulkUploadDialog({
  isOpen,
  onClose,
  onComplete,
}: MinimizableBulkUploadDialogProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [step, setStep] = useState<"upload" | "processing" | "summary">("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [autoGenerateSkills, setAutoGenerateSkills] = useState(true);
  const [assignToJob, setAssignToJob] = useState<string>("");
  const [assignToStage, setAssignToStage] = useState<string>("");
  const [stageOptions, setStageOptions] = useState<{ value: string; label: string }[]>([]);

  const { uploadCandidates, isProcessing, fileResults, progress, summary } = useBulkCandidateUpload();
  const { jobs } = useJobs();
  const { loadHiringPlan } = useJobHiringPlan();

  // Load stage options when job changes
  useEffect(() => {
    if (assignToJob) {
      loadHiringPlan(assignToJob).then((plan) => {
        if (plan && plan.length > 0) {
          const stages = plan.map((stage) => ({
            value: stage.id,
            label: stage.stage_name,
          }));
          setStageOptions(stages);
        } else {
          setStageOptions([]);
          setAssignToStage("");
        }
      });
    } else {
      setStageOptions([]);
      setAssignToStage("");
    }
  }, [assignToJob, loadHiringPlan]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep("upload");
      setFiles([]);
      setIsMinimized(false);
    }
  }, [isOpen]);

  // Auto-minimize 2 seconds after processing starts
  useEffect(() => {
    if (step === "processing" && isProcessing) {
      const timer = setTimeout(() => {
        setIsMinimized(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, isProcessing]);

  // Auto-advance to summary when processing completes
  useEffect(() => {
    if (step === "processing" && !isProcessing && fileResults.length > 0) {
      const hasResults = fileResults.some(
        (r) => r.status === "success" || r.status === "error"
      );
      if (hasResults) {
        setStep("summary");
        setIsMinimized(false);
      }
    }
  }, [isProcessing, fileResults, step]);

  const handleStartUpload = async () => {
    setStep("processing");
    await uploadCandidates(files, {
      autoGenerateSkills,
      assignToJob: assignToJob || undefined,
      assignToStage: assignToStage || undefined,
    });
  };

  const handleComplete = () => {
    onComplete?.();
    onClose();
  };

  const handleClose = () => {
    if (isProcessing) {
      const confirmed = window.confirm(
        "Upload is still in progress. Are you sure you want to close? This will cancel the upload."
      );
      if (!confirmed) return;
    }
    onClose();
  };

  if (!isOpen) return null;

  const jobOptions = jobs?.map((job) => ({
    value: job.id,
    label: job.title,
  })) || [];

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
                onClick={() => setIsMinimized(false)}
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
                {fileResults.filter((r) => r.status === "success").length} of {files.length} completed
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </Card>
    );
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
              onClick={() => setIsMinimized(true)}
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
        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload multiple resume files (PDF, DOC, DOCX) to quickly add candidates to your database.
            </p>

            <BulkUploadDropzone
              files={files}
              onFilesSelected={setFiles}
            />

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-skills" className="text-sm font-medium">
                  Auto-generate skills with AI
                </Label>
                <Switch
                  id="auto-skills"
                  checked={autoGenerateSkills}
                  onCheckedChange={setAutoGenerateSkills}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assign-job" className="text-sm font-medium">
                  Assign to Job (Optional)
                </Label>
                <SearchableSelect
                  options={jobOptions}
                  value={assignToJob}
                  onValueChange={setAssignToJob}
                  placeholder="Select a job..."
                  emptyMessage="No jobs found"
                />
              </div>

              {assignToJob && stageOptions.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="assign-stage" className="text-sm font-medium">
                    Assign to Stage (Optional)
                  </Label>
                  <SearchableSelect
                    options={stageOptions}
                    value={assignToStage}
                    onValueChange={setAssignToStage}
                    placeholder="Select a stage..."
                    emptyMessage="No stages found"
                  />
                </div>
              )}
            </div>
          </div>
        )}

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
            onClose={onClose}
            onViewCandidates={handleComplete}
          />
        )}
      </div>

      {step === "upload" && (
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleStartUpload}
            disabled={files.length === 0}
          >
            Upload {files.length} {files.length === 1 ? "Resume" : "Resumes"}
          </Button>
        </div>
      )}
    </Card>
  );
}
