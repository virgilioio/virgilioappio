import { useState, useEffect, useRef } from 'react';
import { Copy, ExternalLink, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useBookingConfig, getDefaultWeeklySchedule, WeeklySchedule } from '@/hooks/useBookingConfig';
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities';
import { WeeklyScheduleEditor } from './booking/WeeklyScheduleEditor';
import { SchedulePresets } from './booking/SchedulePresets';
import { TimezoneSelector } from './booking/TimezoneSelector';
import { MeetingDurationSelector } from './booking/MeetingDurationSelector';
import { toast } from 'sonner';

export function BookingLinkSection() {
  const { 
    config, 
    isLoading, 
    updateConfig, 
    isUpdating, 
    bookingUrl,
    needsProfileCompletion,
    isCreating
  } = useBookingConfig();
  const { identities } = useCalendarIdentities();
  const [copied, setCopied] = useState(false);

  // Local state for form
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(getDefaultWeeklySchedule());
  const [timezone, setTimezone] = useState('America/New_York');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [minNoticeHours, setMinNoticeHours] = useState(24);
  const [maxDaysAhead, setMaxDaysAhead] = useState(30);
  const [meetingLocation, setMeetingLocation] = useState('');
  const [customEventTitle, setCustomEventTitle] = useState('Interview with {candidate_name}');
  // Track if we've done initial sync to prevent resetting after saves
  const hasInitializedRef = useRef(false);

  // Sync form state with config ONLY on initial load
  useEffect(() => {
    if (config && !hasInitializedRef.current) {
      setWeeklySchedule(config.weekly_schedule || getDefaultWeeklySchedule());
      setTimezone(config.timezone || 'America/New_York');
      setDurationMinutes(config.duration_minutes || 30);
      setBufferMinutes(config.buffer_time_minutes || 15);
      setMinNoticeHours(config.min_notice_hours || 24);
      setMaxDaysAhead(config.max_days_ahead || 30);
      setMeetingLocation(config.meeting_location || '');
      setCustomEventTitle(config.custom_event_title || 'Interview with {candidate_name}');
      hasInitializedRef.current = true;
    }
    
    // Reset on unmount or if config becomes null (logout scenario)
    if (!config) {
      hasInitializedRef.current = false;
    }
  }, [config]);

  const handleCopy = async () => {
    if (!bookingUrl) return;
    await navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    toast.success('Booking link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    updateConfig({
      weekly_schedule: weeklySchedule,
      timezone,
      duration_minutes: durationMinutes,
      buffer_time_minutes: bufferMinutes,
      min_notice_hours: minNoticeHours,
      max_days_ahead: maxDaysAhead,
      meeting_location: meetingLocation || null,
      custom_event_title: customEventTitle || null,
    });
  };

  const handlePresetSelect = (presetSchedule: WeeklySchedule) => {
    setWeeklySchedule(presetSchedule);
  };

  const hasCalendar = identities && identities.length > 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking Link</CardTitle>
          <CardDescription>Loading your booking configuration...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Profile incomplete state
  if (needsProfileCompletion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking Link</CardTitle>
          <CardDescription>Complete your profile to create your booking link</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Profile Incomplete</AlertTitle>
            <AlertDescription>
              Please add your first and last name to your profile before creating a booking link.
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            onClick={() => {
              const profileForm = document.getElementById('profile-form');
              if (profileForm) {
                profileForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          >
            Go to Profile Settings
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Creating state
  if (isCreating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking Link</CardTitle>
          <CardDescription>Setting up your booking link...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-text-secondary">Creating your personalized booking link</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Main booking link interface
  if (!config || !bookingUrl) {
    return null;
  }

  const handleToggleActive = () => {
    if (!hasCalendar && !config.is_active) {
      toast.error('Connect a calendar first to activate your booking link');
      return;
    }
    updateConfig({ is_active: !config.is_active });
  };

  return (
    <Card data-onboarding-target="booking">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Booking Link</CardTitle>
            <CardDescription>Share your personalized booking link with candidates</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={config.is_active}
              onCheckedChange={handleToggleActive}
              disabled={isUpdating || (!hasCalendar && !config.is_active)}
            />
            <Badge variant={config.is_active ? 'default' : 'secondary'}>
              {config.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Booking URL Display */}
        <div className="space-y-2">
          <Label>Public Booking URL</Label>
          <div className="flex gap-2">
            <Input
              value={bookingUrl}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.open(bookingUrl, '_blank')}
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
          {!hasCalendar && (
            <p className="text-xs text-text-muted">
              Connect a calendar to activate your booking link
            </p>
          )}
        </div>

        <Separator />

        {/* Tabbed Configuration Interface */}
        <Tabs defaultValue="weekly-hours" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="weekly-hours">Weekly Hours</TabsTrigger>
            <TabsTrigger value="meeting-details">Meeting Details</TabsTrigger>
            <TabsTrigger value="booking-rules">Booking Rules</TabsTrigger>
          </TabsList>

          {/* Tab 1: Weekly Hours */}
          <TabsContent value="weekly-hours" className="space-y-6 mt-6">
            <SchedulePresets 
              onSelectPreset={handlePresetSelect}
              currentSchedule={weeklySchedule}
            />
            
            <Separator />
            
            <TimezoneSelector value={timezone} onChange={setTimezone} />
            
            <Separator />
            
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-primary">Weekly Schedule</h3>
              <WeeklyScheduleEditor 
                schedule={weeklySchedule} 
                onChange={setWeeklySchedule} 
              />
            </div>
          </TabsContent>

          {/* Tab 2: Meeting Details */}
          <TabsContent value="meeting-details" className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="event-title">Event Title</Label>
              <Input
                id="event-title"
                value={customEventTitle}
                onChange={(e) => setCustomEventTitle(e.target.value)}
                placeholder="Interview with {candidate_name}"
              />
              <p className="text-xs text-text-secondary">
                This title appears on calendar events when someone books using your generic booking link. Use <code className="bg-muted px-1 rounded">{'{candidate_name}'}</code> to include their name.
              </p>
            </div>
            
            <Separator />
            
            <MeetingDurationSelector 
              value={durationMinutes} 
              onChange={setDurationMinutes} 
            />
            
            <Separator />
            
            <div className="space-y-3">
              <Label>Buffer Time: {bufferMinutes} minutes</Label>
              <p className="text-xs text-text-secondary">
                Time between meetings to prepare and transition
              </p>
              <Slider
                value={[bufferMinutes]}
                onValueChange={([value]) => setBufferMinutes(value)}
                min={0}
                max={60}
                step={5}
                className="w-full"
              />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label htmlFor="meeting-location">Meeting Location (optional)</Label>
              <Input
                id="meeting-location"
                value={meetingLocation}
                onChange={(e) => setMeetingLocation(e.target.value)}
                placeholder="e.g., Google Meet (auto-generated), Zoom, Office"
              />
              <p className="text-xs text-text-secondary">
                Leave blank to auto-generate a Google Meet link
              </p>
            </div>
          </TabsContent>

          {/* Tab 3: Booking Rules */}
          <TabsContent value="booking-rules" className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="min-notice">Minimum Notice (hours)</Label>
              <Input
                id="min-notice"
                type="number"
                min="0"
                value={minNoticeHours}
                onChange={(e) => setMinNoticeHours(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-text-secondary">
                How far in advance someone must book
              </p>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label htmlFor="max-days">Maximum Days Ahead</Label>
              <Input
                id="max-days"
                type="number"
                min="1"
                value={maxDaysAhead}
                onChange={(e) => setMaxDaysAhead(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-text-secondary">
                How far in the future people can book
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="pt-4">
          <Button 
            onClick={handleSave} 
            disabled={isUpdating} 
            className="w-full"
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving Changes...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
