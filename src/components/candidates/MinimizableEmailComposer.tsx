import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmailComposer } from '@/components/candidates/EmailComposer';
import { cn } from '@/lib/utils';

interface MinimizableEmailComposerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId?: string;
  jobId?: string;
  defaultTo?: string;
  candidateName?: string;
  onSuccess?: () => void;
  // Contextual booking link context
  jhsId?: string;
  associationId?: string;
  // Reply/Forward support
  mode?: 'compose' | 'reply' | 'forward';
  inReplyToMessageId?: string;
  defaultSubject?: string;
  defaultBody?: string;
  defaultCc?: string;
}

export function MinimizableEmailComposer({
  isOpen,
  onOpenChange,
  candidateId,
  jobId,
  defaultTo,
  candidateName,
  onSuccess,
  jhsId,
  associationId,
  mode = 'compose',
  inReplyToMessageId,
  defaultSubject,
  defaultBody,
  defaultCc,
}: MinimizableEmailComposerProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isOpen) return null;

  const handleSuccess = () => {
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <div
      className={cn(
        "absolute bottom-4 right-4 z-[60] bg-background border rounded-lg shadow-2xl transition-all duration-300 pointer-events-auto",
        isMinimized ? "w-[432px] h-[52px]" : "w-[720px] max-w-[min(95vw,720px)]"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Bar */}
      <div
        className={cn(
          "flex items-center justify-between bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors",
          isMinimized ? "h-full px-4 rounded-lg" : "p-4 border-b rounded-t-lg"
        )}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <h3 className="font-semibold text-sm truncate">
          {mode === 'reply' 
            ? (isMinimized ? `Reply: ${candidateName || 'Candidate'}` : `Reply to ${candidateName || 'Candidate'}`)
            : mode === 'forward'
            ? (isMinimized ? `Forward: ${candidateName || 'Candidate'}` : `Forward Email`)
            : (isMinimized ? `Compose: ${candidateName || 'Candidate'}` : `Send Email to ${candidateName || 'Candidate'}`)
          }
        </h3>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content Area */}
      {!isMinimized && (
        <div className="max-h-[600px] overflow-y-auto p-4">
          <EmailComposer
            candidateId={candidateId}
            jobId={jobId}
            defaultTo={defaultTo}
            onSuccess={handleSuccess}
            embedded
            jhsId={jhsId}
            associationId={associationId}
            inReplyToMessageId={inReplyToMessageId}
            defaultSubject={defaultSubject}
            defaultBody={defaultBody}
            defaultCc={defaultCc}
          />
        </div>
      )}
    </div>
  );
}
