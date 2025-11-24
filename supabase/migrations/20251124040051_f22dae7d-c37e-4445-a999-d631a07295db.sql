-- Add about column to tenants table for company description
ALTER TABLE tenants ADD COLUMN about text;

COMMENT ON COLUMN tenants.about IS 'Rich text description of the company/tenant for careers page and company profile';