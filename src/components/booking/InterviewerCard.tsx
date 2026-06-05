import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Globe } from 'lucide-react';

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
  location?: string | null;
  showRepliesFast?: boolean;
}

export function InterviewerCard({ profile, config, location, showRepliesFast = true }: InterviewerCardProps) {
  const initials = `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase();
  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={profile.avatar_url || undefined} alt={fullName} />
          <AvatarFallback className="bg-virgilio-purple text-white text-base font-poppins font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="leading-tight">
          <div className="font-poppins font-bold text-virgilio-text text-[16px] tracking-[-0.02em]">
            {fullName || config.display_name}
          </div>
          {config.description && (
            <div className="text-[12.5px] text-virgilio-muted mt-0.5">{config.description}</div>
          )}
        </div>
      </div>

      {(showRepliesFast || location) && (
        <div className="flex items-center gap-3 text-[12px] text-virgilio-muted">
          {showRepliesFast && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              Usually replies fast
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {location}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
