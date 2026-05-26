# Apollo Preview Sheet — Collected (post-collect) view

Rebuild the post-collect body of `ApolloPreviewSheet.tsx` to mirror the two screenshots. UI work only (one edge-function field passthrough + one extra DB read). No new tables, no business-logic changes.

## Backend (1 small change)

`supabase/functions/enrich-apollo-profile/index.ts` — extend each `results[]` item pushed at line 556 so the apollo signals don't get lost after collection:

```ts
results.push({
  apollo_id: person.id,
  candidate_id: candidateId,
  already_collected: false,
  email: person.email,
  phone,
  // new — passthrough from Apollo
  headline: person.headline,
  seniority: person.seniority,
  departments: person.departments,
  email_status: person.email_status,
  apollo_collected_at: collectedAtIso,
})
```

Mirror the same passthrough for the already-collected branch (read the existing candidate's `email_status`, `bio` for headline; `seniority`/`departments` are not persisted, so default to `null` in that branch). The frontend gracefully omits absent fields.

## Frontend — `src/components/candidates/ApolloPreviewSheet.tsx`

### Data layer
- Extend `EnrichedCandidateData` to add: `headline`, `email_status`, `seniority`, `departments`, `contact_emails`, `contact_phones`, `apollo_collected_at`, `role_current`, `company_current`, `collected_by_name` (optional), and `employment_history: Array<{ company, title, start_date, end_date, is_current, description }>`.
- In `handleCollectProfile`, after the candidate row select, also:
  - Read `email_status, bio, contact_emails, contact_phones, role_current, company_current, apollo_collected_at` from `candidates`.
  - Fire a second select on `candidate_work_experience` ordered by `start_date desc` for the employment timeline.
  - Pull `headline / seniority / departments` from the edge response (`collectedResult`).

### `IdentityBlock` — collected variant
Reuse current block, but when `isCollected`:
- Show `bio/headline` in italics under the name+chips line.
- Compose location chip from `city · state · country`.
- Show inline meta row with `Senior` (seniority) chip and `Design · Product` (departments joined) chip using existing tone tokens.
- Right-side score card stays (Keyword fit 94 · 4 of 4 keywords) — reuse existing `keywordMatches` + fit logic; it works post-collect too.

### New post-collect body (replaces lines 744–897)
Stack of cards inside `flex-1 overflow-y-auto p-6 space-y-5`:

1. **Contact strip** — 3 cards in a `grid grid-cols-3 gap-3`:
   - `WORK EMAIL` label + `<Badge tone="green" dot>Verified</Badge>` (from `email_status`); body = `email` as link; subline `+ N personal: …` from `contact_emails` minus primary.
   - `MOBILE` + `<Badge tone="green" dot>Delivered</Badge>` if phone present; body = `phone` link; caption `From Apollo phone webhook · {timeAgo}` using existing relative-time helper.
   - `LINKEDIN` (no badge); body = `linkedin.com/in/<handle>` link; caption `linkedin_url`.

2. **Apollo signals card** (`CardShell` title `Apollo signals`, right caption `Normalized by Apollo`):
   - 3 columns: `SENIORITY` (lilac badge), `DEPARTMENTS` (multi blue/purple badges), `EMAIL STATUS` (green dot badge `verified`).

3. **Why Gio thinks this is a fit** — reuse existing pre-collect card verbatim (already in `PreCollectBody`); render via `keywordMatches` and the existing `MATCH_*` map.

4. **Matched keywords** — reuse existing matched-keywords card from `PreCollectBody`.

5. **Employment history card** (`CardShell` title `Employment history`, right caption `{n} roles · employment_history[]`):
   - Vertical timeline of rows (avatar square with first letter, title, company, `start_date – end_date | Present`, `Current` green-dot badge when `is_current`, description paragraph).
   - Connect avatars with a 1px `border-l` rail (already a pattern in the app — match the screenshot's slim grey vertical line).

6. **Dashed-info note** (no card chrome — `border border-dashed rounded-lg p-4 flex gap-3`):
   - `Info` icon, copy: *"Education, resume, GitHub, Twitter and headshot aren't part of Apollo's enrichment response. They show up once a candidate applies or you upload a resume to their profile."*

### New post-collect footer
Replace the current "Profile Collected" green callout with a fixed bottom bar similar to `PreCollectFooter`:
- Left: `Collected by you · {relTime(apollo_collected_at)} · Apollo refreshed {refreshedLabel}` (text-tertiary, 12.5px).
- Right buttons (Gio Foundation, in this order):
  - `<Button variant="secondary" icon={Bookmark}>Save to talent pool</Button>`
  - `<Button variant="secondary" icon={Mail}>Reach out</Button>` (opens existing email composer hook — reuse `onCandidateCollected`'s downstream)
  - `<Button variant="primary" icon={UserPlus}>Add to job</Button>` (opens `JobSelectionDialog` for cross-job add; if already added shows toast).

### Render wiring
At line 906 swap `PostCollectBody` → new component and add `{isCollected && PostCollectFooter}` next to the existing `!isCollected && PreCollectFooter`.

## What's intentionally out of scope
- No schema migrations. Seniority/departments rely on the in-session enrich response; if a user reopens an already-collected candidate from another session, those two chips simply hide (the rest of the card still renders).
- "Reach out" wires to the existing email composer entry point already used elsewhere in the codebase; no new email feature.
- Pre-collect view, footer, and overall sheet width/chrome are unchanged.

## Verification
1. Run a search, open a fresh Apollo preview → click **Collect**.
2. Confirm the body switches to the new layout matching screenshots 1 and 2 (contact strip, Apollo signals, Why Gio, Matched keywords, Employment history, dashed note).
3. Confirm the new footer shows the timestamp line + Save / Reach out / Add to job buttons.
4. Confirm relative timestamps follow the `Xd` convention (project core rule).
5. Re-open the same candidate (already-collected branch) — apollo signals card hides its empty columns instead of erroring; everything else still renders from the DB.
