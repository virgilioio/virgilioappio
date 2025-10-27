import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
    <Card className="shadow-calendly border-virgilio-border rounded-lg">
      <CardContent className="p-6 space-y-6">
        {/* Host Info */}
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14">
            <AvatarImage src={profile.avatar_url || undefined} alt={`${profile.first_name} ${profile.last_name}`} />
            <AvatarFallback className="bg-virgilio-purple text-white text-lg font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm text-virgilio-muted font-medium">
              {profile.first_name} {profile.last_name}
            </p>
          </div>
        </div>

        {/* Event Title */}
        <div>
          <h3 className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
            {config.display_name}
            <span className="text-virgilio-purple">.</span>
          </h3>
        </div>

        {/* Duration & Location */}
        <div className="space-y-3 pt-3 border-t border-virgilio-border">
          <div className="flex items-center gap-2 text-virgilio-muted">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">{config.duration_minutes} min</span>
          </div>
          <div className="flex items-center gap-2 text-virgilio-muted">
            <Video className="h-4 w-4" />
            <span className="text-sm font-medium">Google Meet</span>
          </div>
        </div>

        {/* Description */}
        {config.description && (
          <div className="pt-3 border-t border-virgilio-border">
            <p className="text-sm text-virgilio-muted leading-relaxed">
              {config.description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
