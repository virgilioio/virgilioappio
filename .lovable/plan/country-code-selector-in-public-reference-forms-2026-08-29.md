# Country code selector in public reference forms

## Goal
Phone fields in the public candidate flow (`/references/{token}`, candidate submits referees) get the same dial-code + number split used across the app — without breaking the public pages' custom chrome (inline styles, `#FAF8F3` shell, 38px controls, no shadcn components).

## Findings
- Phone fields appear only in **Flow C** (`src/pages/PublicReferenceSubmit.tsx` line 480): referee fields of `type === 'phone'` render as a plain `PublicInput type="tel"`.
- **Flow D** (`PublicReferenceAnswer.tsx` / `QuestionInstrument.tsx`) has no phone question type — nothing to change there.
- The app-wide `src/components/ui/phone-input.tsx` (shadcn `Select` + flag emojis, ~60 dial codes, E.164 emit, `parsePhoneValue` greedy prefix parsing) can't be used as-is: it would clash visually with the public inline-style chrome.

## Changes
1. **`src/components/public/PublicField.tsx`** — add a `PublicPhoneField` component in the same inline-style idiom:
   - Dial-code `<select>` styled like `PublicSelect` (38px, 9px radius, `#E3E0D6` border) on the left, tel `<input>` styled like `PublicInput` on the right (flex-1).
   - Dial list, flag, and parsing logic reused from `src/components/ui/phone-input.tsx` — export `COUNTRY_CODES` and `parsePhoneValue` from there and import (no duplication).
   - Emits E.164 (`+<code><digits>`) on change; empty subscriber emits `''` so required-field validation keeps working.
   - Trigger shows flag + code (e.g. 🇲🇽 +52); dropdown lists flag, code, country name.
2. **`src/pages/PublicReferenceSubmit.tsx`** — when `f.type === 'phone'`, render `PublicPhoneField` instead of `PublicInput` (values stay in `r.values[f.key]`, unchanged data shape).

## No changes
- Stored value format stays the existing string (`values[f.key]`) — already E.164-compatible; no backend, migration, or template changes.
- Referee questionnaire (Flow D), QuestionInstrument, template editor untouched.

## Verification
- Reload preview; open a candidate reference-submit link, confirm a `phone`-type referee field renders code selector + input, switching codes prepends correctly, and submitted value lands as E.164.
- `tsgo` typecheck + build log clean.
