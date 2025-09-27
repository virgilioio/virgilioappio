-- Drop the existing constraint that only allows logo and favicon
ALTER TABLE platform_assets DROP CONSTRAINT platform_assets_asset_type_check;

-- Add the updated constraint with all valid asset types including empty state types
ALTER TABLE platform_assets ADD CONSTRAINT platform_assets_asset_type_check 
CHECK (asset_type = ANY (ARRAY[
  'logo'::text, 
  'favicon'::text,
  'empty-state-organizations'::text,
  'empty-state-jobs'::text,
  'empty-state-candidates'::text,
  'empty-state-members'::text,
  'empty-state-comments'::text,
  'empty-state-attachments'::text,
  'empty-state-templates'::text,
  'empty-state-independent-candidates'::text
]));