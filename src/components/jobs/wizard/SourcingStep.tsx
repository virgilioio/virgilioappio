import { Card } from '@/components/ui/card';
import { CreditsMeter } from '@/components/sourcing/CreditsMeter';
import { useOrgCredits } from '@/hooks/useOrgCredits';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SourcingStepProps {
  jobId?: string;
  jobTitle?: string;
}

export function SourcingStep({ jobId, jobTitle }: SourcingStepProps) {
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
    <div className="space-y-6">
      {/* Header with Credits Meter */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Source Candidates</h2>
          <p className="text-muted-foreground mt-1">
            {jobTitle 
              ? `Find qualified candidates for ${jobTitle}`
              : 'Find qualified candidates from external sources'}
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

      {/* Placeholder content - will be filled in later slices */}
      <Card className="p-8 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center">
            <svg
              className="w-8 h-8 text-muted-foreground"
              fill="none"
              strokeWidth="1.5"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">External Sourcing Coming Soon</h3>
          <p className="text-sm text-muted-foreground">
            This step will allow you to search and collect candidate profiles from external providers.
            Your search and collect credits are shown above.
          </p>
        </div>
      </Card>
    </div>
  );
}
