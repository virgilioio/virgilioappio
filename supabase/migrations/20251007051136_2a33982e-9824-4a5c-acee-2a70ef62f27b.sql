-- Expand the allowed asset types to include 'empty-state-urls'
ALTER TABLE public.platform_assets
  DROP CONSTRAINT IF EXISTS platform_assets_asset_type_check;

ALTER TABLE public.platform_assets
  ADD CONSTRAINT platform_assets_asset_type_check
  CHECK (
    asset_type = ANY (ARRAY[
      'logo'::text,
      'favicon'::text,
      'empty-state-organizations'::text,
      'empty-state-jobs'::text,
      'empty-state-candidates'::text,
      'empty-state-members'::text,
      'empty-state-comments'::text,
      'empty-state-attachments'::text,
      'empty-state-templates'::text,
      'empty-state-independent-candidates'::text,
      'empty-state-urls'::text
    ])
  );