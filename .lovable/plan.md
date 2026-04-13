

# Upgrade PDL Profile Sheet to Match Independent Candidate Layout

## Current State

The `PdlCandidateProfileSheet` is a narrow side drawer (`sm:max-w-lg`) with a simple vertical list of sections. The `IndependentCandidateProfileSheet` is a full-width sheet (`w-[96vw]`) with a two-column layout, accordion sections for work experience/education/certifications, career summary card, AI summary banner, and rich contact display.

## What Changes

Rebuild `PdlCandidateProfileSheet` to use the same full-width, two-column layout as `IndependentCandidateProfileSheet`, but sourced entirely from in-memory props (no DB fetch). Features that require DB persistence (edit, AI enrich, resume upload, attachments, URLs, job sidebar) are omitted or replaced with "Add to Pipeline" to unlock them.

### 1. Expand `MatchedCandidate` type

Add fields PDL already returns but the edge function currently discards:

- `experience`: array of `{ company, title, start_date, end_date, is_current, location, summary }`
- `education`: array of `{ school, degree, field_of_study, start_date, end_date }`
- `certifications`: array of `{ name, organization }` (if PDL provides)
- `job_title_levels`: string[] (seniority indicators)
- `industry`: string
- `github_url`, `twitter_url`, `website_url`
- `emails`: array of `{ address, type }` (PDL returns multiple)
- `phones`: array of `{ number, type }`

### 2. Update edge function mapping

In the deployed `sourcing-search` (or `search-pdl-candidates`) edge function, pass through the full `experience[]`, `education[]`, and additional fields from the PDL API response instead of discarding them. This costs zero additional credits — the data is already in the response.

### 3. Rebuild `PdlCandidateProfileSheet`

Mirror the `IndependentCandidateProfileSheet` layout:

- **Full-width sheet** (`w-[96vw]`)
- **Header**: Name with purple period, LinkedIn button, "Add to Pipeline" button, prev/next nav, PDL badge
- **Two-column layout**:
  - **Left column**: 
    - `CandidateNameCard` (email/phone display with copy buttons)
    - Summary section (using `ProfileSummaryMarkdown` if available)
    - Skills (using `EnhancedSkillBadge`)
    - Work Experience (reuse `CandidateWorkExperienceComponent` — map PDL experience array to its interface)
    - Education (reuse `CandidateEducationComponent`)
  - **Right column**:
    - Candidate Details card (emails, phones, LinkedIn, location)
    - Career Summary card (current title, company, years experience, industry)

Sections that don't apply to unsaved PDL candidates (resume, attachments, URLs, AI enrich, edit, job sidebar) are simply not rendered.

### 4. Update `UniversalCandidateProfileSheet`

No changes needed — already routes to `PdlCandidateProfileSheet` when `pdlData` is present.

## Files

| File | Action |
|------|--------|
| `src/hooks/useSourcingProjectCandidates.ts` | **Edit** — expand `MatchedCandidate` with experience/education/extra fields |
| `src/components/candidates/PdlCandidateProfileSheet.tsx` | **Rewrite** — full-width two-column layout matching Independent sheet |
| Edge function (deployed) | **Edit** — pass through experience[], education[], extra PDL fields |

