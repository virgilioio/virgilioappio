import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Trash2 } from 'lucide-react';
import { WeeklyScheduleEditor } from './WeeklyScheduleEditor';
import { SchedulePresets } from './SchedulePresets';
import { TimezoneSelector } from './TimezoneSelector';
import { MeetingDurationSelector } from './MeetingDurationSelector';
import { BookingEventType } from '@/hooks/useBookingEventTypes';
import { WeeklySchedule, getDefaultWeeklySchedule } from '@/hooks/useBookingConfig';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const COLOR_OPTIONS = [
  '#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4',
];

interface EventTypeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventType: BookingEventType | null; // null = creating new
  onSave: (data: Partial<BookingEventType> & { title: string }) => void;
  onDelete?: (id: string) => void;
  isSaving: boolean;
  isDeleting?: boolean;
}

export function EventTypeSheet({
  open,
  onOpenChange,
  eventType,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: EventTypeSheetProps) {
  const isNew = !eventType;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#7c3aed');
  const [isActive, setIsActive] = useState(true);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(getDefaultWeeklySchedule());
  const [timezone, setTimezone] = useState('America/New_York');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [minNoticeHours, setMinNoticeHours] = useState(24);
  const [maxDaysAhead, setMaxDaysAhead] = useState(30);
  const [meetingLocation, setMeetingLocation] = useState('');
  const [customEventTitle, setCustomEventTitle] = useState('Interview with {candidate_name}');

  // Sync form when eventType changes
  useEffect(() => {
    if (eventType) {
      setTitle(eventType.title);
      setDescription(eventType.description || '');
      setColor(eventType.color || '#7c3aed');
      setIsActive(eventType.is_active);
      setWeeklySchedule(eventType.weekly_schedule || getDefaultWeeklySchedule());
      setTimezone(eventType.timezone || 'America/New_York');
      setDurationMinutes(eventType.duration_minutes || 30);
      setBufferMinutes(eventType.buffer_time_minutes || 15);
      setMinNoticeHours(eventType.min_notice_hours || 24);
      setMaxDaysAhead(eventType.max_days_ahead || 30);
      setMeetingLocation(eventType.meeting_location || '');
      setCustomEventTitle(eventType.custom_event_title || 'Interview with {candidate_name}');
    } else {
      // Reset for new
      setTitle('');
      setDescription('');
      setColor('#7c3aed');
      setIsActive(true);
      setWeeklySchedule(getDefaultWeeklySchedule());
      setTimezone('America/New_York');
      setDurationMinutes(30);
      setBufferMinutes(15);
      setMinNoticeHours(24);
      setMaxDaysAhead(30);
      setMeetingLocation('');
      setCustomEventTitle('Interview with {candidate_name}');
    }
  }, [eventType, open]);

  const handleSave = () => {
    if (!title.trim()) return;

    const data: any = {
      title: title.trim(),
      description: description.trim() || null,
      color,
      is_active: isActive,
      weekly_schedule: weeklySchedule,
      timezone,
      duration_minutes: durationMinutes,
      buffer_time_minutes: bufferMinutes,
      min_notice_hours: minNoticeHours,
      max_days_ahead: maxDaysAhead,
      meeting_location: meetingLocation || null,
      custom_event_title: customEventTitle || null,
    };

    if (eventType) {
      data.id = eventType.id;
    }

    onSave(data);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[540px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>{isNew ? 'Create Event Type' : 'Edit Event Type'}</SheetTitle>
          <SheetDescription>
            {isNew
              ? 'Set up a new event type for your booking link'
              : 'Update settings for this event type'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Title & Description */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-type-title">Event Title</Label>
              <Input
                id="event-type-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 30-Minute Chat"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-type-desc">Description (optional)</Label>
              <Textarea
                id="event-type-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Quick introductory call"
                rows={2}
              />
            </div>
          </div>

          {/* Color & Active */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      color === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="event-active">Active</Label>
              <Switch
                id="event-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <Separator />

          {/* Tabbed settings */}
          <Tabs defaultValue="weekly-hours" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="weekly-hours">Weekly Hours</TabsTrigger>
              <TabsTrigger value="meeting-details">Meeting</TabsTrigger>
              <TabsTrigger value="booking-rules">Rules</TabsTrigger>
            </TabsList>

            <TabsContent value="weekly-hours" className="space-y-6 mt-4">
              <SchedulePresets
                onSelectPreset={setWeeklySchedule}
                currentSchedule={weeklySchedule}
              />
              <Separator />
              <TimezoneSelector value={timezone} onChange={setTimezone} />
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-text-primary">Weekly Schedule</h3>
                <WeeklyScheduleEditor schedule={weeklySchedule} onChange={setWeeklySchedule} />
              </div>
            </TabsContent>

            <TabsContent value="meeting-details" className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="et-event-title">Calendar Event Title</Label>
                <Input
                  id="et-event-title"
                  value={customEventTitle}
                  onChange={(e) => setCustomEventTitle(e.target.value)}
                  placeholder="Interview with {candidate_name}"
                />
                <p className="text-xs text-text-secondary">
                  Use <code className="bg-muted px-1 rounded">{'{candidate_name}'}</code> to include their name.
                </p>
              </div>
              <Separator />
              <MeetingDurationSelector value={durationMinutes} onChange={setDurationMinutes} />
              <Separator />
              <div className="space-y-3">
                <Label>Buffer Time: {bufferMinutes} minutes</Label>
                <p className="text-xs text-text-secondary">Time between meetings</p>
                <Slider
                  value={[bufferMinutes]}
                  onValueChange={([v]) => setBufferMinutes(v)}
                  min={0}
                  max={60}
                  step={5}
                  className="w-full"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="et-location">Meeting Location (optional)</Label>
                <Input
                  id="et-location"
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  placeholder="e.g., Google Meet (auto-generated)"
                />
                <p className="text-xs text-text-secondary">Leave blank to auto-generate a Google Meet link</p>
              </div>
            </TabsContent>

            <TabsContent value="booking-rules" className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="et-notice">Minimum Notice (hours)</Label>
                <Input
                  id="et-notice"
                  type="number"
                  min="0"
                  value={minNoticeHours}
                  onChange={(e) => setMinNoticeHours(parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-text-secondary">How far in advance someone must book</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="et-max-days">Maximum Days Ahead</Label>
                <Input
                  id="et-max-days"
                  type="number"
                  min="1"
                  value={maxDaysAhead}
                  onChange={(e) => setMaxDaysAhead(parseInt(e.target.value) || 1)}
                />
                <p className="text-xs text-text-secondary">How far in the future people can book</p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            {!isNew && onDelete ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete event type?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove "{eventType?.title}". Candidates won't be able to book this event type anymore.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        onDelete(eventType!.id);
                        onOpenChange(false);
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!title.trim() || isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : isNew ? (
                  'Create'
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
