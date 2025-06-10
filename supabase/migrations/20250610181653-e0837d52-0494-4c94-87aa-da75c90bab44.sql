
-- Add organization_type column to distinguish platform vs client organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS organization_type text NOT NULL DEFAULT 'client';

-- Add check constraint for organization_type (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'organizations_type_check'
    ) THEN
        ALTER TABLE organizations 
        ADD CONSTRAINT organizations_type_check 
        CHECK (organization_type IN ('platform', 'client'));
    END IF;
END $$;
