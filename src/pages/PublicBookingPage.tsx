import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { InterviewerCard } from '@/components/booking/InterviewerCard';
import { MonthCalendar } from '@/components/booking/MonthCalendar';
import { TimeSlotsList } from '@/components/booking/TimeSlotsList';
import { BookingConfirmationForm } from '@/components/booking/BookingConfirmationForm';
import { ExistingBookingView, ExistingBookingData } from '@/components/booking/ExistingBookingView';
import { EventTypePicker } from '@/components/booking/EventTypePicker';
import { JobStageSummaryCard } from '@/components/booking/JobStageSummaryCard';
import { PublicBookingHeader } from '@/components/booking/PublicBookingHeader';
import { PublicBookingFooter } from '@/components/booking/PublicBookingFooter';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/ui/empty-state';
import { SoftFlag, SoftCalendar } from '@/components/ui/EmptyIllustrations';
import { AlertCircle, Globe, ShieldX, ArrowLeft, Clock, Users } from 'lucide-react';
import { startOfMonth, endOfMonth, isSameDay, isSameMonth, parseISO } from 'date-fns';
import { useBookingAvailability, EventTypeOverrides } from '@/hooks/useBookingAvailability';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  parseBookingContextFromUrl,
  BookingContext,
  hasShortToken,
  getShortToken,
  resolveBookingToken,
} from '@/lib/bookingLinkUtils';
import { useReportSplashReady } from '@/contexts/SplashReadyContext';

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

