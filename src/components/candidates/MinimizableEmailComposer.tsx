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
}

export function MinimizableEmailComposer({
  isOpen,
  onOpenChange,
  candidateId,
  jobId,
  defaultTo,
  candidateName,
  onSuccess,
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
        "fixed bottom-4 right-4 z-[100] bg-background border rounded-lg shadow-2xl transition-all duration-300",
        isMinimized ? "w-[320px]" : "w-[600px]",
        isOpen ? "animate-slide-in-bottom-right" : "animate-slide-out-bottom-right"
      )}
    >
      {/* Header Bar */}
      <div
        className="flex items-center justify-between p-4 border-b bg-muted/30 rounded-t-lg cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <h3 className="font-semibold text-sm">
          Send Email to {candidateName || 'Candidate'}
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
          />
        </div>
      )}
    </div>
  );
}
