

# Phone Number Normalization for WhatsApp Compatibility

## Problem
Phone numbers are stored with spaces, dashes, and inconsistent formatting, breaking the WhatsApp integration (Twilio requires E.164: `+5213332555660`).

## Changes

### 1. Fix `PhoneInput` component to output clean E.164
**File:** `src/components/ui/phone-input.tsx`
- Change `onChange` to emit E.164 format with no spaces/dashes: `+15551234567`
- Strip all non-digit chars from subscriber number before combining with country code
- The country code selector already exists — just fix the output format

### 2. Replace plain `<Input>` with `<PhoneInput>` in CandidateFormSheet
**File:** `src/components/candidates/CandidateFormSheet.tsx` (lines 754-764)
- Replace `<Input id="phone" {...form.register('phone')} />` with `<PhoneInput>` using controlled value/onChange via `form.watch`/`form.setValue`
- Add E.164 sanitization in `handleSubmit` (line 491): strip all non-digit/non-plus chars

### 3. Update `ContactPhonesInput` for IndependentCandidateForm
**File:** `src/components/candidates/ContactPhonesInput.tsx`
- Replace the plain `<Input type="tel">` with the `PhoneInput` component
- Remove the separate type selector (PhoneInput handles country code; keep the work/mobile/other type selector)
- Ensure `onChange` stores clean E.164 numbers

### 4. Display formatting in profile views
**Files:** `CandidateProfileSheet.tsx`, `IndependentCandidateProfileSheet.tsx`
- Create a `formatE164Display(phone: string)` utility that formats `+5213332555660` as `+52 13332555660` (country code + space + subscriber number) by matching against known country codes
- Apply this formatter wherever phone numbers are displayed in candidate details

### 5. Utility function
**File:** `src/utils/phoneUtils.ts` (new)
- `sanitizeToE164(phone: string): string` — strips all non-digit/non-plus chars
- `formatE164Display(phone: string): string` — adds a single space after country code for readability
- Reusable across forms, display, and edge functions

