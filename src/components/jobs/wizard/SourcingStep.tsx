import { CreditsMeter } from '@/components/sourcing/CreditsMeter';
import { useOrgCredits } from '@/hooks/useOrgCredits';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SourcingTab } from '@/components/jobs/SourcingTab';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SourcingStepProps {
  jobId: string;
  onNext: () => void;
  onBack: () => void;
}

export function SourcingStep({ jobId, onNext, onBack }: SourcingStepProps) {
  const { credits, isLoading, error, refetch } = useOrgCredits();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Source Candidates</h2>
            <p className="text-muted-foreground mt-1">
              Find qualified candidates from external sources
            </p>
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load sourcing credits. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!credits) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with Credits Meter */}
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-2xl font-bold">Source Candidates</h2>
          <p className="text-muted-foreground mt-1">
            Find qualified candidates from external sources
          </p>
        </div>
        
        <CreditsMeter
          searchCredits={credits.search}
          collectCredits={credits.collect}
          lastRefill={credits.lastRefill}
          nextRefill={credits.nextRefill}
          onRefresh={refetch}
          isLoading={isLoading}
        />
      </div>

      {/* Sourcing Tab */}
      <div className="flex-1 overflow-hidden">
        <SourcingTab jobId={jobId} />
      </div>

      {/* Navigation Footer */}
      <div className="pt-4 border-t flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          className="flex items-center gap-2"
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
