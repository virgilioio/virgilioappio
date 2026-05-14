# Convert the job-associated candidate profile from overlay → real page

## Problem

The redesigned candidate profile in `CandidateProfileSheet.tsx` is rendered as a `position: fixed` overlay mounted by `JobDetail.tsx` via `UniversalCandidateProfileSheet`. Clicking a candidate just toggles `?candidate=<id>` and slides the overlay over the job page. The user wants it to behave like the rest of the app: a real route (`/jobs/:jobId/candidates/:candidateId`) that renders inside the standard `Layout` chrome (floating sidebar + floating header), with its own URL and back-button history.

A route already exists in `App.tsx`:

```
<Route path="/jobs/:jobId/candidates/:candidateId" element={<CandidateProfile />} />
```

…but it points to the **legacy** `src/pages/CandidateProfile.tsx`, which uses the old UI. The redesigned UI never sees this route.

## Fix

### 1. Make `CandidateProfileSheet` page-aware

**File:** `src/components/candidates/CandidateProfileSheet.tsx`

Add an optional `asPage?: boolean` prop (default `false`).

Swap the outer wrapper based on the mode:

- **Overlay mode (existing, kept for Pipeline / Candidates / Apollo previews):**
  ```tsx
  <div className="fixed top-[4.5rem] left-3 right-3 bottom-3 sm:left-[5.5rem] z-40 bg-background overflow-hidden rounded-2xl ring-1 ring-virgilio-border/60 shadow-calendly">
  ```
- **Page mode (`asPage`):**
  ```tsx
  <div className="min-h-[calc(100vh-4.5rem)] bg-background">
  ```
  No fixed positioning, no z-index — it sits inside `Layout`'s `<main>`, which already pads for sidebar (`sm:pl-[5.5rem]`) and header (`sm:pt-16`).

Inner layout (`flex h-full w-full` → `flex flex-col w-full` in page mode) and the scroll container switch from `overflow-y-auto` on a fixed parent to natural document scroll.

`ProfileTopBar`'s "Back to job" already calls `onClose`. In page mode, `onClose` is wired to `navigate(\`/jobs/\${jobId}\`)`.

### 2. Rewrite `src/pages/CandidateProfile.tsx`

Replace the entire file with a thin route wrapper:

```tsx
export default function CandidateProfile() {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>()
  const navigate = useNavigate()
  const { candidates } = useCandidates(jobId || '')

  const idx = candidates.findIndex(c => c.id === candidateId)
  const hasPrev = idx > 0
  const hasNext = idx >= 0 && idx < candidates.length - 1

  const go = (id: string) => navigate(`/jobs/${jobId}/candidates/${id}`)

  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <JobAssignmentGuard>
          <CandidateProfileSheet
            asPage
            open
            onOpenChange={() => navigate(`/jobs/${jobId}`)}
            jobId={jobId!}
            candidateId={candidateId!}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onNavigatePrev={() => hasPrev && go(candidates[idx - 1].id)}
            onNavigateNext={() => hasNext && go(candidates[idx + 1].id)}
          />
        </JobAssignmentGuard>
      </PermissionGate>
    </AuthGate>
  )
}
```

This removes the entire legacy old-design page (~720 lines). All UI is reused from the new component.

### 3. Route candidate clicks in `JobDetail.tsx` to the page

**File:** `src/pages/JobDetail.tsx`

Inside `openProfileInPlace` (line ~152), branch by context:

- `context === 'suggested'` (Apollo / PDL previews): keep the existing overlay flow — those need in-place because they may not have a real candidate row yet.
- Otherwise (`'application'`, `'pipeline'`): `navigate(\`/jobs/\${jobId}/candidates/\${candidateId}\`)` and skip `setProfileOpen(true)`.

Also remove the `?candidate=<id>` URL-sync useEffect at line ~615 for the non-suggested path so it doesn't re-open the overlay after navigation. The overlay continues to exist only for the Apollo/suggested branch.

Remove `<CandidateProfileSheet>` mount for non-suggested contexts at line ~1295; keep the `<UniversalCandidateProfileSheet>` mount at line ~1267 (suggested/Apollo only).

### 4. Leave Pipeline / Candidates pages alone

Other entry points (`Pipeline.tsx`, `Candidates.tsx`, search dialog) keep opening the overlay — they're cross-job or independent contexts where a per-job route doesn't apply. No changes needed.

## Out of scope

- IndependentCandidateProfile and Apollo preview sheets (not job-associated).
- No design changes to the hero card, tabs, action bar, quick actions, application card.
- No backend or RLS changes.

## Files touched

- `src/components/candidates/CandidateProfileSheet.tsx` — add `asPage`, swap outer wrapper.
- `src/pages/CandidateProfile.tsx` — full replacement with thin wrapper.
- `src/pages/JobDetail.tsx` — `openProfileInPlace` branches by context, drop URL-sync + sheet mount for non-suggested.
