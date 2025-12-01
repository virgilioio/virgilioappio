import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Info, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { getOrganizationTree } from '@/lib/organizationHelpers';

export interface TeamInterviewer {
  id: string;
  member_id: string;
  assignment_type: 'required' | 'optional' | 'backup' | 'manual';
  member_user_id?: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
  booking_configurations: {
    id: string;
    display_name: string;
    description: string | null;
    duration_minutes: number;
    is_active: boolean;
  } | null;
}

interface ManualInterviewerSelectorProps {
  jobId: string;
  organizationId: string;
  onSelect: (interviewer: TeamInterviewer) => void;
}

export function ManualInterviewerSelector({
  jobId,
  organizationId,
  onSelect,
}: ManualInterviewerSelectorProps) {
  // Fetch all team members with active booking configurations
  const { data: teamInterviewers, isLoading } = useQuery({
    queryKey: ['team-interviewers-with-booking-config', jobId, organizationId],
    queryFn: async () => {
      // Get organization tree for broader access
      const orgTree = await getOrganizationTree(organizationId);
      
      // Get all members from org tree
      const { data: members, error: memberError } = await supabase
        .from('members')
        .select('id, user_id, tenant_id')
        .in('organization_id', orgTree)
        .eq('user_status', 'active');
      
      if (memberError) throw memberError;
      if (!members || members.length === 0) return [];
      
      const userIds = members.map(m => m.user_id).filter(Boolean) as string[];
      if (userIds.length === 0) return [];
      
      // Fetch only active booking configurations
      const { data: bookingConfigs, error: configError } = await supabase
        .from('booking_configurations')
        .select('*')
        .in('user_id', userIds)
        .eq('is_active', true);
      
      if (configError) throw configError;
      
      // Filter to only users with active booking configs
      const usersWithBookingConfig = bookingConfigs?.map(bc => bc.user_id) || [];
      if (usersWithBookingConfig.length === 0) return [];
      
      // Fetch profiles for users with booking configs
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', usersWithBookingConfig);
      
      if (profileError) throw profileError;
      
      // Build the interviewer list
      return members
        .filter(m => usersWithBookingConfig.includes(m.user_id!))
        .map(member => ({
          id: member.id,
          member_id: member.id,
          assignment_type: 'manual' as const,
          member_user_id: member.user_id!,
          profiles: profiles?.find(p => p.user_id === member.user_id) || null,
          booking_configurations: bookingConfigs?.find(bc => bc.user_id === member.user_id) || null,
        }));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!teamInterviewers || teamInterviewers.length === 0) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No team members have active booking configurations. Interviewers need to set up their availability before interviews can be scheduled.
          </AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link to="/settings?tab=booking">
            <Settings className="h-4 w-4 mr-2" />
            Configure Booking Availability
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert variant="default" className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          No interviewers are assigned to this stage. Select a team member manually to schedule the interview.
        </AlertDescription>
      </Alert>
      
      <h3 className="text-lg font-semibold">Select Interviewer</h3>
      
      <div className="space-y-3">
        {teamInterviewers.map((interviewer) => (
          <Card
            key={interviewer.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => onSelect(interviewer)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={interviewer.profiles?.avatar_url || undefined} />
                  <AvatarFallback>
                    {interviewer.profiles?.first_name?.[0] || 'I'}
                    {interviewer.profiles?.last_name?.[0] || ''}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">
                    {interviewer.profiles?.first_name || 'Unknown'}{' '}
                    {interviewer.profiles?.last_name || ''}
                  </div>
                  <div className="text-sm text-text-secondary">
                    {interviewer.booking_configurations?.display_name}
                  </div>
                </div>
                <Badge variant="outline">
                  manual
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
