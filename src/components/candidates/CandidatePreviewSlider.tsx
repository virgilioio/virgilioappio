import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EnhancedSkillBadge } from '@/components/ui/enhanced-skill-badge';
import { Briefcase, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CandidatePreviewSliderProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: {
    name?: string;
    title?: string;
    company?: string;
    location?: string;
    match: number;
    profileUrl?: string;
    provider_code: string;
  } | null;
}

export function CandidatePreviewSlider({
  isOpen,
  onClose,
  candidate,
}: CandidatePreviewSliderProps) {
  if (!candidate) return null;

  const getMatchColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 text-green-700 dark:text-green-400';
    if (score >= 60) return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
    if (score >= 40) return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
    return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-xl">{candidate.name || 'Unknown'}</SheetTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getMatchColor(candidate.match)}>
                  {candidate.match}% Match
                </Badge>
                <span className="text-xs text-muted-foreground">
                  via {candidate.provider_code === 'coresignal' ? 'CoreSignal' : 'Data Partner'}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Current Position */}
          {(candidate.title || candidate.company) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Current Position
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {candidate.title && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Title</div>
                    <div className="text-base">{candidate.title}</div>
                  </div>
                )}
                {candidate.company && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Company</div>
                    <div className="text-base">{candidate.company}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Location */}
          {candidate.location && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-base">{candidate.location}</div>
              </CardContent>
            </Card>
          )}

          {/* Profile Link */}
          {candidate.profileUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={candidate.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View external profile →
                </a>
              </CardContent>
            </Card>
          )}

          {/* Attribution Notice */}
          <div className="text-xs text-muted-foreground border-t pt-4">
            <p>
              Profile data provided by{' '}
              {candidate.provider_code === 'coresignal' ? 'CoreSignal' : 'data partner'}.
              This is a preview only. Full contact details available after collection.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
