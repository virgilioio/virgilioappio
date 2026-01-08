-- Fix the existing transferred candidate's stage references
-- Update the scheduled booking's stage to the Enterprise job equivalent
UPDATE scheduled_bookings
SET job_hiring_stage_id = 'd5904ed0-f7f6-43f1-b4ad-d8209ea6d077'
WHERE id = 'e3e2cc54-63e2-4257-84a3-68e73ceb7f1c';

-- Update the scorecard's stage to the Enterprise job equivalent  
UPDATE job_stage_scorecards
SET stage_instance_id = 'd5904ed0-f7f6-43f1-b4ad-d8209ea6d077'
WHERE id = '2a805520-d866-428e-85e8-01903cb5861d';