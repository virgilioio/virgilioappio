import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw, Check, Loader2 } from 'lucide-react';
import { useAIDraftEmail } from '@/hooks/useAIDraftEmail';
import { toast } from 'sonner';

interface AIDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId?: string;
  senderName?: string;
  jobId?: string;
  onInsert: (subject: string, body: string) => void;
}

const QUICK_SUGGESTIONS = [
  {
    label: 'Follow-up',
    prompt: 'Write a friendly follow-up email to check on the candidate and keep them engaged in the process',
  },
  {
    label: 'Process Update',
    prompt: 'Write an email updating the candidate on where they are in our hiring process and what to expect next',
  },
  {
    label: 'Reply to Last',
    prompt: 'Write a thoughtful reply to the candidate\'s most recent email, addressing their message professionally',
  },
  {
    label: 'Schedule Interview',
    prompt: 'Write an email to invite the candidate to schedule their next interview round',
  },
  {
    label: 'Request Availability',
    prompt: 'Write an email asking the candidate for their availability for upcoming interviews',
  },
  {
    label: 'Share Good News',
    prompt: 'Write a positive email sharing that we\'d like to move forward with the candidate to the next stage',
  },
];

export function AIDraftDialog({ open, onOpenChange, candidateId, jobId, onInsert, senderName }: AIDraftDialogProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<{ subject: string; body: string } | null>(null);
  
  const draftMutation = useAIDraftEmail();

  const handleGenerate = async (prompt: string) => {
    if (!candidateId || !jobId) {
      toast.error('Missing candidate or job context');
      return;
    }

    try {
      const result = await draftMutation.mutateAsync({
        candidateId,
        jobId,
        prompt,
        senderName: senderName || undefined,
      });
      setGeneratedDraft(result);
    } catch (error) {
      toast.error('Failed to generate draft. Please try again.');
      console.error('AI draft error:', error);
    }
  };

  const handleSuggestionClick = (suggestion: typeof QUICK_SUGGESTIONS[0]) => {
    setSelectedSuggestion(suggestion.label);
    setCustomPrompt('');
    handleGenerate(suggestion.prompt);
  };

  const handleCustomSubmit = () => {
    if (!customPrompt.trim()) {
      toast.error('Please describe what you want to write');
      return;
    }
    setSelectedSuggestion(null);
    handleGenerate(customPrompt);
  };

  const handleInsert = () => {
    if (generatedDraft) {
      // Convert plain text body to HTML with proper line breaks
      const htmlBody = generatedDraft.body
        .split('\n\n')
        .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
        .join('');
      onInsert(generatedDraft.subject, htmlBody);
      handleReset();
    }
  };

  const handleRegenerate = () => {
    const prompt = selectedSuggestion 
      ? QUICK_SUGGESTIONS.find(s => s.label === selectedSuggestion)?.prompt || customPrompt
      : customPrompt;
    if (prompt) {
      handleGenerate(prompt);
    }
  };

  const handleReset = () => {
    setGeneratedDraft(null);
    setCustomPrompt('');
    setSelectedSuggestion(null);
    onOpenChange(false);
  };

  const isGenerating = draftMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) handleReset();
      else onOpenChange(value);
    }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Email Draft
          </DialogTitle>
          <DialogDescription>
            Describe what you want to write, or choose a suggestion. AI will use context from the candidate, job, emails, and interviews.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick Suggestions */}
          {!generatedDraft && (
            <>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Quick suggestions</Label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_SUGGESTIONS.map((suggestion) => (
                    <Badge
                      key={suggestion.label}
                      variant={selectedSuggestion === suggestion.label ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary/10 transition-colors px-3 py-1.5"
                      onClick={() => !isGenerating && handleSuggestionClick(suggestion)}
                    >
                      {isGenerating && selectedSuggestion === suggestion.label ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : null}
                      {suggestion.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or write your own</span>
                </div>
              </div>

              {/* Custom Prompt */}
              <div className="space-y-2">
                <Textarea
                  placeholder="e.g., Invite them to a final round interview with our CTO next week..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={3}
                  disabled={isGenerating}
                />
                <Button 
                  onClick={handleCustomSubmit} 
                  disabled={isGenerating || !customPrompt.trim()}
                  className="w-full"
                >
                  {isGenerating && !selectedSuggestion ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Draft
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Generated Draft Preview */}
          {generatedDraft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Subject</Label>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {generatedDraft.subject}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Body</Label>
                <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {generatedDraft.body}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleInsert} className="flex-1">
                  <Check className="h-4 w-4 mr-2" />
                  Use This Draft
                </Button>
                <Button variant="outline" onClick={handleRegenerate} disabled={isGenerating}>
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setGeneratedDraft(null)}>
                  Edit Prompt
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
