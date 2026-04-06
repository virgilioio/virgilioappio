

# Photo Widget: Restrict Formats + Auto-Transition Carousel

## Changes

### 1. Restrict file input to JPG/PNG only

- Change the `accept` attribute on the hidden file input (line 362) from `image/jpeg,image/png,image/gif,image/webp` to `image/jpeg,image/png`.
- Update the validation in `handleUpload` (line 116) to check against only `image/jpeg` and `image/png` MIME types, with a clear error message: "Only JPG and PNG files are supported".
- Update the empty-state placeholder text to say "JPG or PNG only" beneath "Add a photo".

### 2. Fallback upload for compression failures

Since HEIC and other exotic formats are now blocked at the input level, compression should reliably work. But as a safety net, wrap `compressImage` in a try/catch and fall back to uploading the original file if compression fails.

### 3. Auto-transition carousel

Add a `useEffect` that auto-advances the carousel every 5 seconds when:
- There are 2+ photos
- The widget is in normal mode (not editing)
- The user is not hovering over the photo

Use a smooth CSS crossfade transition between photos — add a `transition-opacity` class to the image with a brief fade effect on index change.

```text
Normal Mode with auto-play:
┌─────────────────────┐
│                 [⋯] │
│                      │
│   [photo fades in]   │  ← auto-advances every 5s
│                      │
│ ● ○ ○               │  ← dots update
└─────────────────────┘
Pauses on hover, resumes on mouse leave.
```

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/PhotoCarouselWidget.tsx` | Restrict accept to JPG/PNG; update validation message; add compression fallback; add auto-advance timer with fade transition |

