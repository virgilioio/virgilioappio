import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";
import googleMeetIcon from "@/assets/google-meet-icon.png";

interface MeetingLocationSelectorProps {
  meetingType: 'google_meet' | 'custom';
  onMeetingTypeChange: (type: 'google_meet' | 'custom') => void;
  customLocation: string;
  onCustomLocationChange: (location: string) => void;
}

export function MeetingLocationSelector({
  meetingType,
  onMeetingTypeChange,
  customLocation,
  onCustomLocationChange,
}: MeetingLocationSelectorProps) {
  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">Meeting Location</Label>
      
      <RadioGroup
        value={meetingType}
        onValueChange={(value) => onMeetingTypeChange(value as 'google_meet' | 'custom')}
      >
        <div className="flex items-start space-x-3 space-y-0 rounded-md border border-border p-4 hover:bg-secondary/30 transition-colors">
          <RadioGroupItem value="google_meet" id="google_meet" />
          <div className="flex-1 space-y-1 leading-none">
            <Label
              htmlFor="google_meet"
              className="flex items-center gap-2 cursor-pointer font-medium"
            >
              <img src={googleMeetIcon} alt="Google Meet" className="h-4 w-4" />
              Google Meet
            </Label>
            <p className="text-sm text-text-secondary">
              A Meet link will be created automatically
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3 space-y-0 rounded-md border border-border p-4 hover:bg-secondary/30 transition-colors">
          <RadioGroupItem value="custom" id="custom" />
          <div className="flex-1 space-y-3 leading-none">
            <Label
              htmlFor="custom"
              className="flex items-center gap-2 cursor-pointer font-medium"
            >
              <MapPin className="h-4 w-4 text-primary" />
              Custom Location
            </Label>
            
            {meetingType === 'custom' && (
              <div className="space-y-2">
                <Input
                  placeholder="e.g., https://zoom.us/j/..., +1 (555) 123-4567, Building A Room 205"
                  value={customLocation}
                  onChange={(e) => onCustomLocationChange(e.target.value)}
                  maxLength={500}
                  className="w-full"
                />
                <p className="text-xs text-text-secondary">
                  Enter Zoom link, phone number, or physical address ({customLocation.length}/500)
                </p>
              </div>
            )}
            
            {meetingType !== 'custom' && (
              <p className="text-sm text-text-secondary">
                Specify your own meeting location
              </p>
            )}
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}
