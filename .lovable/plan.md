# Remove legacy Platform Personalization

Scope: delete the Settings → Personalization section and everything that exists *only* to manage / consume the `platform_assets` + `platform_settings` data. Nothing else. Lovable owns the favicon/title; empty-state images aren't used anymore.

## In scope (what gets removed)

### Settings UI
- `src/components/settings/SettingsSidebar.tsx` — remove the `platform-personalization` entry (and the `Palette` icon import if unused after).
- `src/pages/Settings.tsx` — remove the `PlatformAssetUploader` import and the `case 'platform-personalization'` branch.
- Delete files (all exist only for this section):
  - `src/components/settings/PlatformAssetUploader.tsx`
  - `src/components/settings/PlatformSettingsManager.tsx`
  - `src/components/settings/PlatformTab.tsx` (already orphaned)
  - `src/hooks/usePlatformAssets.ts`
  - `src/hooks/usePlatformSettings.ts`

### Consumers of the data being deleted (must be cleaned, otherwise they 404 against missing tables)
- `src/App.tsx` — drop the `useFavicon()` and `useBrowserTitle()` calls + imports. These read `platform_assets` / `platform_settings`, which are going away. Favicon and title are already declared statically in `index.html`.
- Delete `src/hooks/useFavicon.ts` and `src/hooks/useBrowserTitle.ts`.
- `src/components/ui/empty-state.tsx` — remove the `usePlatformAsset` helper, the `EmptyStateAssetType` export, the `assetType` prop on `LegacyEmptyStateProps`, and the `customImage` branch in `LegacyEmptyStateCore`. The Gio mascot fallback already covers every empty state.
- `src/components/candidates/IndependentCandidateTable.tsx` — drop the now-removed `assetType="empty-state-independent-candidates"` prop from its `<EmptyState>`.
- `src/utils/candidatePdfGenerator.ts` and `src/utils/analyticsReportGenerator.ts` — remove the `supabase.from('platform_assets')` logo lookup. Both already fall back to `/virgilio-logo.png`; keep that as the unconditional source.

### Backend
- Delete edge function `supabase/functions/upload-platform-asset/` (and call `supabase--delete_edge_functions` for `upload-platform-asset`).
- Migration:
  - `DROP TABLE IF EXISTS public.platform_assets CASCADE;`
  - `DROP TABLE IF EXISTS public.platform_settings CASCADE;`
  - Purge legacy storage rows: `DELETE FROM storage.objects WHERE bucket_id = 'assets' AND (name LIKE 'logo/%' OR name LIKE 'favicon/%' OR name LIKE 'empty-state-%/%');`
  - Drop any storage policies that exist *only* for those prefixes (will identify before writing the migration; leave any general `assets` bucket policies alone).
- `src/integrations/supabase/types.ts` regenerates automatically after the migration; `platform_assets` / `platform_settings` entries disappear.

## Out of scope (explicitly NOT touched)
- `index.html` — favicon `<link>` tags, apple-touch icons, OG/Twitter tags. Lovable manages the favicon; the static tags stay.
- The `assets` storage bucket itself and any non-legacy objects in it.
- Any other Settings tab, hook, or component.

## Verification
- App builds; `tsc` passes.
- Grep across `src/` + `supabase/` for: `platform_assets`, `platform_settings`, `usePlatformAssets`, `usePlatformSettings`, `useFavicon`, `useBrowserTitle`, `PlatformAssetUploader`, `PlatformSettingsManager`, `PlatformTab`, `platform-personalization`, `EmptyStateAssetType`, `upload-platform-asset` → zero hits.
- Settings sidebar no longer shows Personalization; `/settings?tab=platform-personalization` falls through to the default settings view (no crash).
- Independent Candidates empty state still renders (Gio mascot).
- Candidate PDF + Analytics PDF still generate with the static `/virgilio-logo.png` header.
- `supabase--linter` clean.
