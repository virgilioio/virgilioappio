import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { GoGioLogo } from '@/components/GoGioLogo';
import { InterviewerCard } from '@/components/booking/InterviewerCard';
import { MonthCalendar } from '@/components/booking/MonthCalendar';
import { TimeSlotsList } from '@/components/booking/TimeSlotsList';
import { BookingConfirmationForm } from '@/components/booking/BookingConfirmationForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Globe } from 'lucide-react';
import { startOfMonth, endOfMonth, isSameDay, parseISO } from 'date-fns';
import { useBookingAvailability } from '@/hooks/useBookingAvailability';
import { 
  parseBookingContextFromUrl, 
  BookingContext, 
  hasShortToken, 
  getShortToken, 
  resolveBookingToken 
} from '@/lib/bookingLinkUtils';
import gioAvatar from '@/assets/gio-avatar.png';

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
  const [searchParams] = useSearchParams();
  const [candidateTimezone, setCandidateTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [resolvedContext, setResolvedContext] = useState<BookingContext | null>(null);
  const [isResolvingToken, setIsResolvingToken] = useState(false);

  // Parse contextual booking context from URL (legacy base64)
  const legacyContext = useMemo(() => {
    return parseBookingContextFromUrl(searchParams);
  }, [searchParams]);

  // Resolve short token if present
  useEffect(() => {
    const resolveToken = async () => {
      if (hasShortToken(searchParams)) {
        const token = getShortToken(searchParams);
        if (token) {
          setIsResolvingToken(true);
          try {
            const context = await resolveBookingToken(token);
            setResolvedContext(context);
          } catch (e) {
            console.error('Failed to resolve booking token:', e);
          } finally {
            setIsResolvingToken(false);
          }
        }
      }
    };

    resolveToken();
  }, [searchParams]);

  // Use resolved context (short token) or legacy context (base64)
  const bookingContext = resolvedContext || legacyContext;

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
      
      // Construct full avatar URL if avatar_url exists
      let fullAvatarUrl = null;
      if (profile?.avatar_url) {
        const { data } = supabase.storage
          .from('avatars')
          .getPublicUrl(profile.avatar_url);
        fullAvatarUrl = data.publicUrl;
      }
      
      return {
        ...bookingConfig,
        profiles: profile 
          ? { ...profile, avatar_url: fullAvatarUrl }
          : { first_name: 'User', last_name: '', avatar_url: null },
      };
    },
    retry: false,
  });

  // Fetch availability for the current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  const { data: availabilityData, isLoading: isLoadingAvailability } = useBookingAvailability(
    config?.id,
    monthStart,
    monthEnd,
    config?.duration_minutes || 30,
    candidateTimezone
  );

  // Extract available dates from availability data
  const availableDates = useMemo(() => {
    if (!availabilityData?.available_slots) return [];
    
    const uniqueDates = new Set<string>();
    availabilityData.available_slots.forEach(slot => {
      const date = parseISO(slot.start);
      uniqueDates.add(date.toDateString());
    });
    
    return Array.from(uniqueDates).map(dateStr => new Date(dateStr));
  }, [availabilityData]);

  // Filter time slots for selected date
  const timeSlotsForSelectedDate = useMemo(() => {
    if (!selectedDate || !availabilityData?.available_slots) return [];
    
    return availabilityData.available_slots.filter(slot => {
      const slotDate = parseISO(slot.start);
      return isSameDay(slotDate, selectedDate);
    });
  }, [selectedDate, availabilityData]);

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
          scheduled_start: selectedSlot.start,
          scheduled_end: selectedSlot.end,
          notes: formData.notes || null,
          // Pass contextual booking context if available
          ...(bookingContext && {
            job_id: bookingContext.jobId,
            candidate_id: bookingContext.candidateId,
            job_hiring_stage_id: bookingContext.jhsId,
            job_candidate_association_id: bookingContext.associationId,
          }),
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Navigate to confirmation page
      window.location.href = `/schedule/${shortCode}/confirmed/${data.booking_id}`;
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
              <GoGioLogo />
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
              <GoGioLogo />
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
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-virgilio-border bg-white/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4">
          <Link to="/">
            <GoGioLogo />
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 max-w-[1400px]">
        {/* Personalized greeting for stage booking links */}
        {bookingContext?.candidateName && !isResolvingToken && (
          <p className="text-lg md:text-xl text-virgilio-muted mb-2">
            Hi, {bookingContext.candidateName.split(' ')[0]}! 👋
          </p>
        )}
        <h1 className="text-h1-mobile md:text-h1-desktop font-poppins font-bold text-virgilio-text mb-6">
          Select a Date & Time<span className="text-virgilio-purple">.</span>
        </h1>

        {/* Contextual Booking Header - show job/stage info if available */}
        {bookingContext?.jobTitle && (
          <div className="mb-8 p-4 bg-virgilio-purple/10 border border-virgilio-purple/25 rounded-lg">
            <div className="flex items-center gap-3">
              <img src={gioAvatar} alt="Gio" className="h-10 w-10 rounded-full bg-white" />
              <div>
                <p className="text-sm text-virgilio-purple">Scheduling interview for</p>
                <p className="font-medium text-virgilio-text">
                  {bookingContext.jobTitle}
                  {bookingContext.stageName && (
                    <span className="text-virgilio-purple"> · {bookingContext.stageName}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_380px] gap-8">
          {/* Left column - Event summary */}
          <div className="order-1">
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

          {/* Middle column - Calendar */}
          <div className="order-2">
            <Card className="shadow-calendly border-virgilio-border">
              <CardContent className="p-6">
                <MonthCalendar
                  availableDates={availableDates}
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  currentMonth={currentMonth}
                  onMonthChange={setCurrentMonth}
                />
                
                {/* Timezone display */}
                <div className="mt-6 pt-6 border-t border-virgilio-border">
                  <div className="flex items-center gap-2 text-sm text-virgilio-muted">
                    <Globe className="h-4 w-4" />
                    <span>
                      Times shown in {candidateTimezone.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column - Time slots & Form */}
          <div className="order-3">
            {!selectedSlot ? (
              <Card className="shadow-calendly border-virgilio-border">
                <CardContent className="p-6">
                  <TimeSlotsList
                    selectedDate={selectedDate}
                    timeSlots={timeSlotsForSelectedDate}
                    selectedSlot={selectedSlot}
                    onSlotSelect={setSelectedSlot}
                    isLoading={isLoadingAvailability}
                  />
                </CardContent>
              </Card>
            ) : (
              <BookingConfirmationForm
                selectedSlot={selectedSlot}
                candidateTimezone={candidateTimezone}
                onCancel={() => setSelectedSlot(null)}
                onConfirm={createBookingMutation.mutateAsync}
                // Pre-fill candidate info from context
                defaultCandidateName={bookingContext?.candidateName}
                defaultCandidateEmail={bookingContext?.candidateEmail}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
