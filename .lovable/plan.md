# Apollo Preview Sheet — polish pass

Four targeted fixes inside `src/components/candidates/ApolloPreviewSheet.tsx` (plus one upstream data fix). No logic, no data, no post-collect changes.

## 1. "First Name: Unknown" bug

**Cause:** `SourcingCandidateTable.tsx` line 818 passes the raw `candidate` object as `apolloData`. That object exposes the name on `full_name` (PDL) or `candidate_name` (Apollo). When only `full_name` is set, `apolloData.candidate_name` is `undefined`, so `rawName` falls back to `"Unknown Candidate"` and `firstName` becomes `"Unknown"`.

**Fix:**
- In `ApolloPreviewSheet.tsx`, widen `rawName` resolution: `enrichedData?.candidate_name || apolloData?.candidate_name || (apolloData as any)?.full_name || 'Unknown Candidate'`.
- Also widen the prop type on `apolloData` to accept an optional `full_name?: string` so the call sites stay clean.

## 2. "How they match the search" card — use Gio Badges

- Sparkles icon in the `CardShell` header gets a brand tint: `text-virgilio-purple` (replacing `text-text-tertiary`). Same treatment for the `Lock` icon on the "What you'll get on collect" header.
- Delete the local `MatchChip` component. Render via `<Badge>`:
  - `match` → `<Badge tone="green" dot>Match</Badge>`
  - `partial` → `<Badge tone="yellow" dot>Partial</Badge>`
  - `inferred` → `<Badge tone="yellow" dot>Inferred</Badge>` (lilac if we want to read as "AI-inferred" — pick `lilac` to match badge-tones convention for AI signals)
  - `miss` → `<Badge tone="neutral" dot>No match</Badge>`
- Delete the local `KeywordChip`. Render via `<Badge>`:
  - matched → `<Badge tone="green" icon={Check}>{label}</Badge>`
  - not matched → `<Badge tone="neutral" bordered>{label}</Badge>` (so unmatched still reads as a chip but neutral)
- Row icons (Briefcase / Building2 / MapPin) gain subtle tone tinting that mirrors the badge tone (green / yellow / neutral) so the row reads at a glance.

## 3. "What you'll get on collect" card — colored icons + Gio Badges

- Replace the gray `bg-surface-secondary` icon square with a tone-tinted square keyed off availability:
  - available → `bg-pastel-green text-pastel-green-foreground`
  - not in record → `bg-muted text-text-tertiary`
- Replace the inline `Available` / `Not in record` pill with `<Badge>`:
  - available → `<Badge tone="green" dot size="xs">Available</Badge>`
  - not in record → `<Badge tone="neutral" size="xs">Not in record</Badge>`
- Keep grid layout, sublabels, group labels, and the amber "Apollo doesn't return…" callout as-is.

## 4. Sticky footer — match Create Job wizard

Mirror `src/components/jobs/JobWizard.tsx` lines 414–462 exactly:

- Container: `border-t border-virgilio-border bg-[#F6F5F1]/95 backdrop-blur px-6 sm:px-10 py-4 flex items-center justify-between gap-4`.
- Remove the decorative purple Lock tile and the two-line headline.
- Left cluster:
  - `<Button variant="ghost" onClick={handleNavigateNext} disabled={!hasNext}>Skip</Button>`
  - Helper line (hidden on mobile): `text-[12px] text-text-tertiary` reading `Uses 1 credit · {remaining} remaining this month` (only when `remainingCredits !== null`).
- Right cluster (matches wizard's secondary + primary pairing):
  - `<Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>`
  - `<Button onClick={triggerCollect} loading={isCollecting} disabled={isCollecting || isCollectDisabled} icon={Lock}>Collect · 1 credit</Button>`
  - Primary uses the default Button variant (citron-noir), matching the wizard's CTA and per the Buttons core rule (one primary per surface, no `purple` override here).

## Files

- `src/components/candidates/ApolloPreviewSheet.tsx` — fixes 1–4, delete `MatchChip` and `KeywordChip` locals, simplify `AvailabilityFieldCard`, rewrite `PreCollectFooter`.

No backend, no hooks, no post-collect view changes.
