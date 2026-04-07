import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface EventTypeOption {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  color: string;
}

interface EventTypePickerProps {
  eventTypes: EventTypeOption[];
  onSelect: (eventType: EventTypeOption) => void;
  interviewerName: string;
}

export function EventTypePicker({ eventTypes, onSelect, interviewerName }: EventTypePickerProps) {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-2xl font-poppins font-bold text-virgilio-text">
          {interviewerName}
        </h2>
        <p className="text-virgilio-muted">Select an event type to schedule</p>
      </div>

      <div className="space-y-3">
        {eventTypes.map((et) => (
          <Card
            key={et.id}
            className="cursor-pointer transition-all hover:shadow-md hover:border-virgilio-purple/40 border-virgilio-border group"
            onClick={() => onSelect(et)}
          >
            <CardContent className="p-0">
              <div className="flex">
                {/* Color accent bar */}
                <div
                  className="w-1.5 rounded-l-lg flex-shrink-0"
                  style={{ backgroundColor: et.color }}
                />
                <div className="p-5 flex-1">
                  <h3 className="font-semibold text-virgilio-text group-hover:text-virgilio-purple transition-colors">
                    {et.title}
                  </h3>
                  {et.description && (
                    <p className="text-sm text-virgilio-muted mt-1">{et.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 text-sm text-virgilio-muted">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{et.duration_minutes} min</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
