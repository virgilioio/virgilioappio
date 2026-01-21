-- Allow simple/generic booking links to work without pipeline context
-- This enables Calendly-like functionality where bookings don't require job/candidate association

ALTER TABLE scheduled_bookings 
  ALTER COLUMN candidate_id DROP NOT NULL,
  ALTER COLUMN job_hiring_stage_id DROP NOT NULL,
  ALTER COLUMN tenant_id DROP NOT NULL;