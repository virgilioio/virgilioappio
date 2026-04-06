

# Fix: Broken Images in Photo Widget + Improve Delete UX

## Root Cause: Broken Images

Uploaded photos have **size: 0 bytes** in Supabase Storage. The database confirms:
```
contentLength: 0, size: 0
```

The `compressImage` function returns a raw `Blob` from `canvas.toBlob()`. The Supabase Storage client may not correctly determine the content length from a bare Blob. Converting it to a `File` object (which carries explicit size/name metadata) ensures the upload transmits the actual bytes.

## Root Cause: Delete Not Working

The delete button (trash icon) is already in the code but **only appears on hover** — easy to miss, especially on mobile/touch devices. Additionally, users with existing zero-byte broken images can't tell the delete is there because the broken image shows nothing to hover over.

## Fix

### `src/components/dashboard/PhotoCarouselWidget.tsx`

1. **Fix upload**: Convert the compressed `Blob` to a `File` before uploading:
   ```typescript
   const compressed = await compressImage(file)
   const fileName = `${crypto.randomUUID()}.jpg`
   const compressedFile = new File([compressed], fileName, { type: 'image/jpeg' })
   // upload compressedFile instead of compressed
   ```

2. **Always show delete button** when a photo is displayed (not just on hover) — use a subtle semi-transparent style that becomes fully opaque on hover. This makes it discoverable on mobile too.

3. **Handle broken images gracefully**: Add an `onError` handler to the `<img>` tag that shows a fallback state with a delete option, so users can remove previously broken uploads.

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/PhotoCarouselWidget.tsx` | Convert Blob→File before upload; always-visible delete button; broken image fallback |

