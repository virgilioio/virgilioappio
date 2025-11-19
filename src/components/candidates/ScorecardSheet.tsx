import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { toast } from "@/hooks/use-toast";
import type { ScoreRating, ScorecardRow } from "@/hooks/useScorecards";
import { ThumbsDown, ThumbsUp, Star, Octagon, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { InterviewQuestion, SelectOption } from "@/hooks/useScorecardsConfiguration";
import { markdownToHtml } from "@/utils/markdown";
import gioIcon from "@/assets/gio-icon.png";

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

interface QuestionResponse {
  questionId: string;
  answerText?: string;
  answerOptions?: string[];
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
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [isPolishing, setIsPolishing] = useState(false);

  const isReadOnly = useMemo(() => !editMode, [editMode]);

  useEffect(() => {
    if (open && stageInstanceId) {
      loadQuestionsAndResponses();
    }
  }, [open, stageInstanceId, existing?.id]);

  const loadQuestionsAndResponses = async () => {
    try {
      setLoadingQuestions(true);

      const { data: template } = await supabase
        .from('stage_scorecard_templates')
        .select('id')
        .eq('job_hiring_stage_id', stageInstanceId)
        .maybeSingle();

      if (template) {
        const { data: questionsData } = await supabase
          .from('scorecard_interview_questions')
          .select('*')
          .eq('scorecard_template_id', template.id)
          .order('display_order', { ascending: true });

        if (questionsData) {
          const formattedQuestions: InterviewQuestion[] = questionsData.map(q => ({
            id: q.id,
            question_text: q.question_text,
            answer_type: q.answer_type as 'text' | 'yes_no' | 'single_select' | 'multi_select',
            is_required: q.is_required,
            display_order: q.display_order,
            select_options: (q.select_options as unknown) as SelectOption[] | undefined
          }));
          setQuestions(formattedQuestions);

          if (existing) {
            const { data: responsesData } = await supabase
              .from('scorecard_question_responses')
              .select('*')
              .eq('scorecard_id', existing.id);

            if (responsesData) {
              const responsesMap: Record<string, QuestionResponse> = {};
              responsesData.forEach(r => {
                responsesMap[r.question_id] = {
                  questionId: r.question_id,
                  answerText: r.answer_text || undefined,
                  answerOptions: (r.answer_options as unknown) as string[] | undefined
                };
              });
              setResponses(responsesMap);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading questions:', error);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handlePolishNotes = async () => {
    setIsPolishing(true);
    try {
      // Prepare questions and responses data
      const questionsWithAnswers = questions.map(q => {
        const response = responses[q.id];
        return {
          question_text: q.question_text,
          answer_type: q.answer_type,
          answerText: response?.answerText,
          answerOptions: response?.answerOptions
        };
      });

      // Get candidate_id from association
      const { data: association } = await supabase
        .from('job_candidate_associations')
        .select('candidate_id')
        .eq('id', associationId)
        .single();

      if (!association) throw new Error('Candidate not found');

      // Call edge function
      const { data, error } = await supabase.functions.invoke('polish-scorecard-notes', {
        body: {
          candidateId: association.candidate_id,
          stageInstanceId,
          currentNotes: overview,
          questions: questionsWithAnswers
        }
      });

      if (error) throw error;

      // Convert markdown to HTML and update the Key Takeaways field
      const htmlContent = markdownToHtml(data.polishedNotes);
      setOverview(htmlContent);

      toast({
        title: "Notes polished successfully!",
        description: "Your interview notes have been enhanced by Gio.",
      });
    } catch (error) {
      console.error('Error polishing notes:', error);
      toast({
        title: "Error",
        description: "Failed to polish notes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPolishing(false);
    }
  };

  useEffect(() => {
    if (open) {
      setRating(existing?.rating || "yes");
      setOverview(existing?.general_overview || "");
      setEditMode(!existing || isAuthor);
    }
  }, [open, existing?.id, existing?.rating, existing?.general_overview, isAuthor]);

  const handleResponseChange = (questionId: string, response: Partial<QuestionResponse>) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: {
        questionId,
        ...prev[questionId],
        ...response
      }
    }));
  };

  const validateRequiredQuestions = (): boolean => {
    for (const question of questions) {
      if (!question.is_required) continue;

      const response = responses[question.id];
      if (!response) return false;

      if (question.answer_type === 'text' && !response.answerText?.trim()) {
        return false;
      }
      if ((question.answer_type === 'single_select' || question.answer_type === 'yes_no') && !response.answerText) {
        return false;
      }
      if (question.answer_type === 'multi_select' && (!response.answerOptions || response.answerOptions.length === 0)) {
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateRequiredQuestions()) {
      toast({ 
        title: 'Required questions missing', 
        description: 'Please answer all required questions before submitting.',
        variant: 'destructive' 
      });
      return;
    }

    setSaving(true);
    try {
      await onSubmit(rating, overview);
      
      let scorecardId = existing?.id;
      if (!scorecardId) {
        const { data: latestScorecard } = await supabase
          .from('job_stage_scorecards')
          .select('id')
          .eq('association_id', associationId)
          .eq('stage_instance_id', stageInstanceId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        scorecardId = latestScorecard?.id;
      }

      if (scorecardId && questions.length > 0) {
        await supabase
          .from('scorecard_question_responses')
          .delete()
          .eq('scorecard_id', scorecardId);

        const responsesToInsert = Object.values(responses).map(r => ({
          scorecard_id: scorecardId,
          question_id: r.questionId,
          answer_text: r.answerText || null,
          answer_options: r.answerOptions ? r.answerOptions as any : null
        }));

        if (responsesToInsert.length > 0) {
          await supabase
            .from('scorecard_question_responses')
            .insert(responsesToInsert);
        }
      }

      setEditMode(false);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save scorecard';
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const renderQuestion = (question: InterviewQuestion) => {
    const response = responses[question.id];

    switch (question.answer_type) {
      case 'text':
        return (
          <div key={question.id} className="space-y-2">
            <Label htmlFor={`question-${question.id}`}>
              {question.question_text}
              {question.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Textarea
              id={`question-${question.id}`}
              value={response?.answerText || ''}
              onChange={(e) => handleResponseChange(question.id, { answerText: e.target.value })}
              disabled={isReadOnly}
              rows={4}
              placeholder="Enter your answer..."
            />
          </div>
        );

      case 'yes_no':
        return (
          <div key={question.id} className="space-y-2">
            <Label>
              {question.question_text}
              {question.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <RadioGroup
              value={response?.answerText || ''}
              onValueChange={(value) => handleResponseChange(question.id, { answerText: value })}
              disabled={isReadOnly}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                <Label htmlFor={`${question.id}-yes`} className="cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id={`${question.id}-no`} />
                <Label htmlFor={`${question.id}-no`} className="cursor-pointer">No</Label>
              </div>
            </RadioGroup>
          </div>
        );

      case 'single_select':
        return (
          <div key={question.id} className="space-y-2">
            <Label>
              {question.question_text}
              {question.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <RadioGroup
              value={response?.answerText || ''}
              onValueChange={(value) => handleResponseChange(question.id, { answerText: value })}
              disabled={isReadOnly}
              className="space-y-2"
            >
              {question.select_options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} />
                  <Label htmlFor={`${question.id}-${option.value}`} className="cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 'multi_select':
        return (
          <div key={question.id} className="space-y-2">
            <Label>
              {question.question_text}
              {question.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="space-y-2">
              {question.select_options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}-${option.value}`}
                    checked={response?.answerOptions?.includes(option.value) || false}
                    onCheckedChange={(checked) => {
                      const current = response?.answerOptions || [];
                      const updated = checked
                        ? [...current, option.value]
                        : current.filter(v => v !== option.value);
                      handleResponseChange(question.id, { answerOptions: updated });
                    }}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor={`${question.id}-${option.value}`} className="cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );
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
                      : `text-success border-success/90 ${active ? "bg-success/40 ring-2 ring-success/95" : "bg-success/30"}`;

                  return (
                    <Label
                      key={opt.value}
                      htmlFor={`rating-${opt.value}`}
                      className={`
                        flex flex-col items-center justify-center gap-1 p-3 rounded-lg border-2 cursor-pointer
                        transition-all duration-200
                        ${base}
                      `}
                    >
                      <RadioGroupItem value={opt.value} id={`rating-${opt.value}`} className="sr-only" />
                      <div className="flex items-center gap-1">
                        {opt.value === "definitely_no" && <ThumbsDown className="h-4 w-4" />}
                        {opt.value === "no" && <Octagon className="h-4 w-4" />}
                        {opt.value === "yes" && <ThumbsUp className="h-4 w-4" />}
                        {opt.value === "strong_yes" && <Star className="h-4 w-4" />}
                        <span className="text-sm font-medium">{opt.label}</span>
                      </div>
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>

            {!loadingQuestions && questions.length > 0 && (
              <div className="space-y-6 border-t border-virgilio-border pt-6">
                <h3 className="text-base font-semibold text-virgilio-text">Interview Questions</h3>
                {questions.map(renderQuestion)}
              </div>
            )}

            <div className="space-y-2 border-t border-virgilio-border pt-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <Label htmlFor="overview" className="text-base font-semibold">
                    Key Takeaways
                  </Label>
                  <p className="text-sm text-virgilio-muted mt-1">
                    Provide comprehensive notes about your interview with this candidate
                  </p>
                </div>
                
                {!isReadOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePolishNotes}
                    disabled={isPolishing || !overview.trim()}
                    className="gap-2 shrink-0"
                  >
                    {isPolishing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Polishing...
                      </>
                    ) : (
                      <>
                        <img src={gioIcon} alt="Gio" className="h-4 w-4" />
                        Polish Notes
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              <RichTextEditor
                value={overview}
                onChange={setOverview}
                placeholder="Share your key takeaways and observations..."
              />
            </div>
          </div>

          <div className="p-6 border-t">
            <div className="flex justify-end gap-3">
              {isReadOnly && !editMode ? (
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : existing ? "Update Scorecard" : "Submit Scorecard"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
