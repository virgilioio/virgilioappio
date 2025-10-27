import { useState, useEffect } from 'react';
import { Copy, ExternalLink, Check, ChevronDown, ChevronUp, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { useBookingConfig } from '@/hooks/useBookingConfig';
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities';
import { toast } from 'sonner';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New York (Eastern Time)' },
  { value: 'America/Chicago', label: 'America/Chicago (Central Time)' },
  { value: 'America/Denver', label: 'America/Denver (Mountain Time)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (Pacific Time)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEDT)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZDT)' },
];

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
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Local state for form
  const [availableDays, setAvailableDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [timezone, setTimezone] = useState('America/New_York');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [minNoticeHours, setMinNoticeHours] = useState(24);
  const [maxDaysAhead, setMaxDaysAhead] = useState(30);
  const [meetingLocation, setMeetingLocation] = useState('');

  // Sync form state with config
  useEffect(() => {
    if (config) {
      setAvailableDays(config.available_days || [1, 2, 3, 4, 5]);
      setStartTime(config.start_time || '09:00');
      setEndTime(config.end_time || '17:00');
      setTimezone(config.timezone || 'America/New_York');
      setDurationMinutes(config.duration_minutes || 30);
      setBufferMinutes(config.buffer_time_minutes || 15);
      setMinNoticeHours(config.min_notice_hours || 24);
      setMaxDaysAhead(config.max_days_ahead || 30);
      setMeetingLocation(config.meeting_location || '');
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
      available_days: availableDays,
      start_time: startTime,
      end_time: endTime,
      timezone,
      duration_minutes: durationMinutes,
      buffer_time_minutes: bufferMinutes,
      min_notice_hours: minNoticeHours,
      max_days_ahead: maxDaysAhead,
      meeting_location: meetingLocation || null,
    });
  };

  const hasCalendar = identities && identities.length > 0;
  const isActive = config?.is_active ?? false;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Booking Link</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // State 1: Profile Incomplete
  if (needsProfileCompletion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Booking Link</CardTitle>
          <CardDescription>
            Complete your profile to generate your booking link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Profile Incomplete</AlertTitle>
            <AlertDescription>
              Please add your first and last name to your profile to enable booking links.
            </AlertDescription>
          </Alert>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => {
              document.getElementById('profile-form')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Complete Profile Above
          </Button>
        </CardContent>
      </Card>
    );
  }

  // State 2: Creating Booking Config
  if (isCreating || (!config && !needsProfileCompletion)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Booking Link</CardTitle>
          <CardDescription>Setting up your booking link...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Generating your unique booking link...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return null; // Shouldn't reach here but safety fallback
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Your Booking Link</CardTitle>
            <CardDescription>
              Share this link with candidates to let them book time with you
            </CardDescription>
          </div>
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Active ✓' : hasCalendar ? 'Inactive' : 'Connect Calendar to Activate'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Booking URL Display */}
        <div className="space-y-2">
          <Label>Public Booking URL</Label>
          <div className="flex gap-2">
            <Input value={bookingUrl || ''} readOnly className="flex-1" />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              disabled={!bookingUrl}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.open(bookingUrl || '', '_blank')}
              disabled={!bookingUrl || !isActive}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          {!hasCalendar && (
            <p className="text-sm text-muted-foreground">
              Connect your calendar to activate this booking link
            </p>
          )}
        </div>

        {/* Customization Panel */}
        <Collapsible open={isCustomizing} onOpenChange={setIsCustomizing}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full">
              {isCustomizing ? (
                <>
                  <ChevronUp className="mr-2 h-4 w-4" />
                  Hide Availability Settings
                </>
              ) : (
                <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Customize Availability
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-6 pt-6">
            {/* Working Days */}
            <div className="space-y-3">
              <Label>Working Days</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day.value}`}
                      checked={availableDays.includes(day.value)}
                      onCheckedChange={(checked) => {
                        setAvailableDays(
                          checked
                            ? [...availableDays, day.value]
                            : availableDays.filter((d) => d !== day.value)
                        );
                      }}
                    />
                    <Label htmlFor={`day-${day.value}`} className="text-sm font-normal">
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Working Hours */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label>Timezone</Label>
              <SearchableSelect
                options={TIMEZONE_OPTIONS}
                value={timezone}
                onValueChange={setTimezone}
                placeholder="Select timezone"
              />
            </div>

            <Separator />

            {/* Duration */}
            <div className="space-y-2">
              <Label>Meeting Duration (minutes)</Label>
              <Input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                min={15}
                max={240}
                step={15}
              />
            </div>

            {/* Buffer Time */}
            <div className="space-y-3">
              <Label>Buffer Time Between Meetings: {bufferMinutes} minutes</Label>
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

            {/* Minimum Notice */}
            <div className="space-y-2">
              <Label>Minimum Notice (hours)</Label>
              <Input
                type="number"
                value={minNoticeHours}
                onChange={(e) => setMinNoticeHours(Number(e.target.value))}
                min={1}
                max={168}
              />
              <p className="text-xs text-muted-foreground">
                Candidates can't book within {minNoticeHours} hours from now
              </p>
            </div>

            {/* Maximum Days Ahead */}
            <div className="space-y-2">
              <Label>Maximum Days Ahead</Label>
              <Input
                type="number"
                value={maxDaysAhead}
                onChange={(e) => setMaxDaysAhead(Number(e.target.value))}
                min={1}
                max={365}
              />
              <p className="text-xs text-muted-foreground">
                Candidates can book up to {maxDaysAhead} days in advance
              </p>
            </div>

            <Separator />

            {/* Meeting Location */}
            <div className="space-y-2">
              <Label htmlFor="meeting-location">Meeting Location (optional)</Label>
              <Input
                id="meeting-location"
                value={meetingLocation}
                onChange={(e) => setMeetingLocation(e.target.value)}
                placeholder="Zoom link, Google Meet, or physical address"
              />
            </div>

            {/* Save Button */}
            <Button onClick={handleSave} disabled={isUpdating} className="w-full">
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
