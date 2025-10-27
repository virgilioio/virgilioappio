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
  const initials = `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase();

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <Avatar className="w-24 h-24">
            <AvatarImage src={profile.avatar_url || undefined} alt={`${profile.first_name} ${profile.last_name}`} />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">
              {profile.first_name} {profile.last_name}
            </h2>
            <p className="text-text-secondary mt-1">{config.display_name}</p>
          </div>

          {config.description && (
            <p className="text-sm text-text-secondary italic max-w-md">
              "{config.description}"
            </p>
          )}

          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
              <Clock className="w-4 h-4" />
              <span>{config.duration_minutes} minutes</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
              <Video className="w-4 h-4" />
              <span>Google Meet</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
