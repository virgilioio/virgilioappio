import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { EmptyState, InlineEmpty } from "@/components/ui/empty-state";
import { SoftPaper } from "@/components/ui/EmptyIllustrations";
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
import { ThumbsDown, ThumbsUp, Star, Octagon, Loader2, Sparkles, Lightbulb, Trash2, FileText, DollarSign, ChevronDown, ChevronUp, Copy, Lock, Globe, Check, Info, RefreshCw } from "lucide-react";
import { copyToClipboard } from "@/utils/clipboard";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { triggerFitAnalysis } from "@/utils/triggerFitAnalysis";
import type { InterviewQuestion, SelectOption, SalaryConfig, ScorecardVisibility } from "@/hooks/useScorecardsConfiguration";
import { markdownToHtml } from "@/utils/markdown";
import gioIcon from "@/assets/gio-icon.png";
import gioAvatar from "@/assets/gio-avatar.png";
import gioAiBannerIcon from "@/assets/gio-ai-banner-icon.png";
import { SafeHtml } from "@/components/ui/safe-html";
import { ProfileSummaryMarkdown } from "@/components/candidates/ProfileSummaryMarkdown";

function convertJsonOverviewToMarkdown(obj: any): string {
  const sections: string[] = [];
  const data = obj.general_overview && typeof obj.general_overview === 'object' ? obj.general_overview : obj;

  if (data.overall_impression) {
    sections.push(`## Overall Impression\n\n${data.overall_impression}`);
  }
  if (Array.isArray(data.key_strengths) && data.key_strengths.length > 0) {
    sections.push(`## Key Strengths\n\n${data.key_strengths.map((s: string) => `- ${s}`).join('\n')}`);
  }
  if (Array.isArray(data.areas_for_development) && data.areas_for_development.length > 0) {
    sections.push(`## Areas for Development\n\n${data.areas_for_development.map((s: string) => `- ${s}`).join('\n')}`);
  }
  if (Array.isArray(data.notable_quotes) && data.notable_quotes.length > 0) {
    sections.push(`## Notable Quotes\n\n${data.notable_quotes.map((q: string) => `> ${q}`).join('\n\n')}`);
  }
  if (data.recommended_rating || data.justification) {
    const ratingLabel = data.recommended_rating ? data.recommended_rating.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : '';
    sections.push(`## Recommended Rating: ${ratingLabel}\n\n${data.justification || ''}`);
  }
  return sections.length > 0 ? sections.join('\n\n') : '';
}

function normalizeAiAnalysis(text: string): string {
  // Detect JSON strings (from broken AI responses) and convert to markdown
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const converted = convertJsonOverviewToMarkdown(parsed);
      if (converted) return converted;
    } catch {
      // Not valid JSON, continue with normal normalization
    }
  }

  return text
    // Pattern: "1.\nOVERALL IMPRESSION" or "1.\n OVERALL IMPRESSION" → "---\n\n## 1. OVERALL IMPRESSION"
    .replace(/(\d+)\.\s*\n\s*([A-Z][A-Z\s&/,-]+)/g, '\n---\n\n## $1. $2')
    // Pattern: "1. OVERALL IMPRESSION" already on same line → heading
    .replace(/^(\d+)\.\s+([A-Z][A-Z\s&/,-]{3,})$/gm, '\n---\n\n## $1. $2')
    // Remove leading --- if it's the very first thing
    .replace(/^\s*---\s*\n/, '')
    .trim();
}
import { ScrollArea } from "@/components/ui/scroll-area";
import { RecommendedNextStepsDialog } from "./RecommendedNextStepsDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CandidateApplicationResponses } from "@/components/candidates/CandidateApplicationResponses";
import { ScorecardValidationPoints } from "./ScorecardValidationPoints";
import { GioPointsInbox } from "./scorecard/GioPointsInbox";
import { AddedFromGioBlock } from "./scorecard/AddedFromGioBlock";
import { useGioAddedQuestions } from "@/hooks/useGioAddedQuestions";
import { PDFResumeViewer } from "@/components/candidates/PDFResumeViewer";
import { CandidateSheetSection } from "./form/CandidateSheetSection";
import { OverallRatingPills } from "./scorecard/OverallRatingPills";
import { KeyTakeawaysCard } from "./scorecard/KeyTakeawaysCard";
import { AiSuggestedRatingCard } from "./scorecard/AiSuggestedRatingCard";
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
import { useStageInterviewDefaults } from "@/hooks/useStageInterviewDefaults";

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
  scorecardVisibility?: ScorecardVisibility;
}

