-- Remove all SEO-related entries from platform_settings table
DELETE FROM public.platform_settings 
WHERE setting_key IN (
  'seo_page_title',
  'seo_meta_description', 
  'seo_keywords',
  'seo_canonical_url',
  'seo_robots_directive',
  'seo_thumbnail_image',
  'seo_og_title',
  'seo_og_description',
  'seo_og_image',
  'seo_og_url',
  'seo_og_type',
  'seo_og_site_name',
  'seo_twitter_title',
  'seo_twitter_description',
  'seo_twitter_image',
  'seo_twitter_card'
);