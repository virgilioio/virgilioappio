import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { SoonBadge } from "@/components/ui/soon-badge";
import { toast } from "@/hooks/use-toast";
import type { ScoreRating, ScorecardRow } from "@/hooks/useScorecards";
import { ThumbsDown, ThumbsUp, Star, Octagon, Loader2, Sparkles, Lightbulb, Trash2, FileText, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { triggerFitAnalysis } from "@/utils/triggerFitAnalysis";
import type { InterviewQuestion, SelectOption, SalaryConfig } from "@/hooks/useScorecardsConfiguration";
import { markdownToHtml } from "@/utils/markdown";
import gioIcon from "@/assets/gio-icon.png";
import { RecommendedNextStepsDialog } from "./RecommendedNextStepsDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CandidateApplicationResponses } from "@/components/candidates/CandidateApplicationResponses";
import { ScorecardValidationPoints } from "./ScorecardValidationPoints";
import { PDFResumeViewer } from "@/components/candidates/PDFResumeViewer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LinkedInFilled } from "@/components/icons/LinkedInFilled";

interface ScorecardSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageName?: string;
  associationId: string;
  stageInstanceId: string;
  existing?: ScorecardRow | null;
  onSubmit: (rating: ScoreRating, overview: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  isAuthor: boolean;
  candidateName?: string;
  candidateId?: string;
  jobId?: string;
  linkedinUrl?: string | null;
  jobTitle?: string;
  onMoveToNextStage?: () => void;
  onScheduleFollowUp?: () => void;
  onReject?: () => void;
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

const aiRatingToScoreRating: Record<string, ScoreRating> = {
  "Strong Yes": "strong_yes",
  "Yes": "yes",
  "No": "no",
  "Definitely No": "definitely_no",
};

export function ScorecardSheet({
  open,
  onOpenChange,
  stageName,
  associationId,
  stageInstanceId,
  existing,
  onSubmit,
  onDelete,
  isAuthor,
  candidateName,
  candidateId,
  jobId,
  linkedinUrl,
  jobTitle,
  onMoveToNextStage,
  onScheduleFollowUp,
  onReject,
}: ScorecardSheetProps) {
  const [rating, setRating] = useState<ScoreRating>(existing?.rating || "yes");
  const [overview, setOverview] = useState<string>(existing?.general_overview || "");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(!existing || isAuthor);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [isPolishing, setIsPolishing] = useState(false);
  const [showNextStepsDialog, setShowNextStepsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [hasDraft, setHasDraft] = useState(false);
  const draftTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track current values in refs for reliable close-time saving
  const overviewRef = useRef(overview);
  const ratingRef = useRef(rating);
  const responsesRef = useRef(responses);

  // Sync refs with state
  useEffect(() => { overviewRef.current = overview; }, [overview]);
  useEffect(() => { ratingRef.current = rating; }, [rating]);
  useEffect(() => { responsesRef.current = responses; }, [responses]);

  const isReadOnly = useMemo(() => !editMode, [editMode]);
  const isAiDraft = existing?.is_ai_draft === true;
  const aiSuggestedRating = existing?.ai_suggested_rating;

  // Draft storage key - unique per candidate+stage
  const draftKey = `scorecard-draft-${associationId}-${stageInstanceId}`;

  // Clear draft helper
  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey);
    setHasDraft(false);
  }, [draftKey]);

  // Discard draft handler
  const handleDiscardDraft = useCallback(() => {
    clearDraft();
    setRating('yes');
    setOverview('');
    setResponses({});
    toast({
      title: 'Draft discarded',
      description: 'Your draft has been cleared.'
    });
  }, [clearDraft]);

  // Handler for dismiss (clicking outside, Esc, X button) - save draft immediately
  const handleSheetDismiss = useCallback((newOpen: boolean) => {
    if (!newOpen && !isReadOnly) {
      // Sheet is being dismissed - save draft immediately
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
        draftTimeoutRef.current = null;
      }
      
      // Force editor to sync its content
      const editorElement = document.querySelector('[contenteditable="true"]');
      if (editorElement instanceof HTMLElement) {
        editorElement.blur();
      }
      
      // Save current values to localStorage immediately
      try {
        const draft = {
          rating: ratingRef.current,
          overview: overviewRef.current,
          responses: responsesRef.current,
          lastUpdated: Date.now()
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setHasDraft(true);
      } catch (e) {
        console.debug('Failed to save draft on close:', e);
      }
    }
    
    onOpenChange(newOpen);
  }, [draftKey, isReadOnly, onOpenChange]);

  // Handle explicit Cancel button click - shows confirmation if there are changes
  const handleCancelClick = useCallback(() => {
    // Check if there are unsaved changes
    const hasChanges = overview.trim() !== '' || 
      Object.keys(responses).length > 0 || 
      rating !== (existing?.rating || 'yes') ||
      overview !== (existing?.general_overview || '');
    
    if (hasChanges) {
      setShowCancelDialog(true);
    } else {
      // No changes, just close
      clearDraft();
      onOpenChange(false);
    }
  }, [overview, responses, rating, existing, clearDraft, onOpenChange]);

  // Handle confirmed cancel - discard changes and close
  const handleConfirmCancel = useCallback(() => {
    clearDraft();
    setRating('yes');
    setOverview('');
    setResponses({});
    setShowCancelDialog(false);
    onOpenChange(false);
  }, [clearDraft, onOpenChange]);

  // Unified initialization effect when sheet opens
  useEffect(() => {
    if (!open) return;
    
    // Base values from existing scorecard (or defaults)
    const baseRating = existing?.rating || "yes";
    const baseOverview = existing?.general_overview || "";
    
    // Always set edit mode
    setEditMode(!existing || isAuthor);
    
    // Check for local draft
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        // Check if draft is less than 7 days old
        if (Date.now() - draft.lastUpdated < 7 * 24 * 60 * 60 * 1000) {
          // For existing scorecards, only restore if draft is newer than last DB update
          if (existing?.updated_at) {
            const dbUpdateTime = new Date(existing.updated_at).getTime();
            if (draft.lastUpdated > dbUpdateTime) {
              // Draft is newer - restore it
              setRating(draft.rating || baseRating);
              setOverview(draft.overview || baseOverview);
              setResponses(draft.responses || {});
              setHasDraft(true);
              toast({ 
                title: 'Unsaved changes restored', 
                description: 'Your previous edits have been recovered.' 
              });
              return;
            }
          } else {
            // New scorecard - restore draft
            setRating(draft.rating || baseRating);
            setOverview(draft.overview || baseOverview);
            setResponses(draft.responses || {});
            setHasDraft(true);
            toast({ 
              title: 'Draft restored', 
              description: 'Your previous notes have been restored.' 
            });
            return;
          }
        } else {
          localStorage.removeItem(draftKey);
        }
      }
    } catch (e) {
      console.debug('Failed to load draft:', e);
    }
    
    // No valid draft - use base values
    setRating(baseRating);
    setOverview(baseOverview);
    setHasDraft(false);
    
  }, [open, existing?.id, existing?.updated_at, existing?.rating, existing?.general_overview, draftKey, isAuthor]);

  // Auto-save draft on changes (debounced) - works for both new and existing scorecards
  useEffect(() => {
    if (!open || isReadOnly || loadingQuestions) return;
    
    // Debounce saves by 1 second
    if (draftTimeoutRef.current) {
      clearTimeout(draftTimeoutRef.current);
    }
    
    draftTimeoutRef.current = setTimeout(() => {
      try {
        const draft = {
          rating,
          overview,
          responses,
          lastUpdated: Date.now()
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setHasDraft(true);
      } catch (e) {
        console.debug('Failed to save draft:', e);
      }
    }, 1000);
    
    return () => {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }
    };
  }, [open, existing, isReadOnly, rating, overview, responses, draftKey]);

  // Load resume when sheet opens
  useEffect(() => {
    if (!open || !associationId) {
      setResumeUrl(null);
      setLoadingResume(true);
      return;
    }

    const loadResume = async () => {
      setLoadingResume(true);
      try {
        // Get candidate_id from association
        const { data: association } = await supabase
          .from('job_candidate_associations')
          .select('candidate_id')
          .eq('id', associationId)
          .single();

        if (!association) {
          setLoadingResume(false);
          return;
        }

        // Get primary resume attachment
        const { data: resumeAttachment } = await supabase
          .from('candidate_attachments')
          .select('file_url, converted_pdf_url, conversion_status')
          .eq('candidate_id', association.candidate_id)
          .eq('is_resume', true)
          .maybeSingle();

        if (!resumeAttachment) {
          setLoadingResume(false);
          return;
        }

        // Prefer converted PDF if available
        const fileUrl = resumeAttachment.conversion_status === 'completed' && resumeAttachment.converted_pdf_url
          ? resumeAttachment.converted_pdf_url
          : resumeAttachment.file_url;

        if (fileUrl) {
          const { data } = await supabase.storage
            .from('candidate-attachments')
            .createSignedUrl(fileUrl, 3600);

          if (data?.signedUrl) {
            setResumeUrl(data.signedUrl);
          }
        }
      } catch (error) {
        console.error('Error loading resume:', error);
      } finally {
        setLoadingResume(false);
      }
    };

    loadResume();
  }, [open, associationId]);

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
            answer_type: q.answer_type as 'text' | 'yes_no' | 'single_select' | 'multi_select' | 'salary_expectations',
            is_required: q.is_required,
            display_order: q.display_order,
            select_options: (q.select_options as unknown) as SelectOption[] | undefined,
            notes_for_interviewer: q.notes_for_interviewer,
            salary_config: (q.salary_config as unknown) as SalaryConfig | undefined
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
              clearDraft();
              setHasDraft(false);
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
    // Force the editor to save its current content to state
    const editorElement = document.querySelector('[contenteditable="true"]');
    if (editorElement && editorElement instanceof HTMLElement) {
      editorElement.blur(); // Trigger blur to save content
      await new Promise(resolve => setTimeout(resolve, 100)); // Give state time to update
    }

    setIsPolishing(true);
    try {
      // Prepare questions and responses data
      const questionsWithAnswers = questions.map(q => {
        const response = responses[q.id];
        return {
          question_text: q.question_text,
          answer_type: q.answer_type,
          answerText: response?.answerText,
          answerOptions: response?.answerOptions,
          // Include salary config for salary_expectations questions
          salary_config: q.answer_type === 'salary_expectations' ? q.salary_config : undefined
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

  // Note: Competing reset effect removed - initialization is now handled by the unified effect above

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
      if (question.answer_type === 'salary_expectations' && !response.answerText?.trim()) {
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

        // Sync salary expectations to candidate profile if applicable
        const salaryQuestion = questions.find(q => q.answer_type === 'salary_expectations');
        if (salaryQuestion) {
          const salaryResponse = responses[salaryQuestion.id];
          if (salaryResponse?.answerText) {
            const salaryAmount = parseFloat(salaryResponse.answerText);
            if (!isNaN(salaryAmount)) {
              // Get candidate_id from association
              const { data: association } = await supabase
                .from('job_candidate_associations')
                .select('candidate_id')
                .eq('id', associationId)
                .single();

              if (association) {
                await supabase
                  .from('candidates')
                  .update({
                    salary_amount: salaryAmount,
                    salary_currency: salaryQuestion.salary_config?.currency || 'USD',
                    salary_period: salaryQuestion.salary_config?.period || 'annually'
                  })
                  .eq('id', association.candidate_id);
              }
            }
          }
        }
      }

      // Clear AI draft flag after saving
      if (isAiDraft && scorecardId) {
        await supabase
          .from('job_stage_scorecards')
          .update({ is_ai_draft: false })
          .eq('id', scorecardId);
      }

      // Clear draft on successful save
      clearDraft();

      setEditMode(false);

      // Trigger AI fit analysis refresh
      if (jobId) {
        const { data: assocData } = await supabase
          .from('job_candidate_associations')
          .select('candidate_id')
          .eq('id', associationId)
          .maybeSingle();
        if (assocData?.candidate_id) {
          triggerFitAnalysis(assocData.candidate_id, jobId);
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to save scorecard';
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptAiSuggestion = () => {
    if (aiSuggestedRating && aiRatingToScoreRating[aiSuggestedRating]) {
      setRating(aiRatingToScoreRating[aiSuggestedRating]);
      toast({
        title: "AI suggestion applied",
        description: `Rating set to "${aiSuggestedRating}"`,
      });
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
            {question.notes_for_interviewer && (
              <p className="text-sm text-muted-foreground italic">{question.notes_for_interviewer}</p>
            )}
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
            {question.notes_for_interviewer && (
              <p className="text-sm text-muted-foreground italic">{question.notes_for_interviewer}</p>
            )}
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
            {question.notes_for_interviewer && (
              <p className="text-sm text-muted-foreground italic">{question.notes_for_interviewer}</p>
            )}
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
            {question.notes_for_interviewer && (
              <p className="text-sm text-muted-foreground italic">{question.notes_for_interviewer}</p>
            )}
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

      case 'salary_expectations':
        const formatPeriod = (period: string) => {
          switch(period) {
            case 'hourly': return 'per hour';
            case 'monthly': return 'per month';
            case 'annually': return 'per year';
            default: return period;
          }
        };
        
        return (
          <div key={question.id} className="space-y-3 p-4 bg-green-50/50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <Label className="text-green-800 font-medium">
                {question.question_text}
                {question.is_required && <span className="text-destructive ml-1">*</span>}
              </Label>
            </div>
            {question.notes_for_interviewer && (
              <p className="text-sm text-muted-foreground italic">{question.notes_for_interviewer}</p>
            )}
            <div className="flex items-center gap-3">
              <Input
                type="number"
                step="0.01"
                placeholder="Enter amount..."
                value={response?.answerText || ''}
                onChange={(e) => handleResponseChange(question.id, { answerText: e.target.value })}
                disabled={isReadOnly}
                className="max-w-[200px]"
              />
              <Badge variant="outline" className="bg-white font-mono">
                {question.salary_config?.currency || 'USD'}
              </Badge>
              <Badge variant="outline" className="bg-white">
                {formatPeriod(question.salary_config?.period || 'annually')}
              </Badge>
            </div>
            <p className="text-xs text-green-600">
              This answer will update the candidate's salary expectations on their profile.
            </p>
          </div>
        );
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetDismiss}>
        <SheetContent side="right" className="w-[95vw] sm:w-[95vw] max-w-[1400px] sm:max-w-[1400px] p-0">
          <div className="flex h-full flex-col">
            <SheetHeader className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-3">
                    <SheetTitle>Scorecard{stageName ? ` • ${stageName}` : ""}</SheetTitle>
                    {isAiDraft && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1">
                        <Sparkles className="h-3 w-3" />
                        AI-Generated Draft
                      </Badge>
                    )}
                    {hasDraft && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Draft saved
                      </Badge>
                    )}
                  </div>
                  {/* Candidate context row */}
                  {(candidateName || jobTitle) && (
                    <div className="flex items-center gap-2 text-sm">
                      {candidateName && (
                        <span className="font-semibold text-virgilio-text">
                          {candidateName}
                        </span>
                      )}
                      {linkedinUrl && (
                        <a 
                          href={linkedinUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[#0077B5] hover:opacity-80 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <LinkedInFilled className="h-4 w-4" />
                        </a>
                      )}
                      {candidateName && jobTitle && (
                        <span className="text-virgilio-muted">•</span>
                      )}
                      {jobTitle && (
                        <span className="text-virgilio-muted">
                          {jobTitle}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasDraft && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDiscardDraft}
                      className="text-muted-foreground"
                    >
                      Discard Draft
                    </Button>
                  )}
                  {existing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNextStepsDialog(true)}
                      className="gap-2"
                    >
                      <Lightbulb className="h-4 w-4" />
                      Next Steps
                    </Button>
                  )}
                  {existing && isAuthor && !editMode && (
                    <Button variant="outline" onClick={() => setEditMode(true)}>Edit scorecard</Button>
                  )}
                  {existing && isAuthor && onDelete && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-hidden flex">
              {/* Left Panel - Resume with Tabs */}
              <div className="w-[50%] border-r border-virgilio-border flex flex-col">
                <Tabs defaultValue="resume" className="flex flex-col h-full">
                  <div className="p-4 border-b border-virgilio-border shrink-0">
                    <TabsList>
                      <TabsTrigger value="resume">Resume</TabsTrigger>
                      <TabsTrigger value="application">Application</TabsTrigger>
                      <TabsTrigger value="interview-details" disabled className="gap-2">
                        Interview Details
                        <SoonBadge />
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="resume" className="flex-1 overflow-hidden m-0 p-4">
                    {loadingResume ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : resumeUrl ? (
                      <PDFResumeViewer url={resumeUrl} height={65} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6">
                        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground">No resume available</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="application" className="flex-1 overflow-y-auto m-0 p-6">
                    {candidateId && jobId ? (
                      <CandidateApplicationResponses candidateId={candidateId} jobId={jobId} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6">
                        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground">No application details available</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="interview-details" className="flex-1 overflow-hidden m-0 p-4">
                    <div className="flex flex-col items-center justify-center h-full text-center p-6">
                      <p className="text-sm text-muted-foreground">Interview details coming soon</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right Panel - Scorecard Form */}
              <div className="w-[50%] overflow-y-auto p-6 space-y-6">
                {/* Validation Points Panel */}
                {candidateId && jobId && stageName && (
                  <ScorecardValidationPoints
                    candidateId={candidateId}
                    jobId={jobId}
                    associationId={associationId}
                    stageName={stageName}
                  />
                )}
                {/* AI Suggested Rating Banner */}
                {isAiDraft && aiSuggestedRating && (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">AI Suggested Rating: {aiSuggestedRating}</p>
                        <p className="text-xs text-muted-foreground">Based on interview transcript analysis</p>
                      </div>
                    </div>
                    {!isReadOnly && aiRatingToScoreRating[aiSuggestedRating] !== rating && (
                      <Button size="sm" variant="outline" onClick={handleAcceptAiSuggestion}>
                        Apply Suggestion
                      </Button>
                    )}
                  </div>
                )}

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
                          ? `text-white ${active ? "ring-2" : ""}`
                          : opt.value === "no"
                          ? `text-white ${active ? "ring-2" : ""}`
                          : opt.value === "strong_yes"
                          ? `text-white ${active ? "ring-2" : ""}`
                          : `text-white ${active ? "ring-2" : ""}`;
                      
                      const colorStyles =
                        opt.value === "definitely_no"
                          ? { backgroundColor: '#FA5252', borderColor: '#FA5252', ringColor: active ? '#FA5252' : undefined }
                          : opt.value === "no"
                          ? { backgroundColor: '#FA8F8F', borderColor: '#FA8F8F', ringColor: active ? '#FA8F8F' : undefined }
                          : opt.value === "strong_yes"
                          ? { backgroundColor: '#6F3FF5', borderColor: '#6F3FF5', ringColor: active ? '#6F3FF5' : undefined }
                          : { backgroundColor: '#9B7BF7', borderColor: '#9B7BF7', ringColor: active ? '#9B7BF7' : undefined };

                      return (
                        <Label
                          key={opt.value}
                          htmlFor={`rating-${opt.value}`}
                          className={`
                            flex flex-col items-center justify-center gap-1 p-3 rounded-lg border-2 cursor-pointer
                            transition-all duration-200
                            ${base}
                          `}
                          style={colorStyles}
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
                  <div className="mb-2">
                    <Label htmlFor="overview" className="text-base font-semibold">
                      Key Takeaways
                    </Label>
                    <p className="text-sm text-virgilio-muted mt-1">
                      Provide comprehensive notes about your interview with this candidate
                    </p>
                  </div>
                  
                  <RichTextEditor
                    value={overview}
                    onChange={setOverview}
                    placeholder="Share your key takeaways and observations..."
                  />
                  
                  {!isReadOnly && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePolishNotes}
                        disabled={isPolishing || !overview.trim()}
                        className="gap-2"
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
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t">
              <div className="flex justify-end gap-3">
                {isReadOnly && !editMode ? (
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleCancelClick} disabled={saving}>
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

      {/* Recommended Next Steps Dialog */}
      {existing && (
        <RecommendedNextStepsDialog
          open={showNextStepsDialog}
          onOpenChange={setShowNextStepsDialog}
          scorecardId={existing.id}
          candidateId={existing.candidate_id}
          jobId={jobId || existing.job_id}
          rating={rating}
          overview={overview}
          candidateName={candidateName}
          onMoveToNextStage={onMoveToNextStage}
          onScheduleFollowUp={onScheduleFollowUp}
          onReject={onReject}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scorecard</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this scorecard? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!onDelete) return;
                setIsDeleting(true);
                try {
                  await onDelete();
                  toast({ title: 'Scorecard deleted', description: 'Your scorecard has been deleted.' });
                  setShowDeleteDialog(false);
                  onOpenChange(false);
                } catch (err: any) {
                  toast({ title: 'Delete failed', description: err?.message || 'Failed to delete scorecard', variant: 'destructive' });
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved notes in this scorecard. Are you sure you want to cancel? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmCancel}
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
