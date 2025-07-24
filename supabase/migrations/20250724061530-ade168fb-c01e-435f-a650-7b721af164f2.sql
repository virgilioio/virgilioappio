-- Add department_id column to worker_contracts table
ALTER TABLE worker_contracts 
ADD COLUMN department_id UUID REFERENCES departments(id);

-- Create index for performance
CREATE INDEX idx_worker_contracts_department_id ON worker_contracts(department_id);

-- Migrate existing department text data to department_id (best effort)
-- This will match department names to existing departments in the same organization
UPDATE worker_contracts 
SET department_id = d.id
FROM departments d
WHERE worker_contracts.department = d.name 
  AND worker_contracts.organization_id = d.organization_id 
  AND d.is_active = true;

-- Remove the old department text column after migration
ALTER TABLE worker_contracts 
DROP COLUMN department;