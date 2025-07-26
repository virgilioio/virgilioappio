-- Add worker_entity_type column to workers table
ALTER TABLE public.workers 
ADD COLUMN worker_entity_type worker_entity_type_enum NOT NULL DEFAULT 'individual';