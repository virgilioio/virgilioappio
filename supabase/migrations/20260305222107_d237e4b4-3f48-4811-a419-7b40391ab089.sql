-- Drop the existing blanket unique constraint
ALTER TABLE offer_approval_requests 
  DROP CONSTRAINT offer_approval_requests_offer_letter_unique;

-- Create a partial unique index for active requests only
CREATE UNIQUE INDEX offer_approval_requests_active_unique 
  ON offer_approval_requests (offer_letter_id) 
  WHERE status IN ('pending', 'approved');