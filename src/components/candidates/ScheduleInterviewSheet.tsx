import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
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
  Layers,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  Plus,
  Save,
  Send,
  Sparkles,
  UserPlus,
  Users,
  Video,
  CalendarX,
} from 'lucide-react';
import { startOfMonth, endOfMonth, parseISO, addDays } from 'date-fns';
import { useBookingAvailability } from '@/hooks/useBookingAvailability';
import { DayTimeGrid, type GridPanelist } from './DayTimeGrid';
import {
  clampStart,
  findOverlaps,
  holdsFor,
  minuteLabel,
  panelFreeWindows,
  rangeOnDay,
  shiftDayKey,
  zoneMinuteOfDay,
  zoneWallToUtc,
  type BusyInterval,
} from '@/lib/scheduleGrid';
import {
  dayKeyToLocalDate,
  detectTimeZone,
  formatInTimeZone,
  isValidTimeZone,
  zoneAbbr,
  localDayKey,
  zoneCityLabel,
  zoneDayKey,
} from '@/lib/timezoneFormat';
import { useCustomerMembers, type Member } from '@/hooks/useCustomerMembers';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio';
import { TimezonePicker } from '@/components/booking/TimezonePicker';
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
import { zodResolver } from '@/lib/zodResolver';
import * as z from 'zod';
import { Form } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented';
import { confirmDestructive } from '@/components/ui/confirm-dialog';

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
  onDeleted?: () => void;
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
    timezone?: string | null;
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