interface QuestionResponse {
  questionId: string;
  answerText?: string;
  answerOptions?: string[];
}

function InterviewDetailsTab({ jhsId }: { jhsId: string }) {
  const { data, isLoading } = useStageInterviewDefaults(jhsId);
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const formatLabel = data?.interviewFormat
    ? { video: 'Video call', phone: 'Phone', onsite: 'On-site' }[data.interviewFormat]
    : null;
  const hasAny =
    !!data &&
    (data.stageInstructions || data.interviewDurationMinutes || data.interviewFormat || data.slaEnabled);
  if (!hasAny) {
    return (
      <div className="py-10">
        <InlineEmpty text="No interview details configured for this stage yet." />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {data?.stageInstructions && (
        <div
          style={{
            background: '#FAF8FF',
            border: '1px solid #EDE4FF',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div
            className="font-poppins font-semibold mb-1.5"
            style={{ fontSize: 12.5, color: '#5B21B6', letterSpacing: '-0.01em' }}
          >
            Stage instructions
          </div>
          <p
            className="font-inter whitespace-pre-wrap"
            style={{ fontSize: 13, lineHeight: 1.55, color: '#1F2230' }}
          >
            {data.stageInstructions}
          </p>
        </div>
      )}
      {(data?.interviewDurationMinutes || formatLabel || data?.slaEnabled) && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E7E8EE',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div
            className="font-poppins font-semibold mb-3"
            style={{ fontSize: 10.5, color: '#8B8F9E', letterSpacing: '0.04em', textTransform: 'uppercase' }}
          >
            Stage defaults
          </div>
          <dl className="grid grid-cols-2 gap-3 font-inter" style={{ fontSize: 12.5, color: '#1F2230' }}>
            {data?.interviewDurationMinutes && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide" style={{ color: '#8B8F9E' }}>Duration</dt>
                <dd style={{ fontWeight: 500 }}>{data.interviewDurationMinutes} min</dd>
              </div>
            )}
            {formatLabel && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide" style={{ color: '#8B8F9E' }}>Format</dt>
                <dd style={{ fontWeight: 500 }}>{formatLabel}</dd>
              </div>
            )}
            {data?.slaEnabled && data?.slaDays && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide" style={{ color: '#8B8F9E' }}>SLA target</dt>
                <dd style={{ fontWeight: 500 }}>Flag after {data.slaDays} days</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
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
  scorecardVisibility = 'private',
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
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isAiDraft, setIsAiDraft] = useState(false);
  const gioAdded = useGioAddedQuestions((existing as any)?.gio_added_questions);


  // Track current values in refs for reliable close-time saving
  const overviewRef = useRef(overview);
  const ratingRef = useRef(rating);
  const responsesRef = useRef(responses);

  // Sync refs with state
  useEffect(() => { overviewRef.current = overview; }, [overview]);
  useEffect(() => { ratingRef.current = rating; }, [rating]);
  useEffect(() => { responsesRef.current = responses; }, [responses]);

  const isReadOnly = useMemo(() => !editMode, [editMode]);
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
    if (!open) {
      // Reset AI state when sheet closes
      setAiAnalysis(null);
      setIsAiDraft(false);
      return;
    }
    
    // Base values from existing scorecard (or defaults)
    // For AI drafts, always start with neutral rating — user applies suggestion explicitly
    const baseRating = existing?.is_ai_draft ? "yes" : (existing?.rating || "yes");
    const baseOverview = existing?.general_overview || "";
    
    // Store AI analysis separately for AI drafts — only on initial open
    if (existing?.is_ai_draft && existing?.general_overview) {
      setAiAnalysis(prev => prev ?? existing.general_overview);
      setIsAiDraft(true);
      setShowAnalysis(false);
    }
    
    // Always set edit mode
    setEditMode(!existing || isAuthor);
    
    // For AI drafts, the overview starts empty so interviewer writes their own notes
    const effectiveBaseOverview = existing?.is_ai_draft ? "" : baseOverview;
    
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
              setOverview(draft.overview || effectiveBaseOverview);
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
            setOverview(draft.overview || effectiveBaseOverview);
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
    setOverview(effectiveBaseOverview);
    setHasDraft(false);
    
  }, [open, existing?.id, draftKey, isAuthor]);

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
            answer_type: q.answer_type as InterviewQuestion['answer_type'],
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

      const t = question.answer_type;
      if (t === 'multi_select') {
        if (!response.answerOptions || response.answerOptions.length === 0) return false;
      } else {
        // text, longtext, number, email, url, date, single_select, yes_no, file,
        // salary_expectations, phone, linkedin, location, employment_type, work_location, recruiter
        if (!response.answerText?.trim()) return false;
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
      // Clear AI draft flag BEFORE onSubmit so parent refetch sees updated state
      if (isAiDraft && existing?.id) {
        await supabase
          .from('job_stage_scorecards')
          .update({ is_ai_draft: false })
          .eq('id', existing.id);
      }

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

      // Persist Gio-added questions + their answers on the scorecard row.
      if (scorecardId) {
        try {
          await gioAdded.persist(scorecardId);
        } catch (e) {
          console.warn('Failed to persist gio_added_questions', e);
        }
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

        // Sync smart-field answers (phone / linkedin / location) to candidate profile.
        const syncMap: Partial<Record<string, Record<string, any>>> = {};
        for (const q of questions) {
          const r = responses[q.id];
          const val = r?.answerText?.trim();
          if (!val) continue;
          if (q.answer_type === 'phone') syncMap['phone'] = { phone: val };
          else if (q.answer_type === 'linkedin') syncMap['linkedin'] = { linkedin_url: val };
          else if (q.answer_type === 'location') syncMap['location'] = { location_city: val };
        }
        const profilePatch = Object.assign({}, ...Object.values(syncMap));
        if (Object.keys(profilePatch).length > 0) {
          const { data: assoc } = await supabase
            .from('job_candidate_associations')
            .select('candidate_id')
            .eq('id', associationId)
            .single();
          if (assoc) {
            await supabase
              .from('candidates')
              .update(profilePatch)
              .eq('id', assoc.candidate_id);
          }
        }

      // Clear AI draft flag for newly created scorecards (no existing.id at save time)
      if (isAiDraft && scorecardId && scorecardId !== existing?.id) {
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
      if (aiAnalysis) {
        setOverview(markdownToHtml(normalizeAiAnalysis(aiAnalysis)));
      }
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
          <div key={question.id} className="space-y-3 p-4 bg-[#F4FBF6] border border-[#BBE3C9] rounded-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <DollarSign className="h-4 w-4 text-[#0F8A56] shrink-0" />
                <Label className="text-[#0F5B3A] font-medium">
                  {question.question_text}
                  {question.is_required && <span className="text-destructive ml-1">*</span>}
                </Label>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white border border-[#BBE3C9] px-2 py-0.5 text-[10.5px] font-medium text-[#0F8A56] shrink-0">
                <RefreshCw className="h-3 w-3" /> Syncs to profile
              </span>
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
                className="max-w-[200px] bg-white"
              />
              <Badge variant="outline" className="bg-white font-mono">
                {question.salary_config?.currency || 'USD'}
              </Badge>
              <Badge variant="outline" className="bg-white">
                {formatPeriod(question.salary_config?.period || 'annually')}
              </Badge>
            </div>
          </div>
        );

      default: {
        // Generic renderer for the new smart + basic types.
        const t = question.answer_type;
        const longBasic = t === 'longtext';
        const inputType =
          t === 'number' ? 'number' :
          t === 'email' ? 'email' :
          t === 'url' || t === 'linkedin' ? 'url' :
          t === 'date' ? 'date' :
          t === 'phone' ? 'tel' :
          t === 'file' ? 'file' :
          'text';

        const placeholder =
          t === 'phone' ? '+1 555 123 4567' :
          t === 'linkedin' ? 'https://linkedin.com/in/…' :
          t === 'location' ? 'City, state, country' :
          t === 'recruiter' ? 'Team member name' :
          t === 'url' ? 'https://…' :
          t === 'email' ? 'name@example.com' :
          'Enter your answer...';

        // Predefined options for employment_type / work_location.
        const presetOptions: { value: string; label: string }[] | null =
          t === 'employment_type' ? [
            { value: 'full_time', label: 'Full-time' },
            { value: 'part_time', label: 'Part-time' },
            { value: 'contract', label: 'Contract' },
            { value: 'internship', label: 'Internship' },
            { value: 'temporary', label: 'Temporary' },
          ] :
          t === 'work_location' ? [
            { value: 'remote', label: 'Remote' },
            { value: 'hybrid', label: 'Hybrid' },
            { value: 'onsite', label: 'On-site' },
          ] : null;

        return (
          <div key={question.id} className="space-y-2">
            <Label htmlFor={`question-${question.id}`}>
              {question.question_text}
              {question.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {question.notes_for_interviewer && (
              <p className="text-sm text-muted-foreground italic">{question.notes_for_interviewer}</p>
            )}
            {longBasic ? (
              <Textarea
                id={`question-${question.id}`}
                value={response?.answerText || ''}
                onChange={(e) => handleResponseChange(question.id, { answerText: e.target.value })}
                disabled={isReadOnly}
                rows={4}
                placeholder={placeholder}
              />
            ) : presetOptions ? (
              <RadioGroup
                value={response?.answerText || ''}
                onValueChange={(value) => handleResponseChange(question.id, { answerText: value })}
                disabled={isReadOnly}
                className="space-y-2"
              >
                {presetOptions.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt.value} id={`${question.id}-${opt.value}`} />
                    <Label htmlFor={`${question.id}-${opt.value}`} className="cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <Input
                id={`question-${question.id}`}
                type={inputType}
                value={response?.answerText || ''}
                onChange={(e) => handleResponseChange(question.id, { answerText: e.target.value })}
                disabled={isReadOnly}
                placeholder={placeholder}
              />
            )}
          </div>
        );
      }
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetDismiss}>
        <SheetContent side="right" className="w-[95vw] sm:w-[95vw] max-w-[1190px] sm:max-w-[1190px] p-0 bg-[#FAFAF7]">
          <div className="flex h-full flex-col">
            <SheetHeader className="p-6 border-b border-[#E7E8EE] bg-white">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1.5">
                  <div
                    className="font-poppins font-semibold uppercase text-[#6F3FF5]"
                    style={{ fontSize: 10.5, letterSpacing: '0.08em' }}
                  >
                    Scorecard
                  </div>
                  <div className="flex items-center gap-3">
                    <SheetTitle asChild>
                      <h2
                        className="font-poppins font-semibold text-[#0F1222] m-0"
                        style={{ fontSize: 20, letterSpacing: '-0.035em', lineHeight: 1.15 }}
                      >
                        {stageName || 'Scorecard'}
                        <span className="text-[#D7C5FB]">.</span>
                      </h2>
                    </SheetTitle>
                    {isAiDraft && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1">
                        <Sparkles className="h-3 w-3" />
                        AI-Generated Draft
                      </Badge>
                    )}
                    {hasDraft && (
                      <Badge variant="outline" className="text-xs text-[#0F8A56] bg-[#F4FBF6] border-[#BBE3C9] gap-1">
                        <Check className="h-3 w-3" /> Draft saved
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-xs gap-1 ${
                        scorecardVisibility === 'public'
                          ? 'bg-virgilio-purple/10 text-virgilio-purple border-virgilio-purple/20'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {scorecardVisibility === 'public' ? (
                        <><Globe className="h-3 w-3" /> Public</>
                      ) : (
                        <><Lock className="h-3 w-3" /> Private</>
                      )}
                    </Badge>
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
              <div className="w-full lg:w-[53%] border-r border-[#E7E8EE] bg-[#FAFAF7] flex flex-col">
                <Tabs defaultValue="resume" className="flex flex-col h-full">
                  <div className="p-4 shrink-0">
                    <TabsList className="bg-[#F1F0EC] rounded-full p-1 h-auto gap-1">
                      <TabsTrigger
                        value="resume"
                        className="rounded-full px-3 py-1.5 text-[12.5px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
                      >Resume</TabsTrigger>
                      <TabsTrigger
                        value="application"
                        className="rounded-full px-3 py-1.5 text-[12.5px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
                      >Application</TabsTrigger>
                      <TabsTrigger
                        value="interview-details"
                        className="rounded-full px-3 py-1.5 text-[12.5px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
                      >Interview Details</TabsTrigger>
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
                      <div className="p-6">
                        <EmptyState
                          size="card"
                          illustration={<SoftPaper />}
                          title="No resume yet"
                          body="There's no resume on file for this candidate."
                        />
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="application" className="flex-1 overflow-y-auto m-0 p-6">
                    {candidateId && jobId ? (
                      <CandidateApplicationResponses candidateId={candidateId} jobId={jobId} />
                    ) : (
                      <div className="p-6"><InlineEmpty text="No application details available." /></div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="interview-details" className="flex-1 overflow-y-auto m-0 p-6">
                    <InterviewDetailsTab jhsId={stageInstanceId} />
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right Panel - Scorecard Form */}
              <div className="w-full lg:w-[47%] overflow-y-auto p-6 space-y-6 bg-[#FAFAF7]">
                {/* Points to validate — Gio suggestion inbox */}
                {candidateId && jobId && stageName && (
                  <GioPointsInbox
                    candidateId={candidateId}
                    jobId={jobId}
                    associationId={associationId}
                    stageName={stageName}
                    scorecardId={existing?.id ?? null}
                    readOnly={isReadOnly}
                    onAdd={(idx, q) =>
                      gioAdded.add({ source_point_index: idx, question: q })
                    }
                    onRemoveAdded={(idx) => gioAdded.remove(idx)}
                  />
                )}
                {/* AI Suggested Rating — structured lilac card */}
                {isAiDraft && aiSuggestedRating && aiAnalysis && (
                  <AiSuggestedRatingCard
                    verdictLabel={aiSuggestedRating}
                    analysis={aiAnalysis}
                    normalizedMarkdown={normalizeAiAnalysis(aiAnalysis)}
                    applied={aiRatingToScoreRating[aiSuggestedRating] === rating}
                    onApply={handleAcceptAiSuggestion}
                    disabled={isReadOnly}
                  />
                )}


                <CandidateSheetSection label="OVERALL RATING">
                  <OverallRatingPills
                    value={rating}
                    onChange={(v) => setRating(v)}
                    disabled={isReadOnly}
                  />
                </CandidateSheetSection>

                {(!loadingQuestions && questions.length > 0) || gioAdded.items.length > 0 ? (
                  <CandidateSheetSection label="INTERVIEW QUESTIONS">
                    <div className="space-y-6">
                      {questions.map(renderQuestion)}
                      {gioAdded.items.map((q) => (
                        <AddedFromGioBlock
                          key={q.id}
                          item={q}
                          readOnly={isReadOnly}
                          onAnswerChange={gioAdded.setAnswer}
                          onRemove={(idx) => {
                            gioAdded.remove(idx);
                            // Revert decision so it returns to the inbox.
                            import('@/lib/supabaseClient').then(({ supabase }) =>
                              supabase
                                .from('validation_point_resolutions')
                                .upsert(
                                  {
                                    association_id: associationId,
                                    point_index: idx,
                                    point_question: q.question,
                                    status: 'dismissed',
                                    resolved_in_stage: stageName ?? '',
                                    resolved_at: new Date().toISOString(),
                                  } as any,
                                  { onConflict: 'association_id,point_index' }
                                )
                            );
                          }}
                        />
                      ))}
                    </div>
                  </CandidateSheetSection>
                ) : null}

                <KeyTakeawaysCard
                  value={overview}
                  onChange={setOverview}
                  onPolish={handlePolishNotes}
                  isPolishing={isPolishing}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="p-6 border-t border-[#E7E8EE] bg-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[12.5px] text-[#5A6072] font-inter">
                  <Info className="h-3.5 w-3.5 text-[#8B8F9E]" />
                  <span>Drafts stay private until you submit.</span>
                </div>
                <div className="flex justify-end gap-3">
                  {isReadOnly && !editMode ? (
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={handleCancelClick} disabled={saving}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave} disabled={saving} className="gap-2">
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            {existing ? 'Update scorecard' : 'Submit scorecard'}
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
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
