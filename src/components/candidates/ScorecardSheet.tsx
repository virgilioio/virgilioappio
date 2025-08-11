import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AgreementRichTextEditor } from "@/components/ui/agreement-rich-text-editor";
import { toast } from "@/hooks/use-toast";
import type { ScoreRating, ScorecardRow } from "@/hooks/useScorecards";
import { ThumbsDown, ThumbsUp, Star, Octagon } from "lucide-react";

interface ScorecardSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageName?: string;
  associationId: string;
  stageInstanceId: string;
  existing?: ScorecardRow | null;
  onSubmit: (rating: ScoreRating, overview: string) => Promise<void>;
  isAuthor: boolean;
}

const ratingOptions: { value: ScoreRating; label: string }[] = [
  { value: "definitely_no", label: "Definitely No" },
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
  { value: "strong_yes", label: "Strong Yes" },
];

export function ScorecardSheet({
  open,
  onOpenChange,
  stageName,
  associationId,
  stageInstanceId,
  existing,
  onSubmit,
  isAuthor,
}: ScorecardSheetProps) {
  const [rating, setRating] = useState<ScoreRating>(existing?.rating || "yes");
  const [overview, setOverview] = useState<string>(existing?.general_overview || "");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(!existing || isAuthor);

  // When switching scorecards reopen, sync state
  const isReadOnly = useMemo(() => !editMode, [editMode]);

  useEffect(() => {
    if (open) {
      setRating(existing?.rating || "yes");
      setOverview(existing?.general_overview || "");
      setEditMode(!existing || isAuthor);
    }
  }, [open, existing?.id, existing?.rating, existing?.general_overview, isAuthor]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSubmit(rating, overview);
      setEditMode(false);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save scorecard';
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[80vw] sm:w-[80vw] max-w-[1080px] sm:max-w-[1080px] p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="p-6 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle>Scorecard{stageName ? ` • ${stageName}` : ""}</SheetTitle>
              {existing && isAuthor && !editMode && (
                <Button variant="outline" onClick={() => setEditMode(true)}>Edit scorecard</Button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">Overall rating</div>
              <RadioGroup
                className="grid grid-cols-4 gap-3"
                value={rating}
                onValueChange={(v) => setRating(v as ScoreRating)}
                disabled={isReadOnly}
              >
                {ratingOptions.map((opt) => {
                  const active = rating === opt.value;
                  const base =
                    opt.value === "definitely_no"
                      ? `text-destructive border-destructive ${active ? "bg-destructive/30 ring-2 ring-destructive" : "bg-destructive/25"}`
                      : opt.value === "no"
                      ? `text-destructive border-destructive/80 ${active ? "bg-destructive/25 ring-2 ring-destructive/90" : "bg-destructive/20"}`
                      : opt.value === "strong_yes"
                      ? `text-success border-success ${active ? "bg-success/45 ring-2 ring-success" : "bg-success/35"}`
                      : `text-success border-success/90 ${active ? "bg-success/30 ring-2 ring-success/90" : "bg-success/25"}`;

                  const IconComp =
                    opt.value === "definitely_no"
                      ? Octagon
                      : opt.value === "no"
                      ? ThumbsDown
                      : opt.value === "strong_yes"
                      ? Star
                      : ThumbsUp;

                  return (
                    <div
                      key={opt.value}
                      className={`flex items-center gap-2 rounded-md border p-2 transition-all ${base}`}
                    >
                      <RadioGroupItem value={opt.value} id={`rating-${opt.value}`} />
                      <IconComp className="h-[22px] w-[22px]" aria-hidden fill="currentColor" />
                      <Label htmlFor={`rating-${opt.value}`}>{opt.label}</Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">General Overview</div>
              <div className={isReadOnly ? "pointer-events-none opacity-80" : ""}>
                <AgreementRichTextEditor
                  value={overview}
                  onChange={setOverview}
                  placeholder="Write your overall assessment…"
                  minHeight="240px"
                />
              </div>
            </div>
          </div>

          <div className="p-6 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            {(!existing || editMode) && (
              <Button onClick={handleSave} disabled={saving}>
                {existing ? "Update Scorecard" : "Submit Scorecard"}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
