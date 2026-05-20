# Find — empty/new-search canvas + header + sidebar polish

Scope: this round refines the Find page in its **empty / new-search** state to match the screenshot. Three surfaces change: the page header counters, the left sidebar (Search criteria), and the main canvas ("Who are you looking for?"). No data layer or backend work.

## 1. Page header — `src/pages/Find.tsx`

- Replace the counter row with three dot-separated markers in this order:
  - `● 4 saved searches` — lilac dot pill (`Badge tone="lilac" size="sm" dot`) showing `useSourcingProjects().data.length`.
  - `412 sourcing credits` — plain text from `useSourcingCredits` (no pill).
  - `Renews Jun 1` — plain text from credits renewal date.
  - Separators: `·` middle-dot in `text-text-tertiary`.
- Top-right buttons change from `My searches` + `+ New search` to **`My searches`** (secondary, Bookmark icon) + **`Sourcing settings`** (secondary, Sliders icon, routes to settings/sourcing). Remove the `+ New search` button — starting a new search is implicit on the canvas.
- Header padding + `animate-fade-in` already match Jobs; keep as-is.

## 2. Left sidebar — `src/components/sourcing/FindFilterPanel.tsx`

- Add a one-line subtitle directly under `Search criteria` header: `Start with a prompt — Gio will fill these in.` (`text-body-sm text-text-tertiary`, no margin override).
- `Job titles` section header: add a small lilac `✨ AI` pill on the right of the row (Badge `tone="lilac" size="xs"` with Sparkles icon, no `dot`). Implies Gio will autofill this section.
- `Skills & keywords` block:
  - Input placeholder `Add skills...` (already correct).
  - Below the input, render a `SUGGESTED BY GIO` micro-label (`text-[10px] uppercase tracking-[0.06em] font-medium text-text-tertiary`).
  - Render 4 suggestion chips: `+ Prototyping`, `+ User research`, `+ UI engineering`, `+ Accessibility`. Style: pill-shaped lilac (`bg-virgilio-lilac/40 text-virgilio-purple hover:bg-virgilio-lilac/60`), 24h, 11.5px Poppins medium, leading `Plus` icon at 0.65 opacity, `border border-virgilio-purple/15`. Click adds keyword to the skills array.
  - For now suggestions are static; if `project.search_criteria.suggested_skills` exists later, swap in. Hide block when array empty.
- `Locations`: keep current input + `Include remote candidates` toggle. Ensure label reads exactly `Include remote candidates` with the globe icon.
- `Experience`: keep range slider, ensure label reads `Years` on the left and `0y – 30y` on the right (with en-dash).
- Footer CTA: bottom-stuck button `<Button variant="purple" size="lg" icon={Sparkles}>Find candidates</Button>` full-width inside the card, with caption `Preview is free · Collect uses 1 credit each · {N} remaining` (`text-body-sm text-text-tertiary text-center`).

## 3. Empty canvas — `src/components/sourcing/SourcingProjectView.tsx` (or a new `FindEmptyState.tsx` when no `projectId`)

When the user has no active project / hasn't started a search, render this canvas inside the right card (white, rounded-xl, hairline border, no shadow):

a) **Top bar inside the card** (between card top and content):
- Left: small pill `[⬛sparkle] New search` over `0 candidates · refreshed —` (two-line, 32px black rounded-md tile with white sparkle icon, name in `text-ui-button-md`, sub in `text-body-sm text-text-tertiary`) + chevron-down (this is the saved-search dropdown trigger — wire to `SavedSearchSelector`'s `trigger` prop).
- Right: ghost link `💡 Examples` opening a dialog/popover (out of scope: just render the button, no-op for now).

b) **Hero block** (centered, max-w ~640px, `pt-12 pb-8`):
- Purple gradient circle 96px (`bg-gradient-to-br from-virgilio-purple to-virgilio-purple/70`) with a white sparkle icon and a 12px green status dot bottom-right.
- Headline: `Who are you looking for?` — `text-h2 font-poppins font-semibold`, the `?` colored `text-virgilio-purple`. Use `StyledPageTitle` pattern but for `?` instead of `.`.
- Sub copy: `Describe the role in your own words. Gio turns it into a search and pulls preview profiles you can browse for free — collect the ones you want.` (`text-body-md text-text-secondary text-center`).