function formatNamesList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export default function PublicBookingPage() {
  const { shortCode, eventSlug } = useParams<{ shortCode: string; eventSlug?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [mobileStep, setMobileStep] = useState<'date' | 'time' | 'confirm'>('date');
  const [candidateTimezone, setCandidateTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [resolvedContext, setResolvedContext] = useState<BookingContext | null>(null);
  const [isResolvingToken, setIsResolvingToken] = useState(false);
  const [existingBooking, setExistingBooking] = useState<ExistingBookingData | null>(null);
  const [tokenStatus, setTokenStatus] = useState<'active' | 'expired' | null>(null);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [bookingCancelled, setBookingCancelled] = useState(false);
  const [groupBookingConfigIds, setGroupBookingConfigIds] = useState<string[] | null>(null);
  const [groupInterviewerNames, setGroupInterviewerNames] = useState<string[]>([]);
  const autoAdvanceCountRef = useRef(0);
  const hasAutoSelectedRef = useRef(false);
  const [selectedEventType, setSelectedEventType] = useState<any>(null);

  // Parse contextual booking context from URL (legacy base64)
  const legacyContext = useMemo(() => {
    return parseBookingContextFromUrl(searchParams);
  }, [searchParams]);

  // The short token value (needed for cancel-booking-public)
  const shortToken = useMemo(() => getShortToken(searchParams), [searchParams]);

  // Resolve short token if present
  useEffect(() => {
    const resolveToken = async () => {
      if (hasShortToken(searchParams)) {
        const token = getShortToken(searchParams);
        if (token) {
          setIsResolvingToken(true);
          try {
            const result = await resolveBookingToken(token);
            if (result) {
              setResolvedContext(result.context);
              setTokenStatus(result.token_status);
              if (result.existing_booking) {
                setExistingBooking(result.existing_booking as ExistingBookingData);
              }
              if (result.scheduling_mode === 'group' && result.booking_config_ids?.length) {
                setGroupBookingConfigIds(result.booking_config_ids);
                if (result.group_interviewers?.length) {
                  setGroupInterviewerNames(
                    result.group_interviewers.map(p => `${p.first_name} ${p.last_name}`.trim())
                  );
                }
              }
            } else {
              setTokenStatus('expired');
            }
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

  // Determine what view to show
  const showExpiredView = tokenStatus === 'expired' && !bookingCancelled;
  const showExistingBookingView = !!existingBooking && !rescheduleBookingId && !bookingCancelled;

  // Fetch booking configuration
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['public-booking-config', shortCode],
    queryFn: async () => {
      const { data: bookingConfig, error: configError } = await supabase
        .from('booking_configurations')
        .select('*')
        .eq('short_code', shortCode)
        .eq('is_active', true)
        .single();
      
      if (configError) throw configError;
      
      const { data: profileRows, error: profileError } = await supabase
        .rpc('get_public_booking_profile', { p_short_code: shortCode });

      if (profileError) {
        console.warn('Failed to load profile:', profileError);
      }

      const profile = Array.isArray(profileRows) ? profileRows[0] : null;
      const fullAvatarUrl = profile?.avatar_url || null;

      return {
        ...bookingConfig,
        profiles: profile
          ? { ...profile, avatar_url: fullAvatarUrl }
          : { first_name: 'User', last_name: '', avatar_url: null },
      };
    },
    retry: false,
  });

  // Fetch event types for this booking config
  const { data: eventTypes = [], isLoading: isLoadingEventTypes } = useQuery({
    queryKey: ['public-event-types', config?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_event_types')
        .select('*')
        .eq('booking_config_id', config!.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!config?.id,
  });

  // Auto-select event type only if eventSlug is in URL (direct link)
  useEffect(() => {
    if (!eventTypes.length) return;
    if (selectedEventType) return;
    
    if (eventSlug) {
      const match = eventTypes.find((et: any) => et.slug === eventSlug);
      if (match) setSelectedEventType(match);
    }
    // No auto-select for single event type on general link — always show picker
  }, [eventTypes, eventSlug, selectedEventType]);

  // Determine if we need to show the event type picker
  const hasContextualLink = !!bookingContext || hasShortToken(searchParams);
  // Show picker on general link when event types exist and none selected
  const showEventPicker = !hasContextualLink && eventTypes.length > 0 && !selectedEventType;
  // Show empty state when no event types and no contextual link
  const showNoEventTypes = !hasContextualLink && !isLoadingEventTypes && eventTypes.length === 0;
  // Can go back to picker (came from picker, not from direct slug URL)
  const canGoBackToPicker = !hasContextualLink && !eventSlug && selectedEventType && eventTypes.length > 0;

  // Use event type's duration if selected, otherwise config default
  const activeDuration = selectedEventType?.duration_minutes || config?.duration_minutes || 30;

  // Build event type overrides for availability engine
  const eventTypeOverrides: EventTypeOverrides | undefined = useMemo(() => {
    if (!selectedEventType) return undefined;
    return {
      weekly_schedule: selectedEventType.weekly_schedule,
      buffer_time_minutes: selectedEventType.buffer_time_minutes,
      min_notice_hours: selectedEventType.min_notice_hours,
      max_days_ahead: selectedEventType.max_days_ahead,
      timezone: selectedEventType.timezone,
    };
  }, [selectedEventType]);

  // Fetch availability for the current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Gate availability: if event types exist for this config, wait until one is resolved
  // before fetching slots. Otherwise we'd display the parent config's wider schedule
  // and let candidates book outside the chosen event type's stricter rules.
  const isGroupBooking = !!(groupBookingConfigIds && groupBookingConfigIds.length > 1);
  const availabilityConfigId = isGroupBooking
    ? config?.id // any config works as the "primary" trigger; ids are passed via groupBookingConfigIds
    : ((eventTypes.length > 0 && !selectedEventType && !hasContextualLink) ? undefined : config?.id);

  const { data: availabilityData, isLoading: isLoadingAvailability } = useBookingAvailability(
    availabilityConfigId,
    monthStart,
    monthEnd,
    activeDuration,
    candidateTimezone,
    false,
    isGroupBooking ? undefined : eventTypeOverrides,
    isGroupBooking ? groupBookingConfigIds! : undefined,
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

  // Auto-select first available date (no auto-advance — user navigates manually)
  useEffect(() => {
    if (isLoadingAvailability) return;
    
    if (availableDates.length > 0) {
      if (!selectedDate || !isSameMonth(selectedDate, currentMonth)) {
        if (!hasAutoSelectedRef.current) {
          setSelectedDate(availableDates[0]);
          hasAutoSelectedRef.current = true;
        }
      }
    }
  }, [availableDates, isLoadingAvailability]);

  // Reset auto-select flag when user manually changes month
  const handleMonthChange = (newMonth: Date) => {
    setCurrentMonth(newMonth);
    hasAutoSelectedRef.current = false;
    autoAdvanceCountRef.current = 0;
  };

  // Filter time slots for selected date
  const timeSlotsForSelectedDate = useMemo(() => {
    if (!selectedDate || !availabilityData?.available_slots) return [];
    
    return availabilityData.available_slots.filter(slot => {
      const slotDate = parseISO(slot.start);
      return isSameDay(slotDate, selectedDate);
    });
  }, [selectedDate, availabilityData]);

  // Mobile date selection — auto-advance to time step
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    if (isMobile) {
      setMobileStep('time');
    }
  }, [isMobile]);

  // Mobile slot selection — auto-advance to confirm step
  const handleSlotSelect = useCallback((slot: { start: string; end: string }) => {
    setSelectedSlot(slot);
    if (isMobile) {
      setMobileStep('confirm');
    }
  }, [isMobile]);

  // Handler for quick schedule selection
  const handleQuickSelect = (slot: { start: string; end: string }) => {
    const slotDate = parseISO(slot.start);
    if (!isSameMonth(slotDate, currentMonth)) {
      setCurrentMonth(startOfMonth(slotDate));
    }
    setSelectedDate(slotDate);
    setSelectedSlot(slot);
    if (isMobile) {
      setMobileStep('confirm');
    }
  };

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
          ...(isGroupBooking && { booking_config_ids: groupBookingConfigIds }),
          candidate_name: formData.candidate_name,
          candidate_email: formData.candidate_email,
          candidate_phone: formData.candidate_phone || null,
          candidate_timezone: candidateTimezone,
          scheduled_start: selectedSlot.start,
          scheduled_end: selectedSlot.end,
          notes: formData.notes || null,
          // Pass event type data if selected (skip in group mode)
          ...(!isGroupBooking && selectedEventType && {
            event_type_id: selectedEventType.id,
            meeting_location: selectedEventType.meeting_location,
            custom_event_title: selectedEventType.custom_event_title,
          }),
          // Pass contextual booking context if available
          ...(bookingContext && {
            job_id: bookingContext.jobId,
            candidate_id: bookingContext.candidateId,
            job_hiring_stage_id: bookingContext.jhsId,
            job_candidate_association_id: bookingContext.associationId,
          }),
          // Pass reschedule booking ID if rescheduling
          ...(rescheduleBookingId && {
            reschedule_booking_id: rescheduleBookingId,
            reschedule_token: shortToken,
          }),
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      navigate(`/schedule/${shortCode}/confirmed/${data.booking_id}`, {
        state: {
          booking: {
            id: data.booking_id,
            scheduled_start: selectedSlot!.start,
            scheduled_end: selectedSlot!.end,
            duration_minutes: activeDuration,
            candidate_email: variables.candidate_email,
            candidate_name: variables.candidate_name,
            candidate_timezone: candidateTimezone,
            meeting_location: data.google_meet_link || config!.meeting_location || '',
          },
          config: {
            display_name: config!.display_name,
            description: config!.description,
          },
          interviewerName: config!.profiles
            ? `${config!.profiles.first_name} ${config!.profiles.last_name}`
            : config!.display_name,
        },
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Booking Failed',
        description: error.message || 'Failed to create booking. Please try again.',
      });
    },
  });

  // Handlers for existing booking view
  const handleReschedule = () => {
    if (existingBooking) {
      setRescheduleBookingId(existingBooking.id);
      // Try to restore the original event type for proper availability filtering
      if ((existingBooking as any).event_type_id && eventTypes.length > 0) {
        const match = eventTypes.find((et: any) => et.id === (existingBooking as any).event_type_id);
        if (match) setSelectedEventType(match);
      }
    }
  };

  const handleCancelled = () => {
    setExistingBooking(null);
    setBookingCancelled(true);
  };

  const interviewerFullName = config?.profiles
    ? `${config.profiles.first_name || ''} ${config.profiles.last_name || ''}`.trim()
    : config?.display_name || '';
  const workspaceName = config?.display_name || interviewerFullName || 'Scheduling';

  if (isLoading || isResolvingToken) {
    return (
      <div className="min-h-screen bg-[#FAF8F2]">
        <PublicBookingHeader workspaceName="Scheduling" />
        <main className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            <Skeleton className="h-[400px] w-full" />
            <div className="md:col-span-2">
              <Skeleton className="h-[600px] w-full" />
            </div>
          </div>
        </main>
        <PublicBookingFooter />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-[#FAF8F2] flex flex-col">
        <PublicBookingHeader workspaceName="Scheduling" />
        <main className="flex-1 container mx-auto px-4 py-16 max-w-lg">
          <EmptyState
            size="card"
            illustration={<SoftFlag />}
            title="Booking link not found"
            body="This booking link is either inactive or doesn't exist. Please check with the person who sent you this link."
          />
        </main>
        <PublicBookingFooter />
      </div>
    );
  }

  if (showExpiredView) {
    return (
      <div className="min-h-screen bg-[#FAF8F2] flex flex-col">
        <PublicBookingHeader workspaceName={workspaceName} />
        <main className="flex-1 container mx-auto px-4 py-16 max-w-lg">
          <EmptyState
            size="card"
            illustration={<SoftFlag />}
            title="This link has expired"
            body="This booking link is no longer active. If you need to schedule an interview, please contact the person who sent you this link."
          />
        </main>
        <PublicBookingFooter />
      </div>
    );
  }

  if (showExistingBookingView && existingBooking && shortToken) {
    return (
      <div className="min-h-screen bg-[#FAF8F2] flex flex-col">
        <PublicBookingHeader workspaceName={workspaceName} />
        <main className="flex-1 container mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12">
          {bookingContext?.candidateName && (
            <p className="font-poppins font-bold text-virgilio-text text-lg md:text-xl mb-2 text-center">
              Hi, {bookingContext.candidateName.split(' ')[0]}
              <span className="text-virgilio-purple">!</span> 👋
            </p>
          )}
          <h1 className="text-3xl md:text-4xl font-poppins font-bold text-virgilio-text mb-8 text-center tracking-[-0.02em]">
            Your Interview Details<span className="text-virgilio-purple">.</span>
          </h1>
          <ExistingBookingView
            booking={existingBooking}
            token={shortToken}
            onReschedule={handleReschedule}
            onCancelled={handleCancelled}
            jobTitle={bookingContext?.jobTitle}
            stageName={bookingContext?.stageName}
          />
        </main>
        <PublicBookingFooter />
      </div>
    );
  }

  const candidateFirst = bookingContext?.candidateName?.split(' ')[0];
  const isJobStage = !!bookingContext?.jobTitle;

  const heading = rescheduleBookingId
    ? `Reschedule your interview`
    : isJobStage
      ? `Hi ${candidateFirst || 'there'} — let's lock in your ${bookingContext?.stageName?.toLowerCase().replace(/·.*$/, '').trim() || 'interview'}`
      : `Let's find a time to talk`;

  const subtitle = isJobStage
    ? "Pick any time below — these are the slots where your whole panel is free. We'll send a calendar invite with the video link right away."
    : "Pick the kind of conversation you'd like, then choose a slot that works for you.";

  const topChip = isJobStage ? (
    <span className="inline-flex items-center gap-2 h-7 pl-2 pr-3 rounded-full bg-white border border-virgilio-border text-[12.5px] text-virgilio-muted">
      Scheduling for
      {bookingContext?.candidateName && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-5 w-5 rounded-full bg-virgilio-purple text-white text-[10px] font-poppins font-semibold inline-flex items-center justify-center">
            {bookingContext.candidateName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </span>
          <span className="font-poppins font-semibold text-virgilio-purple">{bookingContext.candidateName}</span>
        </span>
      )}
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white border border-virgilio-border text-[12.5px] text-virgilio-text">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Booking with <span className="font-poppins font-semibold">{interviewerFullName}</span>
    </span>
  );

  // Standalone event-type picker page (general booking link with multiple event types)
  if (showEventPicker) {
    return (
      <div className="min-h-screen bg-[#FAF8F2] flex flex-col">
        <PublicBookingHeader workspaceName={workspaceName} />
        <main className="flex-1 container mx-auto px-4 py-10 md:py-16">
          <EventTypePicker
            variant="standalone"
            eventTypes={eventTypes}
            selectedId={selectedEventType?.id}
            onSelect={(et) => setSelectedEventType(et)}
            interviewerName={interviewerFullName}
            interviewerFirstName={config?.profiles?.first_name || undefined}
            interviewerRole={config?.description || null}
            interviewerAvatarUrl={config?.profiles?.avatar_url || null}
            workspaceName={workspaceName}
            timezoneLabel={candidateTimezone}
          />
        </main>
        <PublicBookingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F2] flex flex-col">
      <PublicBookingHeader workspaceName={workspaceName} />

      <main className="flex-1 container mx-auto px-4 md:px-6 lg:px-8 py-10 md:py-14 max-w-[1280px]">
        {showNoEventTypes ? (
          <div className="max-w-lg mx-auto py-16">
            <EmptyState
              size="card"
              illustration={<SoftCalendar />}
              title="No availability"
              body="There are no booking options available at this time. Please check back later or contact the organizer."
            />
          </div>
        ) : (
          <>
            {canGoBackToPicker && selectedEventType && (
              <Button
                variant="ghost"
                size="sm"
                className="mb-4 text-virgilio-muted hover:text-virgilio-text -ml-2"
                onClick={() => {
                  setSelectedEventType(null);
                  setSelectedDate(null);
                  setSelectedSlot(null);
                  hasAutoSelectedRef.current = false;
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to options
              </Button>
            )}

            {/* Centered intro block */}
            <div className="flex flex-col items-center text-center mb-8 md:mb-10">
              <div className="mb-4">{topChip}</div>
              <h1 className="font-poppins font-bold text-virgilio-text text-3xl md:text-[44px] leading-[1.1] tracking-[-0.03em] max-w-3xl">
                {heading}<span className="text-virgilio-purple">.</span>
              </h1>
              <p className="text-virgilio-muted mt-3 max-w-2xl text-[14px] md:text-[15px]">
                {subtitle}
              </p>
            </div>

            {rescheduleBookingId && (
              <div className="mb-6 max-w-3xl mx-auto p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800">
                  Select a new date and time below. Your previous interview will be automatically cancelled when you confirm the new time.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-amber-700 hover:text-amber-900 p-0 h-auto"
                  onClick={() => {
                    setRescheduleBookingId(null);
                    if (existingBooking) {
                      setBookingCancelled(false);
                    }
                  }}
                >
                  ← Back to interview details
                </Button>
              </div>
            )}

            {/* Main panel */}
            <div className="rounded-3xl bg-white border border-virgilio-border shadow-[0_24px_60px_-30px_rgba(13,13,9,0.18)] overflow-hidden">
              {isMobile ? (
                /* Mobile: keep step flow but in single column */
                <div className="p-5 space-y-4">
                  {/* Step indicator */}
                  <div className="flex items-center gap-2 text-xs text-virgilio-muted">
                    <span className={mobileStep === 'date' ? 'text-virgilio-purple font-semibold' : ''}>Date</span>
                    <span>→</span>
                    <span className={mobileStep === 'time' ? 'text-virgilio-purple font-semibold' : ''}>Time</span>
                    <span>→</span>
                    <span className={mobileStep === 'confirm' ? 'text-virgilio-purple font-semibold' : ''}>Confirm</span>
                  </div>

                  {mobileStep === 'date' && (
                    <MonthCalendar
                      availableDates={availableDates}
                      selectedDate={selectedDate}
                      onDateSelect={handleDateSelect}
                      currentMonth={currentMonth}
                      onMonthChange={handleMonthChange}
                      noAvailabilityInMonth={!isLoadingAvailability && availableDates.length === 0}
                    />
                  )}

                  {mobileStep === 'time' && (
                    <div className="space-y-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-virgilio-muted hover:text-virgilio-text -ml-2 gap-1"
                        onClick={() => {
                          setMobileStep('date');
                          setSelectedDate(null);
                        }}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back to calendar
                      </Button>
                      <TimeSlotsList
                        selectedDate={selectedDate}
                        timeSlots={timeSlotsForSelectedDate}
                        selectedSlot={selectedSlot}
                        onSlotSelect={handleSlotSelect}
                        isLoading={isLoadingAvailability}
                      />
                    </div>
                  )}

                  {mobileStep === 'confirm' && selectedSlot && (
                    <div className="space-y-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-virgilio-muted hover:text-virgilio-text -ml-2 gap-1"
                        onClick={() => {
                          setMobileStep('time');
                          setSelectedSlot(null);
                        }}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back to times
                      </Button>
                      <BookingConfirmationForm
                        selectedSlot={selectedSlot}
                        candidateTimezone={candidateTimezone}
                        onCancel={() => {
                          setSelectedSlot(null);
                          setMobileStep('time');
                        }}
                        onConfirm={createBookingMutation.mutateAsync}
                        defaultCandidateName={bookingContext?.candidateName}
                        defaultCandidateEmail={bookingContext?.candidateEmail}
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* Desktop: 3-column grid */
                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px]">
                  {/* Left column */}
                  <div className="p-6 md:p-8 border-r border-virgilio-border">
                    {isJobStage ? (
                      <JobStageSummaryCard
                        stageName={bookingContext?.stageName}
                        jobTitle={bookingContext?.jobTitle}
                        durationMinutes={activeDuration}
                        description={config.description}
                        panelists={
                          isGroupBooking && groupInterviewerNames.length > 0
                            ? groupInterviewerNames.map((n) => ({ name: n }))
                            : interviewerFullName
                              ? [{ name: interviewerFullName }]
                              : []
                        }
                      />
                    ) : (
                      <div className="space-y-6">
                        {config.profiles && (
                          <InterviewerCard
                            profile={config.profiles}
                            config={{
                              display_name: config.display_name,
                              description: config.description,
                              duration_minutes: activeDuration,
                            }}
                          />
                        )}

                        {eventTypes.length > 0 && (
                          <>
                            <div className="h-px bg-virgilio-border" />
                            <EventTypePicker
                              eventTypes={eventTypes}
                              selectedId={selectedEventType?.id}
                              onSelect={(et) => setSelectedEventType(et)}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Middle column - Calendar */}
                  <div className="p-6 md:p-8 border-r border-virgilio-border">
                    {!availabilityConfigId ? (
                      <div className="text-center text-sm text-virgilio-muted py-16">
                        Choose a meeting type to see availability.
                      </div>
                    ) : (
                      <MonthCalendar
                        availableDates={availableDates}
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                        currentMonth={currentMonth}
                        onMonthChange={handleMonthChange}
                        noAvailabilityInMonth={!isLoadingAvailability && availableDates.length === 0}
                      />
                    )}
                  </div>

                  {/* Right column - Day header + slots / form */}
                  <div className="p-6 md:p-8">
                    {selectedSlot ? (
                      <BookingConfirmationForm
                        selectedSlot={selectedSlot}
                        candidateTimezone={candidateTimezone}
                        onCancel={() => setSelectedSlot(null)}
                        onConfirm={createBookingMutation.mutateAsync}
                        defaultCandidateName={bookingContext?.candidateName}
                        defaultCandidateEmail={bookingContext?.candidateEmail}
                      />
                    ) : (
                      <div className="space-y-4">
                        {selectedDate ? (
                          <div className="flex items-baseline justify-between">
                            <h4 className="font-poppins font-bold text-virgilio-text text-[16px] tracking-[-0.02em]">
                              {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                            </h4>
                            <span className="text-[11.5px] text-virgilio-muted">
                              {timeSlotsForSelectedDate.length} {timeSlotsForSelectedDate.length === 1 ? 'time' : 'times'}
                            </span>
                          </div>
                        ) : (
                          <h4 className="font-poppins font-bold text-virgilio-text text-[16px] tracking-[-0.02em]">
                            Pick a date
                          </h4>
                        )}

                        {/* Timezone select */}
                        <Select value={candidateTimezone} onValueChange={setCandidateTimezone}>
                          <SelectTrigger className="h-9 rounded-lg border-virgilio-border bg-white text-[12.5px]">
                            <Globe className="h-3.5 w-3.5 text-virgilio-muted mr-1.5" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COMMON_TIMEZONES.map((tz) => (
                              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {isGroupBooking && groupInterviewerNames.length > 0 && (
                          <div className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-virgilio-purple/10 text-virgilio-purple text-[12px] font-medium">
                            <Users className="h-3 w-3" />
                            All {groupInterviewerNames.length} panelists free
                          </div>
                        )}

                        <TimeSlotsList
                          selectedDate={selectedDate}
                          timeSlots={timeSlotsForSelectedDate}
                          selectedSlot={selectedSlot}
                          onSlotSelect={setSelectedSlot}
                          isLoading={isLoadingAvailability}
                          showHeader={false}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <PublicBookingFooter />
    </div>
  );
}

