import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Calendar, Clock, MapPin, Globe } from 'lucide-react';
import googleMeetIcon from '@/assets/google-meet-icon.png';
import { startOfMonth, endOfMonth, isSameDay, parseISO, format } from 'date-fns';
import { useBookingAvailability } from '@/hooks/useBookingAvailability';
import { MonthCalendar } from '@/components/booking/MonthCalendar';
import { TimeSlotsList } from '@/components/booking/TimeSlotsList';
import { MeetingLocationSelector } from '@/components/scheduling/MeetingLocationSelector';
import { InterviewDurationSelector } from '@/components/scheduling/InterviewDurationSelector';
import { ManualInterviewerSelector, TeamInterviewer } from '@/components/scheduling/ManualInterviewerSelector';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GuestEmailInput } from '@/components/scheduling/GuestEmailInput';

const formSchema = z.object({
  candidate_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  candidate_email: z.string().email('Invalid email address').max(255),
  candidate_phone: z.string().max(20).optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

type FormData = z.infer<typeof formSchema>;

// Confirmation form for simple scheduling
function SimpleBookingConfirmationForm({
  selectedSlot,
  candidateTimezone,
  onCancel,
  onConfirm,
  candidateName,
  candidateEmail,
  candidatePhone,
  meetingType,
  customLocation,
  customEventTitle,
  onCustomEventTitleChange,
  guestEmails,
  onGuestEmailsChange,
}: {
  selectedSlot: { start: string; end: string };
  candidateTimezone: string;
  onCancel: () => void;
  onConfirm: (formData: FormData, sendInvitation: boolean) => Promise<void>;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  meetingType: 'google_meet' | 'custom';
  customLocation: string;
  customEventTitle: string;
  onCustomEventTitleChange: (value: string) => void;
  guestEmails: string[];
  onGuestEmailsChange: (emails: string[]) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendInvitation, setSendInvitation] = useState(true);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      candidate_phone: candidatePhone || '',
      notes: '',
    },
  });

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await onConfirm(data, sendInvitation);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Selected slot summary */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="font-semibold">
              {format(new Date(selectedSlot.start), 'EEEE, MMMM d, yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-primary" />
            <span>
              {format(new Date(selectedSlot.start), 'h:mm a')} - {format(new Date(selectedSlot.end), 'h:mm a')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4 text-primary" />
            <span className="text-text-secondary">{candidateTimezone.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {meetingType === 'google_meet' ? (
              <>
                <img src={googleMeetIcon} alt="Google Meet" className="h-4 w-auto object-contain" />
                <span>Google Meet</span>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 text-primary" />
                <span className="break-all">{customLocation}</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Send Invitation Toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
        <div className="flex-1">
          <Label htmlFor="send-invitation" className="text-sm font-medium">
            Send invitation to candidate
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            When disabled, the meeting will be scheduled but no email will be sent to the candidate
          </p>
        </div>
        <Switch
          id="send-invitation"
          checked={sendInvitation}
          onCheckedChange={setSendInvitation}
        />
      </div>

      {/* Form */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Confirm Details
          </h3>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Custom Event Title */}
              <div className="space-y-2">
                <Label htmlFor="custom-event-title">Meeting Title</Label>
                <Input 
                  id="custom-event-title"
                  placeholder="Interview with {candidate_name}" 
                  value={customEventTitle}
                  onChange={(e) => onCustomEventTitleChange(e.target.value)}
                />
                <p className="text-xs text-text-secondary">
                  Leave blank to use default. Use {'{candidate_name}'} to include their name.
                </p>
              </div>

              <FormField
                control={form.control}
                name="candidate_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="candidate_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="candidate_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+1 (555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any special instructions or notes..."
                        className="resize-none min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-text-secondary">
                      {field.value?.length || 0}/500
                    </p>
                  </FormItem>
                )}
              />

              <GuestEmailInput
                emails={guestEmails}
                onChange={onGuestEmailsChange}
              />

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Scheduling...' : 'Schedule Meeting'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

interface SimpleScheduleInterviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  organizationId: string;
}

export function SimpleScheduleInterviewSheet({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  candidateEmail,
  candidatePhone,
  organizationId,
}: SimpleScheduleInterviewSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedInterviewer, setSelectedInterviewer] = useState<TeamInterviewer | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [meetingType, setMeetingType] = useState<'google_meet' | 'custom'>('google_meet');
  const [customLocation, setCustomLocation] = useState('');
  const [customEventTitle, setCustomEventTitle] = useState('');
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const candidateTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Fetch availability for selected interviewer
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: availabilityData, isLoading: isLoadingAvailability } = useBookingAvailability(
    selectedInterviewer?.booking_configurations?.id,
    monthStart,
    monthEnd,
    selectedDuration,
    candidateTimezone,
    true // internal_scheduling = true
  );

  // Extract available dates
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

  // Handle form confirmation - simple booking without job context
  const handleConfirmBooking = async (formData: FormData, sendInvitation: boolean) => {
    if (!selectedSlot || !selectedInterviewer?.booking_configurations) {
      throw new Error('Missing required data');
    }

    const bookingData = {
      booking_config_id: selectedInterviewer.booking_configurations.id,
      candidate_name: formData.candidate_name,
      candidate_email: formData.candidate_email,
      candidate_phone: formData.candidate_phone || null,
      candidate_timezone: candidateTimezone,
      scheduled_start: selectedSlot.start,
      scheduled_end: new Date(new Date(selectedSlot.start).getTime() + selectedDuration * 60 * 1000).toISOString(),
      duration_minutes: selectedDuration,
      notes: formData.notes || null,
      // Simple booking - NO job/stage context
      candidate_id: candidateId,
      job_id: null,
      job_candidate_association_id: null,
      job_hiring_stage_id: null,
      booked_by_user_id: user?.id,
      send_invitation: sendInvitation,
      meeting_type_preference: meetingType,
      custom_meeting_location: meetingType === 'custom' ? customLocation : null,
      // Per-booking custom event title override
      custom_event_title: customEventTitle || null,
      guest_emails: guestEmails.length > 0 ? guestEmails : undefined,
    };

    await createBookingMutation.mutateAsync(bookingData);
  };

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const { data, error } = await supabase.functions.invoke('create-booking', {
        body: bookingData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Meeting Scheduled',
        description: `Meeting scheduled with ${selectedInterviewer?.profiles?.first_name || 'team member'}.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['candidate-activity'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-bookings'] });
      
      resetState();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Booking creation failed:', error);
      
      if (error.message?.includes('409') || error.message?.includes('conflict')) {
        toast({
          variant: 'destructive',
          title: 'Time Slot Unavailable',
          description: 'This time slot was just booked. Please select a different time.',
        });
        setSelectedSlot(null);
      } else {
        toast({
          variant: 'destructive',
          title: 'Scheduling Failed',
          description: error.message || 'Unable to schedule meeting. Please try again.',
        });
      }
    },
  });

  const resetState = () => {
    setSelectedInterviewer(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setCurrentMonth(new Date());
    setSelectedDuration(30);
    setMeetingType('google_meet');
    setCustomLocation('');
    setCustomEventTitle('');
    setGuestEmails([]);
  };

  const handleInterviewerSelect = (interviewer: TeamInterviewer) => {
    setSelectedInterviewer(interviewer);
    setSelectedDate(null);
    setSelectedSlot(null);
    // Use the interviewer's default duration if available
    if (interviewer.booking_configurations?.duration_minutes) {
      setSelectedDuration(interviewer.booking_configurations.duration_minutes);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (selectedSlot) {
      setSelectedSlot(null);
    } else if (selectedDate) {
      setSelectedDate(null);
    } else if (selectedInterviewer) {
      setSelectedInterviewer(null);
    }
  };

  // Check if candidate has email
  const hasEmail = Boolean(candidateEmail);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState();
      onOpenChange(isOpen);
    }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-6">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Calendar className="h-5 w-5 text-primary" />
            Schedule Meeting
          </SheetTitle>
          <p className="text-sm text-text-secondary">
            Schedule a meeting with {candidateName}
          </p>
        </SheetHeader>

        <div className="space-y-6">
          {/* Email requirement check */}
          {!hasEmail && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This candidate doesn't have an email address. Please add an email before scheduling a meeting.
              </AlertDescription>
            </Alert>
          )}

          {hasEmail && (
            <>
              {/* Step 1: Select Interviewer */}
              {!selectedInterviewer && (
                <ManualInterviewerSelector
                  jobId=""
                  organizationId={organizationId}
                  onSelect={handleInterviewerSelect}
                />
              )}

              {/* Step 2: Select Date & Time */}
              {selectedInterviewer && !selectedSlot && (
                <div className="space-y-4">
                  <Button variant="ghost" size="sm" onClick={handleBack}>
                    ← Back to interviewers
                  </Button>
                  
                  <div className="flex items-center gap-3 p-4 bg-secondary/30 rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedInterviewer.profiles?.avatar_url || undefined} />
                      <AvatarFallback>
                        {selectedInterviewer.profiles?.first_name?.[0] || 'I'}
                        {selectedInterviewer.profiles?.last_name?.[0] || ''}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {selectedInterviewer.profiles?.first_name || 'Unknown'}{' '}
                        {selectedInterviewer.profiles?.last_name || ''}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <Clock className="h-3 w-3" />
                        {selectedInterviewer.booking_configurations?.duration_minutes} minutes
                      </div>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold">Select Date & Time</h3>

                  <Card>
                    <CardContent className="p-6">
                      <InterviewDurationSelector
                        value={selectedDuration}
                        onChange={(duration) => {
                          setSelectedDuration(duration);
                          setSelectedDate(null);
                          setSelectedSlot(null);
                        }}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <MeetingLocationSelector
                        meetingType={meetingType}
                        onMeetingTypeChange={setMeetingType}
                        customLocation={customLocation}
                        onCustomLocationChange={setCustomLocation}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <MonthCalendar
                        availableDates={availableDates}
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                        currentMonth={currentMonth}
                        onMonthChange={setCurrentMonth}
                      />
                    </CardContent>
                  </Card>

                  <Card>
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
                </div>
              )}

              {/* Step 3: Confirmation Form */}
              {selectedSlot && selectedInterviewer && (
                <div className="space-y-4">
                  <Button variant="ghost" size="sm" onClick={handleBack}>
                    ← Back to time selection
                  </Button>

                  {/* Selected interviewer info */}
                  <div className="flex items-center gap-3 p-4 bg-secondary/30 rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedInterviewer.profiles?.avatar_url || undefined} />
                      <AvatarFallback>
                        {selectedInterviewer.profiles?.first_name?.[0] || 'I'}
                        {selectedInterviewer.profiles?.last_name?.[0] || ''}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        Meeting with {selectedInterviewer.profiles?.first_name || 'Unknown'}{' '}
                        {selectedInterviewer.profiles?.last_name || ''}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <Clock className="h-3 w-3" />
                        {selectedDuration} minutes
                      </div>
                    </div>
                  </div>

                  <SimpleBookingConfirmationForm
                    selectedSlot={selectedSlot}
                    candidateTimezone={candidateTimezone}
                    onCancel={handleBack}
                    onConfirm={handleConfirmBooking}
                    candidateName={candidateName}
                    candidateEmail={candidateEmail}
                    candidatePhone={candidatePhone}
                    meetingType={meetingType}
                    customLocation={customLocation}
                    customEventTitle={customEventTitle}
                    onCustomEventTitleChange={setCustomEventTitle}
                    guestEmails={guestEmails}
                    onGuestEmailsChange={setGuestEmails}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
