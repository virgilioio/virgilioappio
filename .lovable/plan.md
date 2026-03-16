

# UI Changes: CandidateCard + CandidateProfileSheet

## 1. CandidateCard (Pipeline View) — LinkedIn Icon

**`src/components/jobs/CandidateCard.tsx`**
- Replace `ExternalLink` icon with `LinkedInFilled` icon from `@/components/icons/LinkedInFilled`
- Keep the same `<a>` tag with `target="_blank"` behavior
- Style: blue LinkedIn color instead of generic primary

## 2. CandidateCard (Pipeline View) — WhatsApp Phone Link

**`src/hooks/usePipelineActions.ts`**
- Add `phone` to `PipelineAssociation` interface
- Fetch `phone` alongside `candidate_name, linkedin_url` from candidates table
- Map it into the result

**`src/components/jobs/PipelineOverview.tsx`**
- Pass `phone={assoc.phone}` to `CandidateCard` (both regular and drag overlay instances)

**`src/components/jobs/CandidateCard.tsx`**
- Add `phone?: string | null` to props
- Import `WhatsAppIcon`, `useWhatsAppEnabled`, `buildWhatsAppUrl`, `formatE164Display`
- Below the LinkedIn row, render a phone row: `[WhatsAppIcon] [formatted phone]` linking to `wa.me`
- WhatsApp icon only shows if `whatsAppEnabled` and phone exists; phone number always shows if available
- The WhatsApp click behavior on the card will be simple — just open `wa.me` link (no template logic on the card, since there's no space for that complexity; template logic stays in the profile sheet)

## 3. CandidateProfileSheet — Rename "Job Application" to "Job Overview"

**`src/components/candidates/CandidateProfileSheet.tsx`**
- Line 1087: Change tab label from `'Job Application'` to `'Job Overview'`
- Line 1100: Change `<CardTitle>` from `Job Application` to `Job Overview`
- Line 1096 comment update

**`src/pages/CandidateProfile.tsx`**
- Line 314: Same rename for the standalone page

## 4. CandidateProfileSheet — Move Candidate Details to Job Overview tab

**`src/components/candidates/CandidateProfileSheet.tsx`**

Move the Candidate Details card (currently in the "Overview" tab, lines ~1352-1550) into the "Job Overview" tab, **above** the job stages accordion (before line 1098).

The card will be a `Collapsible` (not Accordion, since it's standalone):
- **Collapsed state (default)**: Shows a compact row with:
  - Email (with copy icon) if available
  - Phone (with copy icon + WhatsApp icon if enabled) if available
- **Expanded state**: Shows the full existing content (emails, phones, LinkedIn, location, salary)

Remove the Candidate Details `AccordionItem` from the Overview tab to avoid duplication.

## 5. CandidateProfileSheet — Reorder Right Tabs + Default to Insights

**`src/components/candidates/CandidateProfileSheet.tsx`**
- Line 126: Change default `rightActiveTab` from `'feed'` to `'insights'`
- Lines 1772-1777: Reorder tabs array to: Insights, Emails, Notes, Reminders, Feed
  ```
  [
    ...(!isRestrictedViewer ? [{ value: 'insights', label: 'Insights', Icon: Sparkles }] : []),
    ...(!isRestrictedViewer ? [{ value: 'emails', label: 'Emails', Icon: Mail }] : []),
    { value: 'notes', label: 'Notes', Icon: StickyNote },
    ...(!isRestrictedViewer ? [{ value: 'reminders', label: 'Reminders', Icon: Bell }] : []),
    { value: 'feed', label: 'Feed', Icon: Activity },
  ]
  ```

## Files Changed

| File | Changes |
|------|---------|
| `src/components/jobs/CandidateCard.tsx` | LinkedIn icon swap, add WhatsApp+phone row |
| `src/hooks/usePipelineActions.ts` | Add `phone` to PipelineAssociation + fetch |
| `src/components/jobs/PipelineOverview.tsx` | Pass `phone` prop to CandidateCard |
| `src/components/candidates/CandidateProfileSheet.tsx` | Rename tab, move Candidate Details card to Job Overview as collapsible, reorder right tabs, default to Insights |
| `src/pages/CandidateProfile.tsx` | Rename "Job Application" to "Job Overview" |

