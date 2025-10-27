import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Video } from 'lucide-react';

interface InterviewerCardProps {
  profile: {
    first_name: string;
    last_name: string;
    avatar_url?: string | null;
  };
  config: {
    display_name: string;
    description?: string | null;
    duration_minutes: number;
  };
}

export function InterviewerCard({ profile, config }: InterviewerCardProps) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-text-primary mb-2">
            {config.display_name}
          </h3>
          <Badge variant="secondary" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {config.duration_minutes} min
          </Badge>
        </div>
        
        {config.description && (
          <p className="text-sm text-text-secondary leading-relaxed">
            {config.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
