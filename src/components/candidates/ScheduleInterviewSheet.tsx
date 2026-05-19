import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RemovableChip } from '@/components/ui/removable-chip';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  MapPin,
  Paperclip,
  Phone,
  Plus,
  Save,
  Send,
  Sparkles,
  Users,
  Video,
  X,
} from 'lucide-react';
import { startOfMonth, endOfMonth, isSameDay, parseISO, format } from 'date-fns';
import { useBookingAvailability } from '@/hooks/useBookingAvailability';
import { GuestEmailInput } from '@/components/scheduling/GuestEmailInput';
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form } from '@/components/ui/form';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  candidate_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  candidate_email: z.string().email('Invalid email address').max(255),
  candidate_phone: z.string().max(20).optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

type FormData = z.infer<typeof formSchema>;

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
  jhsId: string;
  stageName: string;
  associationId: string;
  oldBookingId?: string | null;
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

function SectionCard({
  label,
  rightSlot,
  children,
}: {
  label: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-form-label text-virgilio-muted">{label}</span>
        {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}
      </div>
      <div className="bg-white border border-virgilio-border rounded-2xl p-5 space-y-4">
        {children}
      </div>
    </section>
  );
}

function fullName(p: StageInterviewer): string {
  return `${p.profiles?.first_name || ''} ${p.profiles?.last_name || ''}`.trim() || 'Unknown';
}

function initials(p: StageInterviewer): string {
  const f = p.profiles?.first_name?.[0] || 'I';
  const l = p.profiles?.last_name?.[0] || '';
  return `${f}${l}`;
}

function busyBarsForPanelist(
  busy: { start: string; end: string }[],
  selectedDate: Date | null,
) {
  if (!selectedDate) return [];
  const dayStart = new Date(selectedDate);
  dayStart.setHours(9, 0, 0, 0);
  const dayEnd = new Date(selectedDate);
  dayEnd.setHours(17, 0, 0, 0);
  const span = dayEnd.getTime() - dayStart.getTime();

  return busy
    .map((b) => {
      const s = new Date(b.start);
      const e = new Date(b.end);
      if (!isSameDay(s, selectedDate)) return null;
      const clampedStart = Math.max(s.getTime(), dayStart.getTime());
      const clampedEnd = Math.min(e.getTime(), dayEnd.getTime());
      if (clampedEnd <= clampedStart) return null;
      const left = ((clampedStart - dayStart.getTime()) / span) * 100;
      const width = ((clampedEnd - clampedStart) / span) * 100;
      return { left, width, key: `${b.start}-${b.end}` };
    })
    .filter(Boolean) as { left: number; width: number; key: string }[];
}

