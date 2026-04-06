

# Fix: Uploaded Photos Not Displaying in Carousel Widget

## Likely Root Cause

The public URLs returned by `getPublicUrl()` are being cached by the browser. Supabase Storage uploads specify `cacheControl: '3600'` (1 hour). If the browser ever requests the URL before the upload fully propagates (or hits a CDN cache miss), it caches a stale/empty response. Since each upload uses a unique UUID filename this shouldn't happen for *new* uploads, but there's another issue:

The `getPublicUrl()` returns a bare URL with no cache-busting parameter. If there's any CDN or edge caching layer, the image may not be immediately available at that URL after upload.

Additionally, when `loadPhotos` runs on page load, it constructs URLs the same way — no cache-busting. This means even on reload, cached 404s or empty responses persist.

## Fix

### `src/components/dashboard/PhotoCarouselWidget.tsx`

1. **Add cache-busting query parameter** to all public URLs — both after upload and when loading existing photos:
   ```typescript
   // After upload (line 134):
   const url = `${supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?t=${Date.now()}`

   // When loading (line 85):
   url: `${supabase.storage.from(BUCKET).getPublicUrl(`${user.id}/${f.name}`).data.publicUrl}?t=${Date.now()}`
   ```

2. **Remove aggressive cacheControl** from upload options — change from `'3600'` to `'0'` or remove it entirely, so the CDN doesn't serve stale responses:
   ```typescript
   const { error } = await supabase.storage.from(BUCKET).upload(path, compressedFile, {
     cacheControl: '0',
     contentType: 'image/jpeg',
     upsert: false,
   })
   ```

3. **Add console logging** to the upload flow to aid debugging if the issue persists — log the upload response and the constructed URL.

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/PhotoCarouselWidget.tsx` | Add cache-busting to URLs; reduce cacheControl; add debug logging |

