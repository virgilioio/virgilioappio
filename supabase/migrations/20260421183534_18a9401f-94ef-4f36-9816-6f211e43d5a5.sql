-- 1. Add scheduling mode to job_hiring_stages
ALTER TABLE public.job_hiring_stages
  ADD COLUMN IF NOT EXISTS interviewer_scheduling_mode text NOT NULL DEFAULT 'any'
  CHECK (interviewer_scheduling_mode IN ('any','all'));

-- 2. Create scheduled_booking_attendees table
CREATE TABLE IF NOT EXISTS public.scheduled_booking_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.scheduled_bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'interviewer' CHECK (role IN ('interviewer','optional','backup')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sba_booking_id ON public.scheduled_booking_attendees(booking_id);
CREATE INDEX IF NOT EXISTS idx_sba_user_id ON public.scheduled_booking_attendees(user_id);

ALTER TABLE public.scheduled_booking_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attendees readable when parent booking is readable"
ON public.scheduled_booking_attendees
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.scheduled_bookings sb WHERE sb.id = scheduled_booking_attendees.booking_id)
);

CREATE POLICY "Org members can manage attendees"
ON public.scheduled_booking_attendees
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.scheduled_bookings sb
    JOIN public.members m ON m.organization_id = sb.organization_id
    WHERE sb.id = scheduled_booking_attendees.booking_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.scheduled_bookings sb
    JOIN public.members m ON m.organization_id = sb.organization_id
    WHERE sb.id = scheduled_booking_attendees.booking_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

-- 3. Extend booking_link_tokens
ALTER TABLE public.booking_link_tokens
  ADD COLUMN IF NOT EXISTS scheduling_mode text NOT NULL DEFAULT 'single'
    CHECK (scheduling_mode IN ('single','group')),
  ADD COLUMN IF NOT EXISTS booking_config_ids uuid[];

ALTER TABLE public.booking_link_tokens
  ALTER COLUMN short_code DROP NOT NULL;
