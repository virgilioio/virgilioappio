

# Rename "Contact Information" to "Candidate Details" + Add Location + Restructure Independent Right Column

## Three changes across two files

### 1. Rename "Contact Information" → "Candidate Details" (both profiles)

**`CandidateProfileSheet.tsx`** (line 1287): Change `<CardTitle>Contact Information</CardTitle>` to `<CardTitle>Candidate Details</CardTitle>`

**`IndependentCandidateProfileSheet.tsx`** (line 441): Same rename.

### 2. Add Location fields to the Candidate Details card (both profiles)

After the LinkedIn section and before closing `</CardContent>`, add a Location block showing City, State/Province, and Country from `candidate.location_city`, `candidate.location_state`, `candidate.location_country`. Only render if at least one field exists. Use a `MapPin` icon with the same styling pattern as email/phone rows.

### 3. Restructure right column in Independent profile (lines 781-851)

**Remove**: The entire right-column tabs (Feed, Notes, Emails, Reminders) and the `CandidateNameCard` tab navigator, plus `rightActiveTab` state.

**Replace with** standalone cards stacked vertically:
1. **Candidate Details** card (moved from left accordion)
2. **Career Summary** card (moved from left accordion)
3. **Attachments** card (moved from left accordion)
4. **URLs** card (moved from left accordion)

**Left accordion keeps**: Profile Summary, Work Experience, Education, Certifications, Skills. Remove `defaultValue` entries for `contact`, `career`.

**Mobile**: Change the right column from `hidden lg:block` to `block` so it shows stacked below on mobile.

**Cleanup**: Remove unused imports (`ActivityFeedList`, `EmailHistoryList`, `CandidateReminders`, `Activity`, `StickyNote`, `Bell`, email reply/forward handlers and state if only used by right column).

### Files changed
- `src/components/candidates/IndependentCandidateProfileSheet.tsx`
- `src/components/candidates/CandidateProfileSheet.tsx`

