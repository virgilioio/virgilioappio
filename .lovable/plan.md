# Match Offer Details field list to Application card

Restyle the field list inside `CandidateOfferDetails` so each row mirrors the Application card pattern in the bottom-right of the candidate profile. Keep the header (title + status badge + Edit button) and all banners/buttons exactly as they are today.

## Reference pattern (from `ProfileApplicationCard.tsx`)

- Hairline-divided list (`divide-y divide-virgilio-border/60`), no per-row card chrome.
- Each row: `flex items-center justify-between py-2.5 first:pt-0 last:pb-0`.
- Left: icon (3.5×3.5, `text-text-tertiary`) + label, `text-[13px] font-poppins text-text-secondary`.
- Right: value, `text-[13px] font-poppins text-text-primary text-right truncate`.

## Changes in `CandidateOfferDetails.tsx`

1. Replace the grid of `text-form-label` / `text-body-md` blocks (Offer Title + dynamic fields loop) with a single `<dl>` that uses the Application-card row styling.
2. Pick an icon per field type so each row has a left glyph consistent with the Application card:
   - `salary` → `DollarSign`
   - `location` / `work_location` → `MapPin`
   - `date` → `Calendar`
   - `employment_type` → `Briefcase`
   - `recruiter` → `User`
   - `checkbox` → `BadgeCheck`
   - text / fallback → `FileText` (or a neutral dot)
   - "Offer Title" row → `FileText`
3. Keep value formatting helpers (`formatLocationValue`, `formatSalaryValue`, employment/work-location label maps, recruiter lookup, date formatting) unchanged — only the wrapper markup/classes change.
4. Leave the empty-state, loading, header row, banners, and inline approve/decline forms untouched.

## Out of scope

- No changes to header, status badge, Edit button, action buttons, banners, or approval forms.
- No business-logic changes.
