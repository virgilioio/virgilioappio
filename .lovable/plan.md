

# Fix UTF-8 Mojibake in Email Display

## Problem
Emails containing curly quotes, apostrophes, em dashes, and similar Unicode characters display as garbled text like `â€™` instead of `'`. This is classic UTF-8 mojibake — the bytes were stored or interpreted as Latin-1/Windows-1252 instead of UTF-8.

## Solution

### 1. New utility: `src/utils/fixMojibake.ts`
Create a function that detects and repairs common UTF-8-as-Latin-1 mojibake patterns:
- `â€™` → `'` (right single quote / apostrophe)
- `â€˜` → `'` (left single quote)
- `â€œ` → `"` (left double quote)
- `â€\u009D` → `"` (right double quote)
- `â€"` → `—` (em dash)
- `â€"` → `–` (en dash)
- `â€¦` → `…` (ellipsis)
- `Â ` → ` ` (non-breaking space artifact)

The function will use a replacement map approach, running all substitutions on the input string.

### 2. Apply in `src/components/candidates/EmailHistoryCard.tsx`
- Import and apply `fixMojibake` to:
  - The collapsed preview text (line 194, the `decodeHtmlEntities(...)` call)
  - The expanded plain text body (line 189, `email.body_text`)
  - The subject line (line 144)

### 3. Apply in `src/utils/htmlSanitizer.ts`
- Import and apply `fixMojibake` at the start of `sanitizeHtml()` so all HTML email bodies rendered via `SafeHtml` are also fixed. This covers the expanded HTML view in EmailHistoryCard.

## Files Changed
- **New**: `src/utils/fixMojibake.ts`
- **Modified**: `src/components/candidates/EmailHistoryCard.tsx`
- **Modified**: `src/utils/htmlSanitizer.ts`

