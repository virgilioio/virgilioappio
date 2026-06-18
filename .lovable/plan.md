## Scope

Three presentation-only changes. No new logic — reuse existing `useWhatsAppEnabled`, `buildWhatsAppUrl`, `formatE164Display`, `WhatsAppIcon`, and clipboard utilities.

## 1. Add Contact Information card to in-job overview tab

**File:** `src/components/candidates/CandidateProfileSheet.tsx`

In the `activeTab === 'overview'` block (line 1476), insert a new `<Card>` **above** the existing Profile Summary card. Replicate the exact look of the Independent profile's Contact Information card (`IndependentCandidateProfile.tsx` lines 455–471):

- Title: "Contact information", with an "Edit" `ghost` button on the right that opens the existing edit sheet used in this view.
- A `grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4` body with four `ContactPair` rows: Email (mailto link), Phone, Location, Salary expectations.
- Extract the local `ContactPair` primitive from `IndependentCandidateProfile.tsx` into a small shared component `src/components/candidates/profile/primitives/ContactPair.tsx` and import it in both files. Visual markup is copied verbatim — no design changes.

## 2. WhatsApp icon next to phone in both Contact cards

In the new shared `ContactPair` (or a thin wrapper used only for phone), append the `WhatsAppIcon` button right after the phone value when:

```ts
whatsAppEnabled && buildWhatsAppUrl(phone)
```

Pattern mirrors `IndependentCandidateTable.tsx` (lines 503–511): an anchor opening `buildWhatsAppUrl(phone)` in a new tab, `WhatsAppIcon size={14}`, with the same subtle hover treatment used in `CandidateDetailsCollapsible.tsx`. The phone display itself uses `formatE164Display(phone)`.

Apply this in:
- `src/pages/IndependentCandidateProfile.tsx` Contact information card (line 467).
- New in-job Contact card from §1.

`useWhatsAppEnabled()` is called once at the top of each parent file; result passed into the phone row.

## 3. Email + phone inline in the in-job hero meta row

**File:** `src/components/candidates/profile/ProfileHeroCard.tsx`

Extend `ProfileHeroCardProps` with:
```ts
email?: string | null
phone?: string | null
whatsAppEnabled?: boolean
```

In the meta row (lines 179–215, between existing `Applied {applied}` and `Full profile`), append two new inline chips matching the existing `font-inter text-[12.5px] text-[#5A6072]` style and `·` separators:

- **Email chip:** `Mail` icon + email text + small `Copy` icon button (writes to clipboard via existing `src/utils/clipboard.ts`, shows toast "Email copied").
- **Phone chip:** `Phone` icon + `formatE164Display(phone)` + `Copy` icon button (toast "Phone copied") + `WhatsAppIcon` link when `whatsAppEnabled && buildWhatsAppUrl(phone)`.

Both chips render only when the value exists. Icons are 12–14px to fit the line height; no layout/spacing changes elsewhere.

**File:** `src/components/candidates/CandidateProfileSheet.tsx` — pass `email`, `phone`, `whatsAppEnabled` props into `<ProfileHeroCard>` at line 1209. `whatsAppEnabled` comes from `useWhatsAppEnabled()` already used in this file (verify; if not, add the import).

## Out of scope

- No changes to Profile Summary card, sidebar, tabs, or any other section.
- No schema or hook changes.
- No restyling of the Independent profile Contact card beyond adding the WhatsApp icon.
