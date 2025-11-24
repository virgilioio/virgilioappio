-- Fix Virgilio tenant's company slug
UPDATE public.careers_page_settings 
SET company_slug = 'virgilio' 
WHERE tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab';