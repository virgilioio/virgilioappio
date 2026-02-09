

# Rebrand: Replace "Virgilio" with "GoGio" in All User-Facing Text

## Overview

Several user-facing strings still reference "Virgilio" instead of "GoGio". This plan updates every instance where a customer or candidate could see the old name -- in billing screens, email templates, PDF exports, and the Terms page. Internal dev tooling and CSS class names are left as-is since they're not visible to users.

## Changes

### 1. BillingGuard.tsx (Locked/Canceled screens)

**Lines 62 and 70** -- Replace both instances:
- "Subscribe to continue using Virgilio ATS." --> "Subscribe to continue using GoGio ATS."

### 2. EmailSettingsTab.tsx (Settings page)

**Line 30** -- Replace:
- "Connect your email accounts to send emails directly from Virgilio." --> "Connect your email accounts to send emails directly from GoGio."

### 3. Terms.tsx (Terms of Service page)

**Line 42** -- Replace:
- "These Terms govern your use of Virgilio." --> "These Terms govern your use of GoGio."

### 4. candidatePdfGenerator.ts (PDF export fallback)

**Line 407** -- Replace:
- `pdf.text('VIRGILIO', ...)` --> `pdf.text('GOGIO', ...)`

### 5. emailTemplate.ts (Shared email footer)

**Line 212** -- Replace:
- `support@virgilio.tech` --> `support@gogio.io` (or the correct GoGio support email)

### 6. CreateDevAdmin.tsx (Internal dev tool -- low priority but still visible)

**Lines 53, 58, 62, 65, 79** -- Replace all references:
- "Virgilio Platform Setup" --> "GoGio Platform Setup"
- "Set up Virgilio as the platform organization..." --> "Set up GoGio as the platform organization..."
- "Organization: Virgilio (Platform)" --> "Organization: GoGio (Platform)"
- "allan@virgilio.tech" --> update if email has changed
- "Set Up Virgilio Platform" --> "Set Up GoGio Platform"

## Files Modified

| File | Type of Change |
|------|----------------|
| `src/components/auth/BillingGuard.tsx` | 2 string replacements |
| `src/components/settings/EmailSettingsTab.tsx` | 1 string replacement |
| `src/pages/Terms.tsx` | 1 string replacement |
| `src/utils/candidatePdfGenerator.ts` | 1 string replacement |
| `supabase/functions/_shared/emailTemplate.ts` | 1 email address update |
| `src/components/dev/CreateDevAdmin.tsx` | 5 string replacements |

## What Is NOT Changed (intentionally)

- **CSS classes** like `text-virgilio-purple`, `border-virgilio-border` -- these are part of the design token system and not visible to users
- **Component names** like `DatePickerVirgilio`, `TimePickerVirgilio` -- internal code references
- **Button variants** like `variant="virgilio"` -- internal code
- **Tailwind config comments** -- developer-only
- **Edge function fallback lookups** (`ilike("name", "virgilio")`) -- these query the database for the platform org row; changing them requires also updating the database record
- **Documentation files** (CHANGELOG.md, docs/) -- internal reference

## Risk Assessment

- **Zero risk**: Pure string replacements with no logic changes