c) **Prompt composer** (max-w ~720px, full-width white surface, hairline border `border-border`, `rounded-xl`):
- `<Textarea>` borderless, 3 rows, placeholder `Senior product designer with design-systems experience at a B2B SaaS startup. Open to remote (US), 6+ years...`. On Enter (without Shift) → trigger search (existing handler).
- Footer row inside same card, separated by `border-t`:
  - Left chips (ghost buttons, `text-body-sm`): `📎 Attach JD`, `🔗 Paste LinkedIn URL`, `💼 Use an open job` (these stay no-op for now — handlers wired in a follow-up).
  - Right: `⌘+Enter` kbd hint (`text-[10px] text-text-tertiary bg-[#F1F0EC] rounded px-1.5 py-0.5`) + primary `<Button variant="purple" icon={Sparkles} iconRight={ArrowRight}>Find candidates</Button>`.

d) **Info banner** (lilac surface, `bg-virgilio-lilac/25`, 12px radius, hairline `border-virgilio-purple/15`, `p-3`, Info icon purple): `Gio returns ~80–120 preview candidates. Browsing is free. Spend 1 credit per candidate to reveal email, phone, full work history and resume.`

e) **Try a starting point** section:
- Section label `TRY A STARTING POINT` (small caps micro-label).
- 2×2 grid of preset cards, each: 40px lilac square tile with a topic icon (Code2 / TrendingUp / Users / Sparkles), title bold (`text-body-md font-semibold`), one-line meta (`text-body-sm text-text-tertiary`), `↗` arrow top-right. Hairline border, white bg, hover `bg-[#FAFAF7]`. Click prefills the prompt textarea.
- Presets (static): `Sr. Backend Engineer (Go)` / `5+ yr · Stripe / Plaid alumni`; `Growth PM, B2B SaaS` / `PLG · self-serve · NY or remote`; `Account Exec, US East` / `Enterprise · $50k+ ACV`; `Applied ML engineer` / `LLM eval · agents · 4+ yr`.

f) **Continue a saved search** section (only when projects exist):
- Section label `CONTINUE A SAVED SEARCH`.
- Inline row of rounded-full chips, one per recent project (max 4): `📑 {name} [count] 🔗 · {Xd ago}`. Pill chrome: white, hairline, `h-9 px-3`, bookmark icon purple, count as `Badge tone="neutral" size="xs"`, link icon green when project linked to a job, time `text-text-tertiary`. Click → navigate to that project.

## Out of scope

- Actual `Examples` dialog content.
- Wiring `Attach JD` / `Paste LinkedIn URL` / `Use an open job` actions.
- Results view (rows, AI summary, tabs) — handled in a later round once the empty state ships.
- Filter logic changes; the sidebar still drives `FindFilterPanel`'s existing state.

## Technical notes

- Counters in header use `useSourcingProjects` (length) and `useSourcingCredits` (balance + renewal). Format renewal as `Renews {MMM d}` via `date-fns`.
- New empty-state component file: `src/components/sourcing/FindEmptyState.tsx`. `SourcingProjectView` renders it when `!project || project.total_candidates === 0 && !project.search_criteria?.prompt`. Otherwise renders the existing results view (unchanged this round).
- Suggestion chips are local state in `FindFilterPanel` for now (hard-coded list); follow-up wires them to `project.search_criteria.suggested_skills`.
- All colors come from semantic tokens (`virgilio-purple`, `virgilio-lilac`, `text-text-*`, `border-border`); no raw hex except the table hover `#FAFAF7` already in tokens.
