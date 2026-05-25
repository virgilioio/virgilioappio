## Redesign the Apollo preview sheet (pre-collect state)

Replace the current pre-collect view inside `ApolloPreviewSheet.tsx` with the exact structure from the reference. The post-collect view is **not** touched in this task.

### What the new pre-collect view shows

**Header (top bar + identity block)**
- Existing top bar (prev/next · `N of M · {jobTitle}` · Not a fit · Save for later · ⋯ · close) — kept as-is.
- Identity block:
  - Avatar (initial) · `Jordan V***a` (obfuscated last name from Apollo) · `Preview · pre-collect` lock pill
  - Subline: `Lead Product Designer` at `Plaid`
  - Meta row: `Source: Apollo` · `Apollo refreshed Xd ago` · `apollo_id 6b3e2f` (mono)
  - Right side: `KEYWORD FIT` chip with score `86` and `3 of 4 keywords` caption (green when ≥75, amber 50–74, neutral otherwise).

**Card 1 — "What we know now"** (header right caption: `From Apollo search · 6 fields`)
- 2-column grid of label/value rows: First name, Last name (`V***a (obfuscated)`), Title, Company, Source (`Apollo`), Refreshed (`5d ago`).
- Helper line in muted surface below: "**That's it.** Apollo's search endpoint is intentionally lean — last name, exact location, LinkedIn URL, email, phone, employment history, seniority and departments are all gated behind enrichment."

**Card 2 — "How they match the search"** (header right caption: `Computed locally`)
- Rows with right-aligned tone chips:
  - `Role` — "Lead Product Designer (search asks for {target})" · chip `Match` (green) / `Partial` (amber) / `Inferred` (amber)
  - `Company` — "{company} · industry hint available on enrichment" · `Inferred` chip
  - `Location` — "City available · exact text hidden until collect" · `Inferred` chip
- Sub-block: `KEYWORD MATCHES (N OF M)` with one chip per search keyword — green check + label when matched, neutral outline when not.

**Card 3 — "What you'll get on collect"** (lock icon in title; right caption: `Apollo says: yes / no`)
- Grouped 2-column grid of "field cards" (icon · label/sublabel · availability pill on the right):
  - **PERSON**: Verified work email, Direct mobile phone (sublabel "Delivered async via webhook"), Exact city + state, Country
  - **COMPANY**: Industry, Employee count, Revenue band, Company phone
  - **ALWAYS RETURNED ON ENRICHMENT**: Real last name, LinkedIn URL, Full work history + descriptions (sublabel "Every role · titles, dates, summaries"), Seniority + departments (sublabel "Normalized levels & function tags")
- Each card shows a green ✓ `Available` pill, or a muted `Not in record` pill when Apollo's flag is false (driven by `apolloData.has_email`, `has_phone`, `has_location` — others default to `Available` since they're always returned by `bulk_match`).
- Footer note in an amber-tinted info banner: "Apollo doesn't return education, photo, GitHub or Twitter in this endpoint. Resume, scorecards and Gio signals come once the candidate is in your job's pipeline."

**Sticky footer (existing)**
- Left: lock icon · "Collect to reveal the 12 fields above." · sub: "Uses 1 credit · {N} remaining this month"
- Right: `Skip` (ghost) · `Collect · 1 credit` (purple primary). Both wired to existing handlers (`onNavigateNext` / `handleCollectProfile`).

### What gets removed from the pre-collect view

- Gio's Take typewriter / mascot block
- Recommendation banner (`getRecommendation`)
- Intent match bullets section (`IntentMatchBullet` list)
- Inferred career snapshot / expandable accordion
- The standalone fit-score header tile that isn't the keyword-fit chip
- `MatchLabel` "Strong/Medium/Weak" pills (replaced by the new Match/Inferred chips inside Card 2)

The `previewInference`, `calculateFitScore` and `generateEnrichedGioTake` helpers stay in the file system for now (still used by post-collect / fit chip math) but are no longer rendered in the pre-collect tree. `useCandidatePreviewStatus` (shortlist/not-a-fit) and `handleCollectProfile` keep their current behavior — only the JSX between the header and the sticky footer is rebuilt.

### Files touched

- `src/components/candidates/ApolloPreviewSheet.tsx` — rewrite the pre-collect JSX block; keep state, hooks, collection flow, post-collect branch, and props untouched. Add small local subcomponents (`KnownFieldRow`, `MatchRow`, `AvailabilityFieldCard`, `KeywordChip`) inside the file to keep blast radius minimal.

### Visual system

All styling uses existing Gio Foundation tokens — Poppins for labels/headings, Inter for body, `Card`, `Badge` (tones: `green` for Match/Available, `yellow` for Inferred, `neutral` for Not in record, `purple` for the lock pill), no new colors. Spacing matches the screenshots (cards: rounded-xl, 1px hairline border, p-5; rows: 12px vertical rhythm).

### Out of scope

- Post-collect view rendering — separate follow-up task.
- Edge function changes — no backend work; we only consume `apolloData` already passed in.
- Data shape changes — relying on existing `apolloData` props plus `searchCriteria.title_keywords` for keyword fit calculation (already computed by `calculateFitScore`).
