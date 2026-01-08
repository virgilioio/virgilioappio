import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw, Check, Loader2 } from 'lucide-react';
import { useAIDraftEmail } from '@/hooks/useAIDraftEmail';
import { toast } from 'sonner';

interface AIDraftPopoverProps {
  candidateId?: string;
  senderName?: string;
  jobId?: string;
  onInsert: (subject: string, body: string) => void;
  children: React.ReactNode;
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

export function AIDraftPopover({ candidateId, jobId, onInsert, senderName, children }: AIDraftPopoverProps) {
  const [open, setOpen] = useState(false);
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
      // Pass plain text - the editor will handle formatting
      onInsert(generatedDraft.subject, generatedDraft.body);
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
    setOpen(false);
  };

  const isGenerating = draftMutation.isPending;

  return (
    <Popover open={open} onOpenChange={(value) => {
      if (!value) handleReset();
      else setOpen(value);
    }}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="font-medium text-sm">AI Email Draft</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose a suggestion or describe what you want to write.
          </p>

          {/* Quick Suggestions */}
          {!generatedDraft && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick suggestions</Label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SUGGESTIONS.map((suggestion) => (
                    <Badge
                      key={suggestion.label}
                      variant={selectedSuggestion === suggestion.label ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary/10 transition-colors px-2 py-1 text-xs"
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
                  <span className="bg-popover px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {/* Custom Prompt */}
              <div className="space-y-2">
                <Textarea
                  placeholder="e.g., Invite them to a final round interview..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={2}
                  disabled={isGenerating}
                  className="text-sm"
                />
                <Button 
                  onClick={handleCustomSubmit} 
                  disabled={isGenerating || !customPrompt.trim()}
                  className="w-full"
                  size="sm"
                >
                  {isGenerating && !selectedSuggestion ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-2" />
                      Generate Draft
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Generated Draft Preview */}
          {generatedDraft && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Subject</Label>
                <div className="p-2 bg-muted rounded-md text-xs">
                  {generatedDraft.subject}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Body</Label>
                <div className="p-2 bg-muted rounded-md text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {/* Strip HTML tags for clean preview */}
                  {generatedDraft.body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleInsert} className="flex-1" size="sm">
                  <Check className="h-3 w-3 mr-2" />
                  Use Draft
                </Button>
                <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={isGenerating}>
                  {isGenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setGeneratedDraft(null)}>
                  Edit
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
