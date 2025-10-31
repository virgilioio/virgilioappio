import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BulkUploadDropzone } from "./BulkUploadDropzone";
import { useJobs } from "@/hooks/useJobs";
import { useJobHiringPlan } from "@/hooks/useJobHiringPlan";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useBulkUploadContext } from "@/contexts/BulkUploadContext";

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
  const [files, setFiles] = useState<File[]>([]);
  const [autoGenerateSkills, setAutoGenerateSkills] = useState(true);
  const [assignToJob, setAssignToJob] = useState<string>("");
  const [assignToStage, setAssignToStage] = useState<string>("");
  const [stageOptions, setStageOptions] = useState<{ value: string; label: string }[]>([]);

  const { startUpload } = useBulkUploadContext();
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
      setFiles([]);
      setAutoGenerateSkills(true);
      setAssignToJob("");
      setAssignToStage("");
    }
  }, [isOpen]);

  const handleStartUpload = () => {
    startUpload(files, {
      autoGenerateSkills,
      assignToJob: assignToJob || undefined,
      assignToStage: assignToStage || undefined,
    });
    onClose();
    if (onComplete) {
      onComplete();
    }
  };

  if (!isOpen) return null;

  const jobOptions = jobs?.map((job) => ({
    value: job.id,
    label: job.title,
  })) || [];

  if (!isOpen) return null;

  return (
    <Card className="fixed bottom-4 right-4 w-[600px] max-h-[80vh] shadow-lg z-50 bg-background border flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Bulk Upload Candidates</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
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
      </div>

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
    </Card>
  );
}
