import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { VirgilioLogo } from '@/components/VirgilioLogo';
import { InterviewerCard } from '@/components/booking/InterviewerCard';
import { AvailabilityCalendar } from '@/components/booking/AvailabilityCalendar';
import { BookingConfirmationForm } from '@/components/booking/BookingConfirmationForm';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

// Common timezones for the selector
const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

export default function PublicBookingPage() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [candidateTimezone, setCandidateTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Fetch booking configuration
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['public-booking-config', shortCode],
    queryFn: async () => {
      // First get the booking config
      const { data: bookingConfig, error: configError } = await supabase
        .from('booking_configurations')
        .select('*')
        .eq('short_code', shortCode)
        .eq('is_active', true)
        .single();
      
      if (configError) throw configError;
      
      // Then get the profile separately
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url')
        .eq('user_id', bookingConfig.user_id)
        .single();
      
      if (profileError) {
        console.warn('Failed to load profile:', profileError);
      }
      
      return {
        ...bookingConfig,
        profiles: profile || { first_name: 'User', last_name: '', avatar_url: null },
      };
    },
    retry: false,
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (formData: {
      candidate_name: string;
      candidate_email: string;
      candidate_phone?: string;
      notes?: string;
    }) => {
      if (!selectedSlot || !config) throw new Error('Missing required data');

      const { data, error } = await supabase.functions.invoke('create-booking', {
        body: {
          booking_config_id: config.id,
          candidate_name: formData.candidate_name,
          candidate_email: formData.candidate_email,
          candidate_phone: formData.candidate_phone || null,
          candidate_timezone: candidateTimezone,
          scheduled_start: selectedSlot.start.toISOString(),
          scheduled_end: selectedSlot.end.toISOString(),
          notes: formData.notes || null,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Booking Confirmed!',
        description: data.meet_link 
          ? 'Your interview has been scheduled. Check your email for the Google Meet link.'
          : 'Your interview has been scheduled. You will receive a confirmation email shortly.',
      });
      setBookingSuccess(true);
      setSelectedSlot(null);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Booking Failed',
        description: error.message || 'Failed to create booking. Please try again.',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background-elevated">
          <div className="container mx-auto px-4 py-4">
            <Link to="/">
              <VirgilioLogo />
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <Skeleton className="h-[400px] w-full" />
            </div>
            <div className="md:col-span-2">
              <Skeleton className="h-[600px] w-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background-elevated">
          <div className="container mx-auto px-4 py-4">
            <Link to="/">
              <VirgilioLogo />
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
              <h1 className="text-2xl font-semibold text-text-primary">Booking Link Not Found</h1>
              <p className="text-text-secondary">
                This booking link is either inactive or doesn't exist. Please check with the person who sent you this link.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (bookingSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background-elevated">
          <div className="container mx-auto px-4 py-4">
            <Link to="/">
              <VirgilioLogo />
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
              <h1 className="text-2xl font-semibold text-text-primary">Interview Scheduled!</h1>
              <p className="text-text-secondary">
                Your interview has been confirmed. You will receive a confirmation email with all the details and a Google Meet link.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background-elevated">
        <div className="container mx-auto px-4 py-4">
          <Link to="/">
            <VirgilioLogo />
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Left: Interviewer Info */}
          <div className="md:col-span-1">
            {config.profiles && (
              <InterviewerCard
                profile={config.profiles}
                config={{
                  display_name: config.display_name,
                  description: config.description,
                  duration_minutes: config.duration_minutes,
                }}
              />
            )}
          </div>

          {/* Right: Calendar & Booking */}
          <div className="md:col-span-2 space-y-4">
            {/* Timezone Selector */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Your Timezone</Label>
                  <Select value={candidateTimezone} onValueChange={setCandidateTimezone}>
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_TIMEZONES.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Availability Calendar */}
            <AvailabilityCalendar
              bookingConfigId={config.id}
              durationMinutes={config.duration_minutes}
              candidateTimezone={candidateTimezone}
              onSlotSelect={setSelectedSlot}
              selectedSlot={selectedSlot}
            />
          </div>
        </div>
      </main>

      {/* Booking Confirmation Form */}
      <BookingConfirmationForm
        selectedSlot={selectedSlot}
        candidateTimezone={candidateTimezone}
        onCancel={() => setSelectedSlot(null)}
        onConfirm={createBookingMutation.mutateAsync}
      />
    </div>
  );
}
