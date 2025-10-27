import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { Calendar, Clock, Globe, ArrowLeft } from 'lucide-react';

const formSchema = z.object({
  candidate_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  candidate_email: z.string().email('Invalid email address').max(255),
  candidate_phone: z.string().max(20).optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

type FormData = z.infer<typeof formSchema>;

interface BookingConfirmationFormProps {
  selectedSlot: { start: string; end: string } | null;
  candidateTimezone: string;
  onCancel: () => void;
  onConfirm: (formData: FormData) => Promise<void>;
}

export function BookingConfirmationForm({
  selectedSlot,
  candidateTimezone,
  onCancel,
  onConfirm,
}: BookingConfirmationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      candidate_name: '',
      candidate_email: '',
      candidate_phone: '',
      notes: '',
    },
  });

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await onConfirm(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selectedSlot) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={onCancel}
        className="text-virgilio-muted hover:text-virgilio-text gap-2 -ml-2"
        aria-label="Go back to time selection"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-medium">Change time</span>
      </Button>

      {/* Selected slot summary */}
      <Card className="shadow-calendly border-virgilio-border">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-virgilio-purple" />
            <span className="font-semibold text-virgilio-text">
              {format(new Date(selectedSlot.start), 'EEEE, MMMM d, yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-virgilio-purple" />
            <span className="text-virgilio-text">
              {format(new Date(selectedSlot.start), 'h:mm a')} - {format(new Date(selectedSlot.end), 'h:mm a')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4 text-virgilio-purple" />
            <span className="text-virgilio-muted">{candidateTimezone.replace(/_/g, ' ')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card className="shadow-calendly border-virgilio-border">
        <CardContent className="p-6">
          <h3 className="text-h4-mobile font-poppins font-bold text-virgilio-text mb-6">
            Enter Details<span className="text-virgilio-purple">.</span>
          </h3>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="candidate_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-virgilio-text">
                      Name *
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="John Doe" 
                        {...field}
                        className="h-11 border-virgilio-border focus:border-virgilio-purple focus:ring-virgilio-purple rounded-lg"
                      />
                    </FormControl>
                    <FormMessage className="text-virgilio-error text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="candidate_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-virgilio-text">
                      Email *
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="john@example.com" 
                        {...field}
                        className="h-11 border-virgilio-border focus:border-virgilio-purple focus:ring-virgilio-purple rounded-lg"
                      />
                    </FormControl>
                    <FormMessage className="text-virgilio-error text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="candidate_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-virgilio-muted">
                      Phone (optional)
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="tel" 
                        placeholder="+1 (555) 123-4567" 
                        {...field}
                        className="h-11 border-virgilio-border focus:border-virgilio-purple focus:ring-virgilio-purple rounded-lg"
                      />
                    </FormControl>
                    <FormMessage className="text-virgilio-error text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-virgilio-muted">
                      Additional notes (optional)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Anything you'd like to share..."
                        className="resize-none border-virgilio-border focus:border-virgilio-purple focus:ring-virgilio-purple rounded-lg min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-virgilio-error text-xs" />
                    <p className="text-xs text-virgilio-muted">
                      {field.value?.length || 0}/500
                    </p>
                  </FormItem>
                )}
              />

              {/* Privacy consent */}
              <p className="text-xs text-virgilio-muted leading-relaxed pt-2">
                By scheduling, you agree to our terms and privacy policy. We'll send you email reminders about this meeting.
              </p>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-virgilio-purple hover:bg-virgilio-purple/90 text-white font-semibold rounded-lg shadow-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-virgilio-purple focus-visible:ring-offset-2"
              >
                {isSubmitting ? 'Scheduling...' : 'Schedule Event'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
