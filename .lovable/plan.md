## 1. Public job posting URLs — namespace under careers

**Today.** Every posting lives at `/p/:slug`, regardless of tenant. Virgilio postings open as a generic chromeless page; non-Virgilio postings don't reflect their company's careers slug.

**Target URL shape**
- Standard tenants: `https://app.gogio.io/careers/:companySlug/:postingSlug`
- Virgilio internal org: `https://app.gogio.io/virgilio-careers/:postingSlug`
- Legacy `/p/:slug` kept as a permanent redirect (existing share links keep working).

**Implementation**
1. `src/App.tsx` — add two routes that render the existing `PublicJobPosting` component:
   - `/careers/:companySlug/:postingSlug`
   - `/virgilio-careers/:postingSlug`
   Keep `/p/:slug` mounted to a tiny `LegacyPostingRedirect` component that loads the posting + tenant, resolves the right namespaced URL, and `<Navigate replace>`s to it.
2. `PublicJobPosting.tsx` — accept either `slug` or `postingSlug` from `useParams`. Reuse the existing query (slug-based). After loading the posting + careers settings, if the URL is `/p/:slug`, redirect to the canonical namespaced URL. If the tenant is the Virgilio internal org id (`4b8e739f-2b15-487e-8d31-0a2ce765a8ef`), force the `/virgilio-careers/...` path; else use `/careers/<company_slug>/...`.
3. Update every place that builds a posting URL to the new shape. Helper `buildPostingUrl(posting, tenantId, companySlug)` in `src/lib/postingUrl.ts` (single source of truth):
   - `src/components/jobs/JobPostingsTab.tsx` — both the "Open" link and the copy-to-clipboard.
   - `src/pages/JobDetail.tsx` — the two `window.open(`/p/${activePosting.slug}`)` calls (including the "View posting" hero button).
   - `src/components/jobs/JobHero.tsx` — passthrough already; the parent (`JobDetail`) supplies the click handler.
   - `src/components/jobs/wizard/SummaryStep.tsx` — any preview link.
   - `src/components/settings/CareersPageTab.tsx` — preview link.
4. `JobDetail` already fetches `activePosting`; extend the data it has (or call `careers_page_settings` once per job) so the helper has `company_slug` and the tenant id to decide Virgilio vs careers path.

**Out of scope.** No schema changes, no edge-function changes, no application form behavior changes.

## 2. "Posting Not Found" → canonical empty state

`src/pages/PublicJobPosting.tsx` lines 608-621 still render a bespoke `Card` + `CardHeader`/`CardContent`. Replace with:

```tsx
<div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] px-4">
  <div className="max-w-md w-full">
    <EmptyState
      size="card"
      illustration={<SoftFlag />}
      title="Posting not found"
      body="This job posting is no longer available or the link is incorrect."
    />
  </div>
</div>
```

Add imports for `EmptyState` and `SoftFlag`. Matches the `PublicCareersPage` "Page not found" treatment.

## 3. Notification Center empty state

`src/components/layout/NotificationCenter.tsx` defines a local `function EmptyState()` (lines 146-158) with hand-rolled circle + Inbox icon. Replace its body with the canonical primitive (use `InlineEmpty`-equivalent — `<EmptyState size="card" illustration={<SoftPaper />} title="You're all caught up" body="Mentions, scorecards, and stage moves will appear here as your team works." />`) and rename the local function to `NotificationsEmpty` to avoid colliding with the imported `EmptyState`. Keep the popover height; the canonical card sits centered inside.

## 4. CRM → Companies (Organizations) empty state

`src/components/organizations/OrganizationsTable.tsx` lines 185-198 still use the legacy API (`assetType`, `description`, `fallbackIcon`, `action`). Migrate to the canonical form:

```tsx
<EmptyState
  size="card"
  illustration={<SoftBuilding />}
  title={organizations.length === 0 ? 'No companies yet' : 'No companies match your filters'}
  body={organizations.length === 0
    ? 'Add your first company to start tracking deals and contacts.'
    : 'Try adjusting your search or filters.'}
  primary={organizations.length === 0 && permissions.canCreateOrganizations && onCreateNew ? (
    <EmptyAction icon={<Plus size={16} />} onClick={onCreateNew}>Create company</EmptyAction>
  ) : undefined}
/>
```

## 5. Settings → Members empty + filtered-empty

Two sites in `src/components/members/MembersTable.tsx`:
- **Empty (no members):** lines 235-242 still use legacy props → migrate to canonical `<EmptyState size="card" illustration={<SoftPeople />} ...>` with `EmptyAction` for "Add member".
- **Filtered empty:** lines 326-331 are a raw `<TableRow><TableCell colSpan={6}>No members match your filters</TableCell></TableRow>` → replace with `<TableFilteredEmpty colSpan={6} onClearFilters={clearFilters} />` (already imported elsewhere).

## 6. Candidates → "No matches" centering

`src/components/candidates/CandidateTable.tsx` lines 314-326 render the empty state inside `<CardContent>` above the (hidden) table, so on wide screens the card has the table's full width and the empty content stays left-anchored to the card edge. Fix by wrapping in a centered container so the EmptyState column sits in the middle of the table area:

```tsx
<div className="py-8 flex items-center justify-center">
  <EmptyState size="card" ... />
</div>
```

Apply the same wrapper to the sibling "No candidates yet" branch for consistency.

## Files touched

- `src/App.tsx` — add 2 routes + legacy redirect component import.
- `src/lib/postingUrl.ts` — **new**, single URL helper + Virgilio org id constant.
- `src/pages/PublicJobPosting.tsx` — param fallback, canonical-URL redirect, Posting Not Found empty state.
- `src/components/jobs/JobPostingsTab.tsx` — use helper for open + copy.
- `src/pages/JobDetail.tsx` — use helper for "View posting" + 2nd open.
- `src/components/jobs/wizard/SummaryStep.tsx` — use helper for preview link.
- `src/components/settings/CareersPageTab.tsx` — use helper for preview link.
- `src/components/layout/NotificationCenter.tsx` — replace inline empty.
- `src/components/organizations/OrganizationsTable.tsx` — migrate to canonical EmptyState.
- `src/components/members/MembersTable.tsx` — migrate empty + filtered-empty.
- `src/components/candidates/CandidateTable.tsx` — center the empty branches.

## Validation

1. Create a job posting in a normal tenant → open from Jobs list and JobDetail "View posting"; URL is `/careers/<slug>/<posting-slug>` and page renders.
2. Open an old `/p/<slug>` link → redirects to the namespaced URL.
3. Create a Virgilio posting (org `4b8e739f-...`) → "View posting" lands on `/virgilio-careers/<posting-slug>`.
4. Visit `/p/does-not-exist` → "Posting not found" empty state matches the spec.
5. Open Notifications popover with zero items → canonical empty.
6. CRM → Companies with zero rows and with filtered-out rows → canonical empty.
7. Settings → Members with zero rows and with filtered-out rows → canonical empty + filtered empty in-table.
8. Candidates table with filtered search miss → empty state centered.