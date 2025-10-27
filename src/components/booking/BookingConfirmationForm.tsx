import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { format } from 'date-fns';
import { Calendar, Clock, Globe } from 'lucide-react';

const formSchema = z.object({
  candidate_name: z.string().min(2, 'Name must be at least 2 characters'),
  candidate_email: z.string().email('Invalid email address'),
  candidate_phone: z.string().optional(),
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

  return (
    <Sheet open={!!selectedSlot} onOpenChange={(open) => !open && onCancel()}>
      <SheetContent className="sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Confirm Your Interview</SheetTitle>
          <SheetDescription>
            Please provide your contact information to complete the booking.
          </SheetDescription>
        </SheetHeader>

        {selectedSlot && (
          <div className="my-6 p-4 bg-accent/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-text-secondary" />
              <span className="font-medium">
                {format(new Date(selectedSlot.start), 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-text-secondary" />
              <span>
                {format(new Date(selectedSlot.start), 'h:mm a')} - {format(new Date(selectedSlot.end), 'h:mm a')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-text-secondary" />
              <span className="text-text-secondary">{candidateTimezone}</span>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="candidate_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name *</FormLabel>
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
                  <FormLabel>Notes for interviewer (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional information you'd like to share..."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-text-secondary">
                    {field.value?.length || 0}/500 characters
                  </p>
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1"
              >
                Change Time
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Confirming...' : 'Confirm Booking'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
