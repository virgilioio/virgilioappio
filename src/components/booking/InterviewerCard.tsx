import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';

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
  const initials = `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase();

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profile.avatar_url || undefined} alt={`${profile.first_name} ${profile.last_name}`} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-text-primary">
              {config.display_name}
            </h3>
            <Badge variant="secondary" className="gap-1.5 mt-1">
              <Clock className="h-3.5 w-3.5" />
              {config.duration_minutes} min
            </Badge>
          </div>
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