function PanelistComboField({
  selected,
  available,
  unavailable,
  onSelect,
  onRemove,
  disabled,
}: {
  selected: StageInterviewer[];
  available: StageInterviewer[];
  unavailable: { name: string }[];
  onSelect: (p: StageInterviewer) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const selectedIds = new Set(selected.map((s) => s.id));
  const q = query.toLowerCase();
  const filteredAvailable = available.filter(
    (a) => !selectedIds.has(a.id) && fullName(a).toLowerCase().includes(q),
  );
  const filteredUnavailable = unavailable.filter((u) => u.name.toLowerCase().includes(q));

  const [editing, setEditing] = useState(false);

  const activate = () => {
    if (disabled) return;
    setEditing(true);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const deactivate = () => {
    setEditing(false);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open && editing && !disabled} onOpenChange={(o) => { if (!o) deactivate(); }}>
      <div role="group" className="flex flex-wrap items-center gap-1.5">
        {selected.map((p) => (
          <RemovableChip
            key={p.id}
            tone="purple"
            size="md"
            onRemove={() => onRemove(p.id)}
          >
            {fullName(p)}
          </RemovableChip>
        ))}
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="inline-flex">
            {editing ? (
              <div
                className={cn(
                  'inline-flex items-center h-7 px-3 rounded-full bg-white',
                  'border border-dashed border-virgilio-purple/50',
                  'focus-within:ring-2 focus-within:ring-virgilio-purple/30',
                )}
              >
                <input
                  ref={inputRef}
                  value={query}
                  disabled={disabled}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !query && selected.length > 0) {
                      onRemove(selected[selected.length - 1].id);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      deactivate();
                    }
                  }}
                  placeholder="Type a name…"
                  className="bg-transparent border-0 outline-none text-[12px] font-poppins font-medium text-virgilio-ink placeholder:text-virgilio-ink/50"
                  style={{ width: `${Math.max(140, query.length * 8 + 40)}px` }}
                />
              </div>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onPointerDown={(e) => {
                  e.preventDefault();
                  activate();
                }}
                className={cn(
                  'inline-flex items-center h-7 px-3 rounded-full',
                  'border border-dashed border-virgilio-border bg-transparent',
                  'text-[12px] font-poppins font-medium text-virgilio-ink/70',
                  'transition-colors',
                  'hover:border-virgilio-purple/50 hover:bg-[hsl(var(--badge-lilac))]/40 hover:text-virgilio-ink',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30',
                  disabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                + Add panelist
              </button>
            )}
          </div>
        </PopoverAnchor>
      </div>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[280px] p-[var(--menu-pad)]"
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onFocusOutside={(e) => {
          const t = e.target as Node | null;
          if (t && anchorRef.current?.contains(t)) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          const t = e.target as Node | null;
          if (t && anchorRef.current?.contains(t)) e.preventDefault();
        }}
      >
        <Command shouldFilter={false}>
          <CommandList className="max-h-[280px]">
            {filteredAvailable.length === 0 && filteredUnavailable.length === 0 && (
              <CommandEmpty>No teammates match.</CommandEmpty>
            )}
            {filteredAvailable.length > 0 && (
              <CommandGroup>
                {filteredAvailable.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => {
                      onSelect(p);
                      setQuery('');
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={p.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-[9px]">{initials(p)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{fullName(p)}</span>
                    <span className="text-[10.5px] text-virgilio-muted capitalize">
                      {p.assignment_type}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {filteredUnavailable.length > 0 && (
              <CommandGroup heading="No calendar connected">
                {filteredUnavailable.map((u) => (
                  <CommandItem key={u.name} value={u.name} disabled>
                    <span className="flex-1 truncate text-virgilio-muted">{u.name}</span>
                    <span className="text-[10.5px] text-virgilio-muted">No calendar</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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
  const isReschedule = !!oldBookingId;

  const [selectedInterviewer, setSelectedInterviewer] = useState<StageInterviewer | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [bufferMinutes, setBufferMinutes] = useState<number>(0);
  const [formatOption, setFormatOption] = useState<'video' | 'phone' | 'onsite'>('video');
  const [siteAddress, setSiteAddress] = useState('');
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [inviteSubject, setInviteSubject] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [includeScorecardPrompt, setIncludeScorecardPrompt] = useState(true);
  const [autoRecord, setAutoRecord] = useState(true);
  const [reminder24h, setReminder24h] = useState(true);

  const meetingType: 'google_meet' | 'custom' = formatOption === 'video' ? 'google_meet' : 'custom';
  const customLocation =
    formatOption === 'phone'
      ? "Phone — we'll dial out"
      : formatOption === 'onsite'
      ? siteAddress
      : '';
  const candidateTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data: stageMeta } = useQuery({
    queryKey: ['stage-meta', jhsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_hiring_stages')
        .select('id, interviewer_scheduling_mode')
        .eq('id', jhsId)
        .single();
      if (error) throw error;
      return data as { id: string; interviewer_scheduling_mode: 'any' | 'all' };
    },
    enabled: open && !!jhsId,
  });
  const schedulingMode: 'any' | 'all' =
    (stageMeta?.interviewer_scheduling_mode as 'any' | 'all') || 'any';
  const isGroupMode = schedulingMode === 'all';

  const { data: interviewers, isLoading: loadingInterviewers } = useQuery({
    queryKey: ['stage-interviewers', jhsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_interviewer_assignments')
        .select('id, member_id, assignment_type')
        .eq('job_hiring_stage_id', jhsId);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const memberIds = data.map((d) => d.member_id);
      const { data: members, error: memberError } = await supabase
        .from('members')
        .select('id, user_id')
        .in('id', memberIds);
      if (memberError) throw memberError;

      const userIds = members?.map((m) => m.user_id).filter(Boolean) || [];
      if (userIds.length === 0) return [];

      const { data: bookingConfigs, error: configError } = await supabase
        .from('booking_configurations')
        .select('*')
        .in('user_id', userIds);
      if (configError) throw configError;

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', userIds);
      if (profileError) throw profileError;

      return data.map((interviewer) => {
        const member = members?.find((m) => m.id === interviewer.member_id);
        const userId = member?.user_id;
        return {
          ...interviewer,
          member_user_id: userId,
          profiles: profiles?.find((p) => p.user_id === userId) || null,
          booking_configurations:
            bookingConfigs?.find((bc) => bc.user_id === userId) || null,
        };
      }) as StageInterviewer[];
    },
    enabled: open,
  });

  const availableInterviewers = useMemo(() => {
    if (!interviewers) return [];
    return interviewers
      .filter((i) => i.assignment_type !== 'backup' && i.booking_configurations?.is_active)
      .sort((a, b) => {
        const order = { required: 1, optional: 2, backup: 3, manual: 4 } as const;
        return order[a.assignment_type] - order[b.assignment_type];
      });
  }, [interviewers]);

  const interviewersWithoutBookingConfig = useMemo(() => {
    if (!interviewers) return [];
    return interviewers
      .filter((i) => i.assignment_type !== 'backup' && !i.booking_configurations?.is_active)
      .map((i) => ({
        name: fullName(i),
        hasConfig: !!i.booking_configurations,
        isActive: i.booking_configurations?.is_active || false,
      }));
  }, [interviewers]);

  const groupInterviewers = useMemo(
    () => (isGroupMode ? availableInterviewers : []),
    [isGroupMode, availableInterviewers],
  );
  const groupConfigIds = useMemo(
    () => groupInterviewers.map((i) => i.booking_configurations!.id).filter(Boolean),
    [groupInterviewers],
  );

  useEffect(() => {
    if (!isGroupMode && availableInterviewers.length === 1 && !selectedInterviewer) {
      setSelectedInterviewer(availableInterviewers[0]);
    }
  }, [availableInterviewers, selectedInterviewer, isGroupMode]);

  const displayedPanelists: StageInterviewer[] = useMemo(() => {
    if (isGroupMode) return groupInterviewers;
    return selectedInterviewer ? [selectedInterviewer] : [];
  }, [isGroupMode, groupInterviewers, selectedInterviewer]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const { data: availabilityData, isLoading: isLoadingAvailability } = useBookingAvailability(
    isGroupMode ? undefined : selectedInterviewer?.booking_configurations?.id,
    monthStart,
    monthEnd,
    selectedDuration,
    candidateTimezone,
    true,
    undefined,
    isGroupMode ? groupConfigIds : undefined,
  );

  const timeSlotsForSelectedDate = useMemo(() => {
    if (!selectedDate || !availabilityData?.available_slots) return [];
    return availabilityData.available_slots.filter((slot) =>
      isSameDay(parseISO(slot.start), selectedDate),
    );
  }, [selectedDate, availabilityData]);

  useEffect(() => {
    if (selectedDate && selectedDate.getMonth() !== currentMonth.getMonth()) {
      setCurrentMonth(startOfMonth(selectedDate));
    }
  }, [selectedDate]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      candidate_phone: candidatePhone || '',
      notes: '',
    },
  });

  const createBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const { data, error } = await supabase.functions.invoke('create-booking', {
        body: bookingData,
      });
      if (error) {
        let serverMessage = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) serverMessage = body.error;
        } catch (_) {}
        throw new Error(serverMessage);
      }
      return data;
    },
    onSuccess: async () => {
      const successName = isGroupMode
        ? displayedPanelists.map(fullName).join(', ')
        : selectedInterviewer?.profiles?.first_name || 'interviewer';
      toast({
        title: isReschedule ? 'Interview Rescheduled' : 'Interview Scheduled',
        description: `Interview scheduled with ${successName} for ${stageName}.`,
      });

      if (oldBookingId && selectedSlot) {
        try {
          const { error } = await supabase.functions.invoke('cancel-booking', {
            body: {
              booking_id: oldBookingId,
              reason: `Rescheduled to ${format(new Date(selectedSlot.start), 'MMM d, yyyy h:mm a')}`,
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
            description:
              'New interview scheduled, but failed to cancel previous one. Please cancel it manually.',
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['scheduled-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
      queryClient.invalidateQueries({ queryKey: ['stage-bookings', jhsId, candidateId] });

      setSelectedInterviewer(null);
      setSelectedDate(new Date());
      setSelectedSlot(null);
      setSelectedDuration(30);
      setFormatOption('video');
      setSiteAddress('');
      setGuestEmails([]);
      onOpenChange(false);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || '';
      const isConflict =
        errorMessage.includes('409') || errorMessage.includes('no longer available');
      toast({
        variant: 'destructive',
        title: 'Booking Failed',
        description: isConflict
          ? 'That time is already booked for this interviewer. Please choose another time.'
          : error.message || 'Failed to schedule interview. Please try again.',
      });
    },
  });

  const handleSubmit = form.handleSubmit(async (formData) => {
    if (!selectedSlot) {
      toast({
        variant: 'destructive',
        title: 'Pick a time',
        description: 'Choose a free slot before sending the invite.',
      });
      return;
    }
    if (isGroupMode) {
      if (groupConfigIds.length < 2) {
        toast({
          variant: 'destructive',
          title: 'Not enough panelists',
          description: 'Group scheduling needs at least 2 interviewers.',
        });
        return;
      }
    } else if (!selectedInterviewer?.booking_configurations) {
      toast({
        variant: 'destructive',
        title: 'Pick a panelist',
        description: 'Select an interviewer before sending the invite.',
      });
      return;
    }

    const primaryConfigId = isGroupMode
      ? groupConfigIds[0]
      : selectedInterviewer!.booking_configurations!.id;

    await createBookingMutation.mutateAsync({
      booking_config_id: primaryConfigId,
      ...(isGroupMode && { booking_config_ids: groupConfigIds }),
      candidate_name: formData.candidate_name,
      candidate_email: formData.candidate_email,
      candidate_phone: formData.candidate_phone || null,
      candidate_timezone: candidateTimezone,
      scheduled_start: selectedSlot.start,
      scheduled_end: new Date(
        new Date(selectedSlot.start).getTime() + selectedDuration * 60 * 1000,
      ).toISOString(),
      duration_minutes: selectedDuration,
      notes: inviteMessage || formData.notes || null,
      job_id: jobId,
      candidate_id: candidateId,
      job_candidate_association_id: associationId,
      job_hiring_stage_id: jhsId,
      booked_by_user_id: user?.id,
      send_invitation: true,
      meeting_type_preference: meetingType,
      custom_meeting_location: meetingType === 'custom' ? customLocation : null,
      guest_emails: guestEmails.length > 0 ? guestEmails : undefined,
    });
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedInterviewer(null);
      setSelectedDate(new Date());
      setSelectedSlot(null);
      setFormatOption('video');
      setSiteAddress('');
      setGuestEmails([]);
    }
    onOpenChange(newOpen);
  };

  const hasNoEmail = !candidateEmail;
  const andModeBlocked = isGroupMode && groupConfigIds.length < 2;

  const kicker = isReschedule ? `RESCHEDULE · ${stageName}` : `PIPELINE · ${stageName}`;
  const primaryLabel = isReschedule ? 'Send new invite' : 'Send invite';
  const titleText = isReschedule ? 'Reschedule interview' : 'Schedule interview';

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        <header className="px-6 pt-6 pb-4 border-b border-virgilio-border">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="text-[10.5px] font-inter font-semibold uppercase tracking-[0.08em] text-virgilio-purple truncate">
                {kicker}
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-h2 text-virgilio-text">{titleText}</h2>
                <Badge tone="lilac" size="sm">
                  <CheckCircle2 className="h-3 w-3" />
                  Calendar-aware
                </Badge>
              </div>
              <p className="text-body-sm text-virgilio-muted">
                We check everyone's calendar in real time and only show slots that work for the whole panel.
              </p>
            </div>
            <Button
              variant="ghost"
              iconOnly
              icon={X}
              aria-label="Close"
              onClick={() => handleOpenChange(false)}
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-[#FAFAF7]">
          {loadingInterviewers ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          ) : hasNoEmail ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This candidate doesn't have an email address. Please add an email before scheduling.
              </AlertDescription>
            </Alert>
          ) : andModeBlocked ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Group scheduling (AND-mode)</strong> requires at least 2 interviewers with
                active booking links.
                {interviewersWithoutBookingConfig.length > 0 && (
                  <>
                    {' '}
                    Configure availability for:{' '}
                    <strong>
                      {interviewersWithoutBookingConfig.map((i) => i.name).join(', ')}
                    </strong>
                    .
                  </>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form onSubmit={handleSubmit} className="space-y-6">
                <SectionCard label="WHAT & WHO">
                  <div className="flex items-center gap-3 pb-4 border-b border-virgilio-border/70">
                    <div className="h-9 w-9 rounded-lg bg-[hsl(var(--badge-lilac))] flex items-center justify-center shrink-0">
                      <Briefcase className="h-4 w-4 text-[hsl(var(--badge-lilac-foreground))]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-poppins font-medium text-virgilio-text truncate">
                        {stageName}
                      </div>
                      <div className="text-body-xs text-virgilio-muted truncate">
                        {jobTitle} · {selectedDuration}-min interview
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pb-4 border-b border-virgilio-border/70">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>
                          {candidateName
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-[13px] font-poppins font-medium text-virgilio-text truncate">
                          {candidateName}
                        </div>
                        <div className="text-body-xs text-virgilio-muted truncate">
                          {jobTitle} · {candidateTimezone.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                    <Badge tone="green" dot pulse size="sm">
                      Confirmed avail.
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-form-label text-virgilio-muted">
                      Interviewers <span className="text-destructive">*</span>
                    </Label>
                    {isGroupMode ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        {displayedPanelists.map((p) => (
                          <Badge key={p.id} tone="purple" size="md">
                            {fullName(p)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <PanelistComboField
                        selected={displayedPanelists}
                        available={availableInterviewers}
                        unavailable={interviewersWithoutBookingConfig}
                        onSelect={(p) => setSelectedInterviewer(p)}
                        onRemove={() => setSelectedInterviewer(null)}
                      />
                    )}
                    <p className="text-body-xs text-virgilio-muted">
                      Calendars sync from Google Workspace. Gio finds shared slots in real time.
                    </p>
                  </div>
                </SectionCard>


                <SectionCard
                  label="WHEN"
                  rightSlot={
                    <Badge tone="green" dot pulse size="sm">
                      Live check
                    </Badge>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-form-label text-virgilio-muted">Date</Label>
                      <DatePickerVirgilio
                        value={selectedDate || undefined}
                        onChange={(d) => {
                          setSelectedDate(d);
                          setSelectedSlot(null);
                        }}
                        minDate={new Date()}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-form-label text-virgilio-muted">Time zone</Label>
                      <Select value={candidateTimezone} onValueChange={() => {}}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={candidateTimezone}>
                            {candidateTimezone.replace(/_/g, ' ')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="bg-[#FAFAF7] rounded-xl p-4 space-y-3">
                    <div className="relative h-4 ml-[140px]">
                      {[9, 11, 13, 15, 17].map((h) => {
                        const left = ((h - 9) / 8) * 100;
                        return (
                          <span
                            key={h}
                            className="absolute -translate-x-1/2 text-[10px] font-inter text-virgilio-muted"
                            style={{ left: `${left}%` }}
                          >
                            {h > 12 ? `${h - 12}pm` : h === 12 ? '12pm' : `${h}am`}
                          </span>
                        );
                      })}
                    </div>

                    {displayedPanelists.map((p) => {
                      const bars = busyBarsForPanelist(
                        availabilityData?.busy_events || [],
                        selectedDate,
                      );
                      return (
                        <div key={p.id} className="flex items-center gap-3">
                          <div className="flex items-center gap-2 w-[140px] min-w-[140px]">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={p.profiles?.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {initials(p)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[12px] font-inter text-virgilio-text truncate">
                              {p.profiles?.first_name || 'Unknown'}
                            </span>
                          </div>
                          <div
                            className="relative h-6 flex-1 rounded-md bg-white border border-virgilio-border/60 overflow-hidden"
                            style={{
                              backgroundImage:
                                'repeating-linear-gradient(to right, transparent 0, transparent calc(12.5% - 1px), hsl(var(--border) / 0.5) calc(12.5% - 1px), hsl(var(--border) / 0.5) 12.5%)',
                            }}
                          >
                            {bars.map((b) => (
                              <div
                                key={b.key}
                                className="absolute top-0 bottom-0 bg-virgilio-muted/30 rounded-sm"
                                style={{ left: `${b.left}%`, width: `${b.width}%` }}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex items-center gap-3 pt-2 border-t border-virgilio-border/60">
                      <div className="flex items-center gap-2 w-[140px] min-w-[140px]">
                        <span className="text-[10.5px] font-inter font-semibold uppercase tracking-[0.08em] text-virgilio-purple">
                          FREE
                        </span>
                      </div>
                      <div
                        className="relative h-7 flex-1 rounded-md bg-white border border-virgilio-border/60 overflow-visible"
                        style={{
                          backgroundImage:
                            'repeating-linear-gradient(to right, transparent 0, transparent calc(12.5% - 1px), hsl(var(--border) / 0.5) calc(12.5% - 1px), hsl(var(--border) / 0.5) 12.5%)',
                        }}
                      >
                        {isLoadingAvailability ? (
                          <Skeleton className="absolute inset-0" />
                        ) : timeSlotsForSelectedDate.length === 0 ? (
                          <span className="absolute inset-0 flex items-center justify-center text-body-xs text-virgilio-muted">
                            No slots — try another day.
                          </span>
                        ) : (
                          timeSlotsForSelectedDate.map((slot) => {
                            const isSelected = selectedSlot?.start === slot.start;
                            const slotStart = parseISO(slot.start);
                            const hours = slotStart.getHours() + slotStart.getMinutes() / 60;
                            const left = Math.max(0, ((hours - 9) / 8) * 100);
                            const width = Math.min(
                              100 - left,
                              (selectedDuration / 60 / 8) * 100,
                            );
                            return (
                              <button
                                key={slot.start}
                                type="button"
                                onClick={() => setSelectedSlot(slot)}
                                title={`${format(slotStart, 'h:mm a')} – ${format(
                                  new Date(slotStart.getTime() + selectedDuration * 60000),
                                  'h:mm a',
                                )}`}
                                className={cn(
                                  'absolute top-0 bottom-0 rounded-md flex items-center justify-center text-[10.5px] font-poppins font-medium transition-all',
                                  isSelected
                                    ? 'bg-virgilio-purple text-white ring-2 ring-virgilio-ink z-10'
                                    : 'bg-[hsl(var(--badge-lilac))] hover:bg-pastel-purple text-[hsl(var(--badge-lilac-foreground))]',
                                )}
                                style={{ left: `${left}%`, width: `${width}%` }}
                              >
                                {isSelected ? format(slotStart, 'h:mm') : ''}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>


                  <p className="text-body-xs text-virgilio-muted">
                    Found {timeSlotsForSelectedDate.length} slot
                    {timeSlotsForSelectedDate.length === 1 ? '' : 's'} that work for everyone.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-virgilio-border/70">
                    <div className="space-y-1.5">
                      <Label className="text-form-label text-virgilio-muted">Duration</Label>
                      <div className="inline-flex items-center bg-[#FAFAF7] border border-virgilio-border rounded-lg p-0.5">
                        {[30, 45, 60, 90].map((d) => {
                          const active = selectedDuration === d;
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => {
                                setSelectedDuration(d);
                                setSelectedSlot(null);
                              }}
                              className={cn(
                                'h-7 px-3 rounded-md text-[12px] font-poppins font-medium transition-colors',
                                active
                                  ? 'bg-white text-virgilio-text shadow-sm'
                                  : 'text-virgilio-muted hover:text-virgilio-text',
                              )}
                            >
                              {d}m
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-form-label text-virgilio-muted">Buffer time</Label>
                      <Select
                        value={bufferMinutes.toString()}
                        onValueChange={(v) => setBufferMinutes(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">No buffer</SelectItem>
                          <SelectItem value="5">5 minutes</SelectItem>
                          <SelectItem value="10">10 minutes</SelectItem>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard label="LOCATION">
                  <div className="space-y-1.5">
                    <Label className="text-form-label text-virgilio-muted">
                      Format <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(
                        [
                          {
                            value: 'video' as const,
                            label: 'Video call',
                            sub: 'Google Meet · auto-generated',
                            Icon: Video,
                          },
                          {
                            value: 'phone' as const,
                            label: 'Phone',
                            sub: "We'll dial out",
                            Icon: Phone,
                          },
                          {
                            value: 'onsite' as const,
                            label: 'On-site',
                            sub: 'Address optional',
                            Icon: MapPin,
                          },
                        ]
                      ).map((opt) => {
                        const active = formatOption === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFormatOption(opt.value)}
                            className={cn(
                              'text-left rounded-xl border p-3.5 transition-all',
                              active
                                ? 'border-virgilio-purple ring-1 ring-virgilio-purple/30 bg-[hsl(var(--badge-lilac))]/40'
                                : 'border-virgilio-border bg-white hover:bg-[#FAFAF7]',
                            )}
                          >
                            <opt.Icon
                              className={cn(
                                'h-4 w-4 mb-2',
                                active ? 'text-virgilio-purple' : 'text-virgilio-muted',
                              )}
                            />
                            <div className="text-[13px] font-poppins font-medium text-virgilio-text">
                              {opt.label}
                            </div>
                            <div className="text-[12px] font-inter text-virgilio-muted mt-0.5">
                              {opt.sub}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {formatOption === 'onsite' && (
                    <div className="space-y-1.5">
                      <Label className="text-form-label text-virgilio-muted">Address</Label>
                      <Input
                        value={siteAddress}
                        onChange={(e) => setSiteAddress(e.target.value)}
                        placeholder="e.g. 228 Park Ave, NYC"
                      />
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  label="INVITATION"
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => {
                        toast({
                          title: 'Coming soon',
                          description: 'Gio will draft the invite for you.',
                        });
                      }}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-poppins font-medium text-virgilio-purple hover:bg-[hsl(var(--badge-lilac))]/60 transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Generate with Gio
                    </button>
                  }
                >
                  <div className="space-y-1.5">
                    <Label className="text-form-label text-virgilio-muted">
                      Subject <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={inviteSubject}
                      onChange={(e) => setInviteSubject(e.target.value)}
                      placeholder={`${stageName} — ${jobTitle}`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-form-label text-virgilio-muted">
                      Message <span className="text-virgilio-muted/70">(optional)</span>
                    </Label>
                    <Textarea
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                      placeholder={`Hi ${candidateName.split(' ')[0]},\n\nLooking forward to your ${stageName.toLowerCase()}…`}
                      className="resize-none min-h-[140px]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-form-label text-virgilio-muted">
                      Attachments <span className="text-virgilio-muted/70">(optional)</span>
                    </Label>
                    <div className="flex flex-wrap gap-2 items-center">
                      {attachments.map((file, idx) => (
                        <RemovableChip
                          key={`${file.name}-${idx}`}
                          tone="neutral"
                          size="sm"
                          onRemove={() =>
                            setAttachments((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          <Paperclip className="h-3 w-3" />
                          {file.name}
                        </RemovableChip>
                      ))}
                      <label className="inline-flex items-center gap-1 h-[26px] px-2.5 rounded-full border border-dashed border-virgilio-border text-[12px] font-inter font-medium text-virgilio-muted hover:text-virgilio-purple hover:border-virgilio-purple/50 transition-colors cursor-pointer">
                        <Plus className="h-3 w-3" />
                        Add file
                        <input
                          type="file"
                          multiple
                          className="sr-only"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length) setAttachments((prev) => [...prev, ...files]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-virgilio-border/70">
                    {(
                      [
                        {
                          id: 'scorecard',
                          label: 'Include scorecard prompt in invite',
                          help: 'Each panelist gets a link to fill out their scorecard right after.',
                          checked: includeScorecardPrompt,
                          onChange: setIncludeScorecardPrompt,
                        },
                        {
                          id: 'autorecord',
                          label: 'Auto-record with Gio note-taker',
                          help: 'Transcribes the meeting and drafts a summary.',
                          checked: autoRecord,
                          onChange: setAutoRecord,
                        },
                        {
                          id: 'reminder',
                          label: 'Reminder 24h before',
                          help: `Sends a friendly nudge to ${candidateName.split(' ')[0]} and the panel.`,
                          checked: reminder24h,
                          onChange: setReminder24h,
                        },
                      ]
                    ).map((row, idx, arr) => (
                      <div
                        key={row.id}
                        className={cn(
                          'flex items-start justify-between gap-4',
                          idx < arr.length - 1 && 'pb-3 border-b border-virgilio-border/60',
                        )}
                      >
                        <div className="min-w-0">
                          <Label
                            htmlFor={row.id}
                            className="text-[13px] font-poppins font-medium text-virgilio-text"
                          >
                            {row.label}
                          </Label>
                          <p className="text-body-xs text-virgilio-muted mt-0.5">{row.help}</p>
                        </div>
                        <Switch
                          id={row.id}
                          checked={row.checked}
                          onCheckedChange={row.onChange}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-virgilio-border/70">
                    <Label className="text-form-label text-virgilio-muted">
                      Cc additional guests
                    </Label>
                    <div className="mt-1.5">
                      <GuestEmailInput
                        emails={guestEmails}
                        onChange={setGuestEmails}
                        organizationId={organizationId}
                      />
                    </div>
                  </div>
                </SectionCard>

              </form>
            </Form>
          )}
        </div>

        <footer className="border-t border-virgilio-border bg-white px-6 py-3 flex items-center justify-between gap-3">
          <div className="text-body-xs text-virgilio-muted hidden sm:flex items-center gap-1.5 min-w-0">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {meetingType === 'google_meet'
                ? 'Sends a Google Meet invite to candidate + panelists'
                : 'Sends an invite with the custom location'}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="secondary" icon={Save} disabled title="Coming soon">
              Save as draft
            </Button>
            <Button
              onClick={handleSubmit}
              icon={Send}
              loading={createBookingMutation.isPending}
              disabled={
                hasNoEmail ||
                andModeBlocked ||
                !selectedSlot ||
                (!isGroupMode && !selectedInterviewer)
              }
            >
              {primaryLabel}
            </Button>
          </div>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
