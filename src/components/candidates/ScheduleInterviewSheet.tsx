import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Calendar, CheckCircle2, Clock, User, MapPin } from 'lucide-react';
import googleMeetIcon from '@/assets/google-meet-icon.png';
import { startOfMonth, endOfMonth, isSameDay, parseISO } from 'date-fns';
import { useBookingAvailability } from '@/hooks/useBookingAvailability';
import { MonthCalendar } from '@/components/booking/MonthCalendar';
import { TimeSlotsList } from '@/components/booking/TimeSlotsList';
import { MeetingLocationSelector } from '@/components/scheduling/MeetingLocationSelector';
import { InterviewDurationSelector } from '@/components/scheduling/InterviewDurationSelector';
import { ManualInterviewerSelector } from '@/components/scheduling/ManualInterviewerSelector';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Globe } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GuestEmailInput } from '@/components/scheduling/GuestEmailInput';

const formSchema = z.object({
  candidate_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  candidate_email: z.string().email('Invalid email address').max(255),
  candidate_phone: z.string().max(20).optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

type FormData = z.infer<typeof formSchema>;

// Internal confirmation form with pre-filled data
function InternalBookingConfirmationForm({
  selectedSlot,
  candidateTimezone,
  onCancel,
  onConfirm,
  candidateName,
  candidateEmail,
  candidatePhone,
  meetingType,
  customLocation,
  guestEmails,
  onGuestEmailsChange,
}: {
  selectedSlot: { start: string; end: string };
  candidateTimezone: string;
  onCancel: () => void;
  onConfirm: (formData: FormData, sendInvitation: boolean) => Promise<void>;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  meetingType: 'google_meet' | 'custom';
  customLocation: string;
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
      candidate_phone: candidatePhone,
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
            When disabled, the interview will be scheduled but no email will be sent to the candidate
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
                  {isSubmitting ? 'Scheduling...' : 'Schedule Interview'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

interface ScheduleInterviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  jobId: string;
  jobTitle: string;
  organizationId: string;
  jhsId: string; // job_hiring_stage_id
  stageName: string;
  associationId: string; // job_candidate_association_id
  oldBookingId?: string | null; // booking to cancel after reschedule
}

interface StageInterviewer {
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

export function ScheduleInterviewSheet({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  candidateEmail,
  candidatePhone,
  jobId,
  jobTitle,
  organizationId,
  jhsId,
  stageName,
  associationId,
  oldBookingId,
}: ScheduleInterviewSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedInterviewer, setSelectedInterviewer] = useState<StageInterviewer | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [meetingType, setMeetingType] = useState<'google_meet' | 'custom'>('google_meet');
  const [customLocation, setCustomLocation] = useState('');
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const candidateTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Fetch stage interviewer assignments
  const { data: interviewers, isLoading: loadingInterviewers } = useQuery({
    queryKey: ['stage-interviewers', jhsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_interviewer_assignments')
        .select('id, member_id, assignment_type')
        .eq('job_hiring_stage_id', jhsId);

      if (error) throw error;
      
      if (!data || data.length === 0) return [];
      
      // Get member details including user_id
      const memberIds = data.map(d => d.member_id);
      const { data: members, error: memberError } = await supabase
        .from('members')
        .select('id, user_id')
        .in('id', memberIds);
      
      if (memberError) throw memberError;
      
      // Get user IDs to fetch booking configs and profiles
      const userIds = members?.map(m => m.user_id).filter(Boolean) || [];
      if (userIds.length === 0) return [];
      
      // Fetch ALL booking configurations (not just active) so we can show proper messaging
      const { data: bookingConfigs, error: configError } = await supabase
        .from('booking_configurations')
        .select('*')
        .in('user_id', userIds);
      
      if (configError) throw configError;
      
      // Fetch profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', userIds);
      
      if (profileError) throw profileError;
      
      // Match everything up
      return data.map(interviewer => {
        const member = members?.find(m => m.id === interviewer.member_id);
        const userId = member?.user_id;
        return {
          ...interviewer,
          member_user_id: userId,
          profiles: profiles?.find(p => p.user_id === userId) || null,
          booking_configurations: bookingConfigs?.find(bc => bc.user_id === userId) || null,
        };
      }) as StageInterviewer[];
    },
    enabled: open,
  });

  // Filter and sort interviewers: required first, then optional, exclude backup
  const availableInterviewers = useMemo(() => {
    if (!interviewers) return [];
    
    return interviewers
      .filter(i => i.assignment_type !== 'backup' && i.booking_configurations?.is_active)
      .sort((a, b) => {
        const order = { required: 1, optional: 2, backup: 3 };
        return order[a.assignment_type] - order[b.assignment_type];
      });
  }, [interviewers]);

  // Get interviewers without active booking configs (for messaging)
  const interviewersWithoutBookingConfig = useMemo(() => {
    if (!interviewers) return [];
    
    return interviewers
      .filter(i => i.assignment_type !== 'backup' && !i.booking_configurations?.is_active)
      .map(i => ({
        name: `${i.profiles?.first_name || ''} ${i.profiles?.last_name || ''}`.trim() || 'Unknown',
        hasConfig: !!i.booking_configurations,
        isActive: i.booking_configurations?.is_active || false,
      }));
  }, [interviewers]);

  // Auto-select if only one interviewer
  useMemo(() => {
    if (availableInterviewers.length === 1 && !selectedInterviewer) {
      setSelectedInterviewer(availableInterviewers[0]);
    }
  }, [availableInterviewers, selectedInterviewer]);

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

  // Handle form confirmation
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
      // Internal booking context
      job_id: jobId,
      candidate_id: candidateId,
      job_candidate_association_id: associationId,
      job_hiring_stage_id: jhsId,
      booked_by_user_id: user?.id,
      send_invitation: sendInvitation,
      meeting_type_preference: meetingType,
      custom_meeting_location: meetingType === 'custom' ? customLocation : null,
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
    onSuccess: async () => {
      toast({
        title: 'Interview Scheduled',
        description: `Interview scheduled with ${selectedInterviewer?.profiles?.first_name || 'interviewer'} for ${stageName}.`,
      });
      
      // If this was a reschedule, cancel the old booking now
      if (oldBookingId && selectedSlot) {
        try {
          const { error } = await supabase.functions.invoke('cancel-booking', {
            body: { 
              booking_id: oldBookingId, 
              reason: `Rescheduled to ${format(selectedSlot.start, 'MMM d, yyyy h:mm a')}` 
            },
          });
          
          if (error) throw error;
          toast({
            title: 'Previous Interview Cancelled',
            description: 'The old interview time has been cancelled.',
          });
        } catch (error: any) {
          console.error('Failed to cancel old booking:', error);
          toast({
            variant: 'destructive',
            title: 'Warning',
            description: 'New interview scheduled, but failed to cancel previous one. Please cancel it manually.',
          });
        }
      }
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['scheduled-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
      queryClient.invalidateQueries({ 
        queryKey: ['stage-bookings', jhsId, candidateId] 
      });
      
      // Reset state and close
      setSelectedInterviewer(null);
      setSelectedDate(null);
      setSelectedSlot(null);
      setSelectedDuration(30);
      setMeetingType('google_meet');
      setCustomLocation('');
      setGuestEmails([]);
      onOpenChange(false);
    },
    onError: (error: any) => {
      // Check if it's a 409 conflict from create-booking
      const errorMessage = error?.message || '';
      const isConflict = errorMessage.includes('409') || errorMessage.includes('no longer available');
      
      toast({
        variant: 'destructive',
        title: 'Booking Failed',
        description: isConflict 
          ? 'That time is already booked for this interviewer. Please choose another time.'
          : error.message || 'Failed to schedule interview. Please try again.',
      });
    },
  });

  // Handle back navigation
  const handleBack = () => {
    if (selectedSlot) {
      setSelectedSlot(null);
    } else if (selectedDate) {
      setSelectedDate(null);
    } else if (selectedInterviewer && availableInterviewers.length > 1) {
      setSelectedInterviewer(null);
    }
  };

  // Reset state when sheet closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedInterviewer(null);
      setSelectedDate(null);
      setSelectedSlot(null);
      setMeetingType('google_meet');
      setCustomLocation('');
      setGuestEmails([]);
    }
    onOpenChange(newOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Interview
          </SheetTitle>
          <div className="text-sm text-text-secondary mt-2">
            <div className="flex flex-col gap-1">
              <div><strong>Candidate:</strong> {candidateName}</div>
              <div><strong>Job:</strong> {jobTitle}</div>
              <div><strong>Stage:</strong> {stageName}</div>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {loadingInterviewers ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !selectedInterviewer && (!availableInterviewers || availableInterviewers.length === 0) ? (
          <ManualInterviewerSelector
              jobId={jobId}
              organizationId={organizationId}
              onSelect={setSelectedInterviewer}
              unavailableInterviewers={interviewersWithoutBookingConfig}
            />
          ) : !candidateEmail ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This candidate doesn't have an email address. Please add an email before scheduling.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Step 1: Select Interviewer (if multiple) */}
              {!selectedInterviewer && availableInterviewers.length > 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Select Interviewer</h3>
                  <div className="space-y-3">
                    {availableInterviewers.map((interviewer) => (
                      <Card
                        key={interviewer.id}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => setSelectedInterviewer(interviewer)}
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
                            <Badge variant={interviewer.assignment_type === 'required' ? 'default' : 'secondary'}>
                              {interviewer.assignment_type}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Select Date & Time */}
              {selectedInterviewer && !selectedSlot && (
                <div className="space-y-4">
                  {availableInterviewers.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={handleBack}>
                      ← Back to interviewers
                    </Button>
                  )}
                  
                  <div className="flex items-center gap-3 p-4 bg-secondary/30 rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedInterviewer.profiles?.avatar_url || undefined} />
                      <AvatarFallback>
                        {selectedInterviewer.profiles?.first_name?.[0] || 'I'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {selectedInterviewer.profiles?.first_name}{' '}
                        {selectedInterviewer.profiles?.last_name}
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
                        onChange={setSelectedDuration}
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
              {selectedSlot && (
                <div className="space-y-4">
                  <Button variant="ghost" size="sm" onClick={handleBack}>
                    ← Back to time selection
                  </Button>
                  
                  <InternalBookingConfirmationForm
                    selectedSlot={selectedSlot}
                    candidateTimezone={candidateTimezone}
                    onCancel={handleBack}
                    onConfirm={handleConfirmBooking}
                    candidateName={candidateName}
                    candidateEmail={candidateEmail}
                    candidatePhone={candidatePhone || ''}
                    meetingType={meetingType}
                    customLocation={customLocation}
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
