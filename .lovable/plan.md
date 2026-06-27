
## What's wrong today

**Board background.** The Deals page sets the warm cream `#F6F5F1` (which matches the mock exactly when sampled), but the inner `<Section>` defaults to `bg-surface-primary` (white) and paints over it. That's why the area behind the KPI strip, filter bar and columns currently reads as white instead of the warm cream from the mock.

**Detail sheet.** Last turn I shipped the schema + behavior (won_at/lost_at/lost_reason stamping, paid vs due payments, lost-reason prompt, "Start warranty" label, real Collected/Outstanding math) but did not rebuild the visual shell, so the sheet still looks like the old layout.

## Plan

### 1. Board background — match the mock exactly

- Stop `<Section>` from painting white over the warm wrapper on the Deals page. Either drop the `<Section>` wrapper (keep only `AppContainer` for horizontal padding) or pass a transparent variant. Outer wrapper stays at `#F6F5F1` so it matches the mock pixel-for-pixel.
- No token churn elsewhere; this is a one-line layout fix scoped to `src/pages/Deals.tsx`.

### 2. Deal detail sheet — visual rebuild (no behavior changes)

All wiring stays as it is today (Won/Lost/Move, accordion, billing math, notes, lost reason prompt). Only the shell changes — same family as our other FormSheet panels and the candidate profile sheet.

**Shell**
- Right-side sheet, ~560–600px, scrollable, `p-0`.
- Header band (px-6 pt-6 pb-4, hairline border):
  - Eyebrow: `CRM · DEAL` in 10.5px Inter caps, lilac.
  - Title: deal name in Poppins 600, tracking -0.04em, ~22px, with the brand lilac period accent (`.`) appended — same treatment as our other FormSheet titles.
  - Subtitle row: company name (clickable → company page) · `<Badge>` for stage with stage-type tone · `<Badge>` for amount in deal currency · created Xd ago in muted ink.
  - Right cluster: `Edit` (secondary), kebab menu (Delete inside).

**KPI strip** (4 mini metrics, same Pulse-style cards we use on the board)
- Amount (deal.amount + currency)
- Collected (sum of paid payments)
- Outstanding (Amount − Collected, amber when > 0)
- Days in stage (from `stage_changed_at`, amber chip ≥ 30d)

**Tabs**: Overview · Billing · Notes — same tab bar treatment as the candidate profile sheet (lilac underline, Poppins 12.5).

**Overview tab**
- Stage Actions card: `Move to {next open stage}` (secondary, lilac chevron), `Mark won` (success), `Mark lost` (danger outline → reason prompt). Horizontal scroll on overflow.
- About card: Owner (avatar + name), Expected close date, Probability, Last stage change, Lost reason (only when present).
- Pipeline Stages card: same accordion we have today, restyled with Gio tokens (rounded-lg, hairline border, stage-type tinted header strip, `CheckCircle2`/`Circle` indicators kept).

**Billing tab**
- Billing summary band: Total · Collected · Outstanding (already a component, restyled to match KPI strip typography).
- Invoices card and Payments card kept as-is functionally; rows restyled: 30h, status dot (green for paid, amber for due), label in Inter 13, amount right-aligned Poppins tabular-nums, relative date in muted ink.

**Notes tab**
- Textarea composer (resize-none, 3 rows) + `Add Note` primary, ⌘↵ hint left.
- Notes list: avatar 20px, author Poppins 600 12.5, time muted, body Inter 13.5 with `whitespace-pre-wrap`. Delete only on author's own notes or platform admin (unchanged logic).

**Tokens & rules**
- All colors via semantic tokens (`text-virgilio-text`, `text-virgilio-muted`, `border-virgilio-border/40`, `bg-surface-primary`, lilac via `text-virgilio-purple`). No hex literals in components.
- Typography per style guide (`text-h*`, `text-body-md`, `text-form-label`, `text-ui-button-md`).
- Buttons follow §2: one primary per surface; danger uses `variant="danger"` outline; success uses `variant="success"`.

## Out of scope (this pass)

- No DB or hook changes — all data already flows.
- No drag-and-drop changes on the board.
- No new tabs, no activity feed, no email composer.

## Files touched

- `src/pages/Deals.tsx` — drop the white `<Section>` so the warm bg shows through.
- `src/components/deals/DealProfileSheet.tsx` — full visual rebuild (shell, header, KPI strip, tab content restyled). No prop or behavior changes.
- Small restyle pass on `src/components/deals/billing/DealBillingSummary.tsx`, `DealPaymentsCard.tsx`, `DealInvoicesCard.tsx` for typography/row styling only.
