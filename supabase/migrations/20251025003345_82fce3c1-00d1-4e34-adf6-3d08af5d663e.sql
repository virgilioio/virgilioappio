-- Enable real-time for jobs and candidates tables
-- This allows automatic list refresh when data changes

-- Ensure jobs table has realtime enabled
ALTER TABLE public.jobs REPLICA IDENTITY FULL;

-- Ensure candidates table has realtime enabled  
ALTER TABLE public.candidates REPLICA IDENTITY FULL;

-- Add tables to realtime publication if not already there
DO $$
BEGIN
  -- Add jobs table to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public'
    AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;

  -- Add candidates table to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public'
    AND tablename = 'candidates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;
  END IF;
END $$;