const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GuestComboField({
  emails,
  onChange,
  members,
  excludeEmails,
  max = 10,
}: {
  emails: string[];
  onChange: (emails: string[]) => void;
  members: Member[] | undefined;
  excludeEmails: string[];
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const memberByEmail = useMemo(() => {
    const map = new Map<string, Member>();
    members?.forEach((m) => {
      const e = m.profile?.email?.toLowerCase();
      if (e) map.set(e, m);
    });
    return map;
  }, [members]);

  const excludedSet = useMemo(() => {
    const s = new Set<string>();
    emails.forEach((e) => s.add(e.toLowerCase()));
    excludeEmails.forEach((e) => e && s.add(e.toLowerCase()));
    return s;
  }, [emails, excludeEmails]);

  const q = query.trim().toLowerCase();
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members
      .filter((m) => {
        const email = m.profile?.email?.toLowerCase() || '';
        if (!email || excludedSet.has(email)) return false;
        if (!q) return true;
        const first = m.profile?.first_name?.toLowerCase() || '';
        const last = m.profile?.last_name?.toLowerCase() || '';
        return (
          email.includes(q) ||
          first.includes(q) ||
          last.includes(q) ||
          `${first} ${last}`.includes(q)
        );
      })
      .slice(0, 8);
  }, [members, q, excludedSet]);

  const isValidEmail = q.length > 0 && EMAIL_REGEX.test(q);
  const queryMatchesMember = !!q && filteredMembers.some(
    (m) => (m.profile?.email || '').toLowerCase() === q,
  );
  const showExternalOption = isValidEmail && !queryMatchesMember && !excludedSet.has(q);
  const atCap = emails.length >= max;

  const addEmail = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) return;
    if (excludedSet.has(email)) return;
    if (emails.length >= max) return;
    onChange([...emails, email]);
    setQuery('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const removeEmail = (email: string) => {
    onChange(emails.filter((e) => e !== email));
  };

  const activate = () => {
    if (atCap) return;
    setEditing(true);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const deactivate = () => {
    setEditing(false);
    setOpen(false);
    setQuery('');
  };

  const guestLabel = (email: string) => {
    const m = memberByEmail.get(email.toLowerCase());
    if (!m?.profile) return null;
    const name = [m.profile.first_name, m.profile.last_name].filter(Boolean).join(' ');
    return name || null;
  };

  return (
    <TooltipProvider>
      <Popover open={open && editing && !atCap} onOpenChange={(o) => { if (!o) deactivate(); }}>
        <div role="group" className="flex flex-wrap items-center gap-1.5">
          {emails.map((email) => {
            const name = guestLabel(email);
            const isTeammate = !!name;
            return (
              <Tooltip key={email}>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <RemovableChip
                      tone={isTeammate ? 'purple' : 'neutral'}
                      size="md"
                      onRemove={() => removeEmail(email)}
                      icon={isTeammate ? undefined : Mail}
                    >
                      {name || email}
                    </RemovableChip>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isTeammate ? email : 'External guest'}
                </TooltipContent>
              </Tooltip>
            );
          })}
          <PopoverAnchor asChild>
            <div ref={anchorRef} className="inline-flex">
              {editing && !atCap ? (
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
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !query && emails.length > 0) {
                        removeEmail(emails[emails.length - 1]);
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredMembers.length > 0 && !showExternalOption) {
                          const email = filteredMembers[0].profile?.email;
                          if (email) addEmail(email);
                        } else if (showExternalOption) {
                          addEmail(q);
                        }
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        deactivate();
                      }
                    }}
                    placeholder="Name or email…"
                    className="bg-transparent border-0 outline-none text-[12px] font-poppins font-medium text-virgilio-ink placeholder:text-virgilio-ink/50"
                    style={{ width: `${Math.max(160, query.length * 8 + 40)}px` }}
                  />
                </div>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={atCap}
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
                        atCap && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      + Add guest
                    </button>
                  </TooltipTrigger>
                  {atCap && (
                    <TooltipContent side="top" className="text-xs">
                      Maximum {max} guests
                    </TooltipContent>
                  )}
                </Tooltip>
              )}
            </div>
          </PopoverAnchor>
        </div>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] min-w-[300px] p-[var(--menu-pad)]"
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
              {filteredMembers.length === 0 && !showExternalOption && (
                <CommandEmpty>
                  {q
                    ? isValidEmail
                      ? 'Already added.'
                      : 'Type a name or valid email.'
                    : 'Start typing to search teammates…'}
                </CommandEmpty>
              )}
              {filteredMembers.length > 0 && (
                <CommandGroup heading="Teammates">
                  {filteredMembers.map((m) => {
                    const email = m.profile?.email || '';
                    const first = m.profile?.first_name || '';
                    const last = m.profile?.last_name || '';
                    const name = [first, last].filter(Boolean).join(' ') || email;
                    const init = `${first[0] || '?'}${last[0] || ''}`.toUpperCase();
                    return (
                      <CommandItem
                        key={m.id}
                        value={email}
                        onSelect={() => addEmail(email)}
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={m.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-[9px]">{init}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">{name}</span>
                        <span className="text-[10.5px] text-virgilio-muted truncate">{email}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {showExternalOption && (
                <CommandGroup heading="External">
                  <CommandItem value={`__ext_${q}`} onSelect={() => addEmail(q)}>
                    <UserPlus className="h-3.5 w-3.5 text-virgilio-purple" />
                    <span className="flex-1 truncate">
                      Add <span className="font-medium">{q}</span> as external guest
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
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
  onDeleted,
}: ScheduleInterviewSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isReschedule = !!oldBookingId;
  const [isDeleting, setIsDeleting] = useState(false);


  const [selectedInterviewer, setSelectedInterviewer] = useState<StageInterviewer | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const durationSegRef = useSegmentLayer<HTMLDivElement>();
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

  const { data: tenantMembers } = useCustomerMembers(organizationId);

  const meetingType: 'google_meet' | 'custom' = formatOption === 'video' ? 'google_meet' : 'custom';
  const customLocation =
    formatOption === 'phone'
      ? "Phone — we'll dial out"
      : formatOption === 'onsite'
      ? siteAddress
      : '';
  // The zone the day grid, the summary and the invite use. Starts on yours.
  const [scheduleZone, setScheduleZone] = useState<string>(() => detectTimeZone());

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
        .select('user_id, first_name, last_name, avatar_url, timezone')
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

  const { data: hiringTeam } = useQuery({
    queryKey: ['job-hiring-team-for-scheduling', jobId],
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from('job_assignments')
        .select('user_id')
        .eq('job_id', jobId)
        .is('deleted_at', null);
      if (error) throw error;
      const userIds = Array.from(new Set((assignments || []).map((a) => a.user_id).filter(Boolean)));
      if (userIds.length === 0) return [] as StageInterviewer[];

      const [{ data: profiles }, { data: bookingConfigs }] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, first_name, last_name, avatar_url, timezone')
          .in('user_id', userIds),
        supabase.from('booking_configurations').select('*').in('user_id', userIds),
      ]);

      return userIds.map((uid) => ({
        id: `hiring-team-${uid}`,
        member_id: uid,
        assignment_type: 'manual' as const,
        member_user_id: uid,
        profiles: profiles?.find((p) => p.user_id === uid) || null,
        booking_configurations: bookingConfigs?.find((bc) => bc.user_id === uid) || null,
      })) as StageInterviewer[];
    },
    enabled: open && !!jobId,
  });

  const mergedInterviewers = useMemo(() => {
    const byUserId = new Map<string, StageInterviewer>();
    // Hiring team first (lowest priority assignment_type).
    (hiringTeam || []).forEach((i) => {
      if (i.member_user_id) byUserId.set(i.member_user_id, i);
    });
    // Stage assignments override (keep their assignment_type and id).
    (interviewers || []).forEach((i) => {
      if (i.member_user_id) byUserId.set(i.member_user_id, i);
    });
    return Array.from(byUserId.values());
  }, [interviewers, hiringTeam]);

  const availableInterviewers = useMemo(() => {
    return mergedInterviewers
      .filter((i) => i.assignment_type !== 'backup' && i.booking_configurations?.is_active)
      .sort((a, b) => {
        const order = { required: 1, optional: 2, manual: 3, backup: 4 } as const;
        const diff = order[a.assignment_type] - order[b.assignment_type];
        if (diff !== 0) return diff;
        return fullName(a).localeCompare(fullName(b));
      });
  }, [mergedInterviewers]);

  const interviewersWithoutBookingConfig = useMemo(() => {
    return mergedInterviewers
      .filter((i) => i.assignment_type !== 'backup' && !i.booking_configurations?.is_active)
      .map((i) => ({
        name: fullName(i),
        hasConfig: !!i.booking_configurations,
        isActive: i.booking_configurations?.is_active || false,
      }));
  }, [mergedInterviewers]);


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

  /* ---------- Reschedule: seed the sheet from the existing booking ---------- */
  const { data: oldBooking, isLoading: loadingOldBooking } = useQuery({
    queryKey: ['reschedule-source-booking', oldBookingId],
    enabled: open && !!oldBookingId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_bookings')
        .select(
          'id, interviewer_id, scheduled_start, scheduled_end, duration_minutes, meeting_type, meeting_location, notes, guest_emails, scheduled_booking_attendees(user_id)',
        )
        .eq('id', oldBookingId!)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        interviewer_id: string | null;
        scheduled_start: string;
        scheduled_end: string | null;
        duration_minutes: number | null;
        meeting_type: string | null;
        meeting_location: string | null;
        notes: string | null;
        guest_emails: string[] | null;
        scheduled_booking_attendees?: { user_id: string | null }[] | null;
      } | null;
    },
  });

  const prefilledFromRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      prefilledFromRef.current = null;
      return;
    }
    if (!oldBooking || prefilledFromRef.current === oldBooking.id) return;
    // Wait until interviewers are loaded so the panelist can be matched.
    if (!isGroupMode && availableInterviewers.length === 0) return;
    prefilledFromRef.current = oldBooking.id;

    const start = parseISO(oldBooking.scheduled_start);
    const duration =
      oldBooking.duration_minutes ||
      (oldBooking.scheduled_end
        ? Math.round(
            (parseISO(oldBooking.scheduled_end).getTime() - start.getTime()) / 60000,
          )
        : 30);

    if (!isGroupMode && oldBooking.interviewer_id) {
      const match = availableInterviewers.find(
        (i) => i.member_user_id === oldBooking.interviewer_id,
      );
      if (match) setSelectedInterviewer(match);
    }

    setSelectedDuration(duration);
    setSelectedDate(start);
    setCurrentMonth(startOfMonth(start));
    setSelectedSlot({
      start: start.toISOString(),
      end: new Date(start.getTime() + duration * 60 * 1000).toISOString(),
    });

    const loc = oldBooking.meeting_location || '';
    if (oldBooking.meeting_type === 'google_meet') {
      setFormatOption('video');
    } else if (/phone/i.test(loc)) {
      setFormatOption('phone');
    } else if (loc) {
      setFormatOption('onsite');
      setSiteAddress(loc);
    }

    if (oldBooking.guest_emails?.length) setGuestEmails(oldBooking.guest_emails);
    if (oldBooking.notes) setInviteMessage(oldBooking.notes);
  }, [open, oldBooking, isGroupMode, availableInterviewers]);


  const displayedPanelists: StageInterviewer[] = useMemo(() => {
    if (isGroupMode) return groupInterviewers;
    return selectedInterviewer ? [selectedInterviewer] : [];
  }, [isGroupMode, groupInterviewers, selectedInterviewer]);

  // A day before and after the month, so a far zone's day at the month's edge still has its holds.
  const monthStart = addDays(startOfMonth(currentMonth), -1);
  const monthEnd = addDays(endOfMonth(currentMonth), 1);
  const { data: availabilityData, isLoading: isLoadingAvailability } = useBookingAvailability(
    isGroupMode ? undefined : selectedInterviewer?.booking_configurations?.id,
    monthStart,
    monthEnd,
    selectedDuration,
    scheduleZone,
    true,
    undefined,
    isGroupMode ? groupConfigIds : undefined,
  );

  /* ---------- WHEN section: the day grid, in the chosen zone ---------- */
  // The day shown is the picked calendar date, read in the chosen zone.
  const dayKey = selectedDate ? localDayKey(selectedDate) : null;
  const todayKey = zoneDayKey(new Date(), scheduleZone);

  // The booking being rescheduled must not count as a conflict against itself.
  const busyEvents = useMemo(() => {
    const all = (availabilityData?.busy_events || []) as BusyInterval[];
    if (!oldBooking) return all;
    const originStart = parseISO(oldBooking.scheduled_start).getTime();
    return all.filter((b) => Math.abs(new Date(b.start).getTime() - originStart) > 60 * 1000);
  }, [availabilityData, oldBooking]);

  const browserZone = useMemo(() => detectTimeZone(), []);
  const gridPanelists: GridPanelist[] = useMemo(
    () =>
      displayedPanelists.map((p) => {
        const person = {
          id: p.id,
          userId: p.member_user_id ?? null,
          name: fullName(p),
          avatarUrl: p.profiles?.avatar_url,
          initials: initials(p),
          timeZone: isValidTimeZone(p.profiles?.timezone) ? p.profiles!.timezone! : browserZone,
          busy: [] as BusyInterval[],
        };
        return { ...person, busy: holdsFor(person, busyEvents) };
      }),
    [displayedPanelists, busyEvents, browserZone],
  );

  const originWindow = useMemo(() => {
    if (!oldBooking || !dayKey) return null;
    const start = parseISO(oldBooking.scheduled_start);
    const end = oldBooking.scheduled_end
      ? parseISO(oldBooking.scheduled_end)
      : new Date(start.getTime() + (oldBooking.duration_minutes || 30) * 60000);
    const r = rangeOnDay(start, end, dayKey, scheduleZone);
    return r ? { startMin: r.startMin, duration: r.endMin - r.startMin } : null;
  }, [oldBooking, dayKey, scheduleZone]);

  const panelFree = useMemo(
    () => panelFreeWindows(gridPanelists, dayKey, scheduleZone),
    [gridPanelists, dayKey, scheduleZone],
  );

  const selectedStartMin = useMemo(() => {
    if (!selectedSlot || !dayKey) return null;
    const d = parseISO(selectedSlot.start);
    if (zoneDayKey(d, scheduleZone) !== dayKey) return null;
    return zoneMinuteOfDay(d, scheduleZone);
  }, [selectedSlot, dayKey, scheduleZone]);

  const setSelectionFrom = (startMin: number, duration = selectedDuration, key = dayKey) => {
    if (!key) return;
    const start = zoneWallToUtc(key, clampStart(startMin, duration), scheduleZone);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    setSelectedSlot({ start: start.toISOString(), end: end.toISOString() });
  };

  const handleDurationChange = (d: number) => {
    setSelectedDuration(d);
    if (selectedStartMin !== null) setSelectionFrom(selectedStartMin, d);
  };

  // ‹ › on the grid: the next or previous day, keeping the time of day.
  const shiftDay = (days: number) => {
    if (!dayKey) return;
    const next = shiftDayKey(dayKey, days);
    if (next < todayKey) return;
    setSelectedDate(dayKeyToLocalDate(next));
    if (selectedStartMin !== null) setSelectionFrom(selectedStartMin, selectedDuration, next);
    else setSelectedSlot(null);
  };

  const overlaps = useMemo(() => {
    if (selectedStartMin === null) return [];
    return findOverlaps(
      gridPanelists,
      dayKey,
      scheduleZone,
      selectedStartMin,
      selectedStartMin + selectedDuration,
    );
  }, [gridPanelists, dayKey, scheduleZone, selectedStartMin, selectedDuration]);

  const overlapNote = overlaps.length
    ? `Overlaps ${overlaps.map((o) => `${o.name}'s ${o.title}`).join(' and ')}`
    : null;

  const jumpToFreeSlot = () => {
    const fits = panelFree.filter((w) => w.endMin - w.startMin >= selectedDuration);
    const after = fits.find((w) => selectedStartMin === null || w.startMin >= selectedStartMin);
    const fit = after ?? fits[0];
    if (fit) setSelectionFrom(fit.startMin);
  };

  const zoneTime = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    formatInTimeZone(iso, scheduleZone, opts);

  // A new zone relabels the grid; a time already picked stays the same moment.
  const handleZoneChange = (zone: string) => {
    if (selectedSlot) setSelectedDate(dayKeyToLocalDate(zoneDayKey(selectedSlot.start, zone)));
    setScheduleZone(zone);
  };

  // The picked time on the clocks of panelists who live in another zone.
  const elsewhere = useMemo(() => {
    if (!selectedSlot) return [];
    const seen = new Set<string>();
    return gridPanelists
      .filter((p) => p.timeZone !== scheduleZone)
      .map((p) => ({
        name: p.name.split(' ')[0],
        time: formatInTimeZone(selectedSlot.start, p.timeZone, { hour: 'numeric', minute: '2-digit' }),
      }))
      .filter((e) => (seen.has(e.name) ? false : (seen.add(e.name), true)));
  }, [selectedSlot, gridPanelists, scheduleZone]);

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

  // The sheet is mounted before it opens and outlives edits to the profile, so
  // the candidate's details come from the profile each time it opens (and if
  // they change while it's open). The sheet never edits them itself.
  useEffect(() => {
    if (!open) return;
    form.setValue('candidate_name', candidateName);
    form.setValue('candidate_email', candidateEmail.trim());
    form.setValue('candidate_phone', candidatePhone || '');
  }, [open, candidateName, candidateEmail, candidatePhone, form]);

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
              reason: `Rescheduled to ${zoneTime(selectedSlot.start, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`,
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
      setScheduleZone(detectTimeZone());
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
      candidate_timezone: scheduleZone,
      scheduled_start: selectedSlot.start,
      scheduled_end: new Date(
        new Date(selectedSlot.start).getTime() + selectedDuration * 60 * 1000,
      ).toISOString(),
      duration_minutes: selectedDuration,
      notes:
        [inviteMessage || formData.notes || '', overlapNote || '']
          .filter(Boolean)
          .join('\n\n') || null,
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
      setScheduleZone(detectTimeZone());
      setSelectedDuration(30);
      setFormatOption('video');
      setSiteAddress('');
      setGuestEmails([]);
      setInviteMessage('');
      prefilledFromRef.current = null;
    }

    onOpenChange(newOpen);
  };

  const hasNoEmail = !candidateEmail.trim();
  const emailInvalid = !hasNoEmail && !formSchema.shape.candidate_email.safeParse(candidateEmail.trim()).success;
  const andModeBlocked = isGroupMode && groupConfigIds.length < 2;

  const kicker = isReschedule ? `RESCHEDULE · ${stageName}` : `PIPELINE · ${stageName}`;
  const primaryLabel = isReschedule ? 'Send new invite' : 'Send invite';
  const titleText = isReschedule ? 'Reschedule interview' : 'Schedule interview';

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-[760px] p-0 flex flex-col">
        <header className="px-6 pt-6 pb-4 border-b border-virgilio-border">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="text-[10.5px] font-inter font-semibold uppercase tracking-[0.08em] text-virgilio-purple truncate">
                {kicker}
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <SheetTitle className="text-h2 text-virgilio-text">{titleText}</SheetTitle>
                <Badge tone="lilac" size="sm">
                  <CheckCircle2 className="h-3 w-3" />
                  Calendar-aware
                </Badge>
              </div>
              <p className="text-body-sm text-virgilio-muted">
                We check everyone's calendar in real time and only show slots that work for the whole panel.
              </p>
            </div>
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
          ) : emailInvalid ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This candidate's email, <span className="break-all font-medium">{candidateEmail}</span>, isn't a valid
                address, so the invite can't be sent. Correct it in their details, then schedule again.
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
                          {jobTitle} · {zoneCityLabel(scheduleZone)}
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
                      <TimezonePicker
                        value={scheduleZone}
                        onChange={handleZoneChange}
                        detected={browserZone}
                        className="h-[var(--input-height)] rounded-brand text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-form-label text-virgilio-muted">Pick a time</Label>
                    <DayTimeGrid
                      dayKey={dayKey}
                      timeZone={scheduleZone}
                      panelists={gridPanelists}
                      durationMinutes={selectedDuration}
                      selectedStartMin={selectedStartMin}
                      onSelectStartMin={(m) => setSelectionFrom(m)}
                      onDurationChange={handleDurationChange}
                      onShiftDay={shiftDay}
                      canGoBack={!!dayKey && dayKey > todayKey}
                      isLoading={isLoadingAvailability || loadingOldBooking}
                      originStartMin={originWindow?.startMin ?? null}
                      originDurationMinutes={originWindow?.duration ?? null}
                    />
                    {gridPanelists.length > 0 && !isLoadingAvailability && (
                      <p className="text-body-xs text-virgilio-muted">
                        {panelFree.length === 0
                          ? 'No time this day when the whole panel is free in their working hours.'
                          : `${panelFree.length} ${panelFree.length === 1 ? 'time' : 'times'} this day when the whole panel is free in their working hours.`}{' '}
                        You can still book any time, even over a busy time.
                      </p>
                    )}

                    {/* Overlap notice — informational only, never gates submit */}
                    <div
                      className="flex items-center gap-2 rounded-[9px] border"
                      style={{
                        padding: '9px 12px',
                        background: overlaps.length ? '#FFFBEB' : '#F6F2FF',
                        borderColor: overlaps.length ? '#FDE68A' : '#EDE4FF',
                      }}
                    >
                      {overlaps.length ? (
                        <Layers className="h-3.5 w-3.5 shrink-0" style={{ color: '#B45309' }} />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#6F3FF5' }} />
                      )}
                      <p
                        className="text-[11.5px] font-inter min-w-0 flex-1"
                        style={{ color: overlaps.length ? '#92400E' : '#5B2FD1' }}
                      >
                        {selectedSlot && dayKey && selectedStartMin !== null ? (
                          <>
                            <span className="font-semibold tabular-nums">
                              {minuteLabel(dayKey, selectedStartMin, scheduleZone)} –{' '}
                              {minuteLabel(dayKey, selectedStartMin + selectedDuration, scheduleZone)}{' '}
                              {zoneAbbr(scheduleZone, selectedSlot.start)}
                            </span>
                            {elsewhere.length > 0 && (
                              <span className="tabular-nums">
                                {' '}
                                · {elsewhere.map((e) => `${e.time} for ${e.name}`).join(', ')}
                              </span>
                            )}
                            {overlaps.length ? (
                              <>
                                {' '}
                                · overlaps{' '}
                                {overlaps.map((o) => `${o.name}'s ${o.title}`).join(' and ')}. You
                                can still book it — Gio flags the overlap in the invite.
                              </>
                            ) : (
                              <> · everyone on the panel is free.</>
                            )}
                          </>
                        ) : (
                          'Click the day grid to place the interview.'
                        )}
                      </p>
                      {overlaps.length > 0 && (
                        <button
                          type="button"
                          onClick={jumpToFreeSlot}
                          className="shrink-0 bg-white rounded-[7px] px-2 text-[11px] font-inter font-medium"
                          style={{ height: 24, border: '1px solid #FDE68A', color: '#92400E' }}
                        >
                          Use a free slot
                        </button>
                      )}
                    </div>
                  </div>


                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-virgilio-border/70">
                    <div className="space-y-1.5">
                      <Label className="text-form-label text-virgilio-muted">Duration</Label>
                      <div
                        ref={durationSegRef}
                        className="gio-seg flex items-center rounded-lg bg-[#ECEAE2]"
                        style={{ gap: 2, padding: 2 }}
                      >
                        {[15, 30, 45, 60, 90].map((d) => {
                          const active = selectedDuration === d;
                          return (
                            <button
                              key={d}
                              type="button"
                              data-seg-option
                              data-active={active || undefined}
                              onClick={() => handleDurationChange(d)}
                              style={{ flex: 1, minWidth: 0 }}
                              className={cn(
                                'h-7 rounded-md text-[12px] font-poppins transition-colors',
                                active
                                  ? 'bg-transparent font-semibold text-[#1F2230]'
                                  : 'bg-transparent font-medium text-[#5A6072] hover:text-[#1F2230]',
                              )}
                            >
                              {d}m
                            </button>
                          );
                        })}
                        <SegmentLayer fill="#fff" shadow="0 1px 2px rgba(13,13,9,.12)" />
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

                </SectionCard>

                <SectionCard
                  label="GUESTS"
                  rightSlot={
                    <span className="text-[11px] font-inter text-virgilio-muted tabular-nums">
                      {guestEmails.length}/10
                    </span>
                  }
                >
                  <div className="space-y-2">
                    <Label className="text-form-label text-virgilio-muted">
                      Cc'd guests <span className="text-virgilio-muted/70">(optional)</span>
                    </Label>
                    <GuestComboField
                      emails={guestEmails}
                      onChange={setGuestEmails}
                      members={tenantMembers}
                      excludeEmails={[candidateEmail]}
                    />
                    <p className="text-body-xs text-virgilio-muted">
                      Teammates appear with their name. External emails are added as-is and receive the calendar invite.
                    </p>
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
            {isReschedule && (
              <Button
                variant="ghost"
                icon={CalendarX}
                loading={isDeleting}
                onClick={async () => {
                  if (!oldBookingId) return;
                  // C12 (Block B §16, Pattern 1): this cancels the booking, as everywhere
                  // else; cancel-booking emails the candidate, the lead interviewer and
                  // any guests, and deletes the Google event the panel is on.
                  const name = candidateName.trim();
                  const first = name.split(/\s+/)[0] || 'The candidate';
                  const panel = new Set(
                    [oldBooking?.interviewer_id, ...(oldBooking?.scheduled_booking_attendees ?? []).map((a) => a.user_id)].filter(Boolean),
                  ).size;
                  const when = oldBooking?.scheduled_start
                    ? zoneTime(oldBooking.scheduled_start, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
                    : null;
                  const guests = oldBooking?.guest_emails?.length ? ' and the guests' : '';
                  const emailed = panel > 1
                    ? `${first}, the lead interviewer${guests} are emailed, and the event comes off Google Calendar for all ${panel} panelists.`
                    : `${first}, the interviewer${guests} are emailed, and the event comes off Google Calendar.`;
                  const ok = await confirmDestructive({
                    icon: CalendarX,
                    title: name ? `Cancel the interview with ${name}?` : 'Cancel this interview?',
                    description: `${stageName}${when ? `, ${when}` : ''}. ${emailed} ${first} stays in ${stageName}. This can\u2019t be undone.`,
                    confirmLabel: 'Cancel interview',
                    cancelLabel: 'Keep interview',
                  });
                  if (!ok) return;
                  setIsDeleting(true);
                  try {
                    const { error } = await supabase.functions.invoke('cancel-booking', {
                      body: { booking_id: oldBookingId, reason: 'Interview cancelled by recruiter' },
                    });
                    if (error) throw error;
                    toast({ title: 'Interview cancelled', description: 'Everyone on it has been told.' });
                    queryClient.invalidateQueries({ queryKey: ['scheduled-bookings'] });
                    queryClient.invalidateQueries({ queryKey: ['stage-bookings', jhsId, candidateId] });
                    onDeleted?.();
                    handleOpenChange(false);
                  } catch {
                    toast({ variant: 'destructive', title: 'Couldn\u2019t cancel the interview', description: 'It\u2019s still booked and nobody was emailed; try again.' });
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="text-[#DC2626] hover:bg-[#FEF2F2]"
              >
                Cancel interview
              </Button>
            )}

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
                emailInvalid ||
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
