import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { WeeklySchedule, getDefaultWeeklySchedule } from './useBookingConfig';
import { toast } from 'sonner';

export interface BookingEventType {
  id: string;
  booking_config_id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  buffer_time_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
  meeting_location: string | null;
  custom_event_title: string | null;
  weekly_schedule: WeeklySchedule;
  timezone: string;
  color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) || 'event';
}

export function useBookingEventTypes(bookingConfigId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: eventTypes = [], isLoading } = useQuery({
    queryKey: ['booking-event-types', bookingConfigId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_event_types')
        .select('*')
        .eq('booking_config_id', bookingConfigId!)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as unknown as BookingEventType[];
    },
    enabled: !!bookingConfigId,
  });

  const createMutation = useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      duration_minutes?: number;
      color?: string;
      weekly_schedule?: WeeklySchedule;
      timezone?: string;
      buffer_time_minutes?: number;
      min_notice_hours?: number;
      max_days_ahead?: number;
      meeting_location?: string;
      custom_event_title?: string;
    }) => {
      if (!bookingConfigId) throw new Error('No booking config');
      
      const slug = generateSlug(input.title);
      // Ensure unique slug
      const existing = eventTypes.filter(et => et.slug.startsWith(slug));
      const finalSlug = existing.length > 0 ? `${slug}-${existing.length + 1}` : slug;

      const { data, error } = await supabase
        .from('booking_event_types')
        .insert({
          booking_config_id: bookingConfigId,
          title: input.title,
          slug: finalSlug,
          description: input.description || null,
          duration_minutes: input.duration_minutes ?? 30,
          color: input.color ?? '#7c3aed',
          weekly_schedule: (input.weekly_schedule ?? getDefaultWeeklySchedule()) as any,
          timezone: input.timezone ?? 'America/New_York',
          buffer_time_minutes: input.buffer_time_minutes ?? 15,
          min_notice_hours: input.min_notice_hours ?? 24,
          max_days_ahead: input.max_days_ahead ?? 30,
          meeting_location: input.meeting_location || null,
          custom_event_title: input.custom_event_title || null,
          sort_order: eventTypes.length,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as BookingEventType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-event-types', bookingConfigId] });
      toast.success('Event type created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create event type: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BookingEventType> & { id: string }) => {
      // If title changed, update slug too
      if (updates.title) {
        const newSlug = generateSlug(updates.title);
        const existing = eventTypes.filter(et => et.id !== id && et.slug.startsWith(newSlug));
        updates.slug = existing.length > 0 ? `${newSlug}-${existing.length + 1}` : newSlug;
      }

      const { data, error } = await supabase
        .from('booking_event_types')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as BookingEventType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-event-types', bookingConfigId] });
      toast.success('Event type updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('booking_event_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-event-types', bookingConfigId] });
      toast.success('Event type deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  return {
    eventTypes,
    isLoading,
    createEventType: createMutation.mutate,
    updateEventType: updateMutation.mutate,
    deleteEventType: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
