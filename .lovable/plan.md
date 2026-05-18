# Audit: Offer Details card vs Gio guidelines

## Summary

The Offer Details card does **not** follow our Gio Foundation v1.0 guidelines. There is no dedicated "Cards" section in `docs/style-guide.md`, so the relevant rules come from the **Typography**, **Buttons**, **Badges**, and the `<Card>` primitive itself (`src/components/ui/card.tsx`). The component (`CandidateOfferDetails.tsx`) violates several of them.

## Findings

1. **Card chrome — overridden unnecessarily.** Every `<Card>` in the file passes `className="bg-surface-primary border-border"`, duplicating defaults already set on the primitive (`bg-surface-primary`, `border-virgilio-border`, `shadow-calendly`). It also drops the soft purple border + Calendly shadow that the primitive provides. → use plain `<Card>`.

2. **Inline banners ignore the card system.** The approved / declined / "document generated" / inline approve / inline decline panels are hand-rolled `<div className="mx-6 mt-6 p-3 rounded-lg …">` blocks placed **outside** `CardHeader`/`CardContent`, breaking the card's internal padding rhythm and the standard banner pattern (we have `Alert` variants per the standardized-alert-banners rule). → use `Alert` (or move them into `CardContent` with the standard tokens).

3. **Buttons violate the Buttons spec (§2).**
   - Mixed sizes: most actions are `size="sm"` (28px); spec default is `md` (34px) and there should be **one primary per surface**.
   - `Approve` is unstyled (defaults to `primary`) while `Decline` uses `variant="outline"` — spec says destructive = `variant="danger"` (outline destructive).
   - Generate / Send / Recall / Request Approval / Edit all use `variant="ghost"` — a header action row of five ghosts has zero hierarchy. Per spec, primary action should be `primary` (or `purple` for AI/approval flows), secondary `secondary`, destructive `danger`.
   - Confirm Decline uses deprecated `variant="destructive"` — spec uses `dangerSolid` only for confirm dialogs (acceptable) but the literal name is wrong.
   - Icon sizing: `h-3.5 w-3.5` everywhere — spec md = 14px (`h-3.5` is fine) but should rely on the Button `icon` prop, not manual `<Icon className="mr-1.5" />`.

4. **Badge usage violates Badges spec (§3).** `<Badge variant={…} className="capitalize">` uses the **deprecated** `variant` aliases. Status mapping is also off: `pending_approval` → `purple`, `approved` → `purple`, `accepted` → `default`, `declined` → `destructive`. Per the status recipe and tone map: pending = `yellow` (dot), approved/accepted = `green` (dot), declined = `red` (dot), draft = `neutral`. Should be `<Badge tone="…" dot size="sm">`.

5. **Typography tokens not used (§1).**
   - Field labels: `text-xs font-medium text-text-tertiary uppercase tracking-wider` — should be `text-form-label` (the dedicated UI label token).
   - Field values: `text-sm text-text-primary` — should be `text-body-md`.
   - `CardTitle` is fine (uses the primitive) but the surrounding row uses `leading-none` which fights `text-h2` line-height — remove the override.
   - Empty-state heading uses a custom `text-[1.38rem] font-semibold tracking-[-0.06em]` instead of `text-h2`.

6. **Layout / spacing.**
   - Approve/Decline forms sit between `CardHeader` and `CardContent` using `mx-6 mb-4` magic numbers — should live inside `CardContent` and use `p-layout-md` tokens.
   - Header action row is a second flex row below the title (`mt-2`) — standard pattern is title left, actions right on the same row inside `CardHeader`.

7. **Empty state.** Uses `gioFaceEmpty` correctly (per the standardized empty-states rule), but the heading typography and the manual `.` span duplicate what `CardTitle withPeriod` already provides.

## Verdict

It diverges on **card chrome, banners, buttons, badges, typography tokens, header layout, and empty-state typography**. A focused refactor is needed to bring it back to spec.

## Proposed scope of fix (for a follow-up plan, not this one)

- Drop redundant `className` on every `<Card>`; let the primitive handle chrome.
- Replace inline banner divs with `<Alert variant="…">`.
- Re-map status badges to `<Badge tone dot size="sm">` and remove deprecated `variant` aliases.
- Rebuild header: title + status badge left, action row right, on the same row. Apply one primary (`primary` or `purple`), one `secondary`, destructive as `danger`, use `<Button icon={Icon}>` syntax with `size="md"`.
- Swap field-label/value classes for `text-form-label` / `text-body-md`.
- Move inline approve / decline forms into `CardContent`, drop `mx-6` magic numbers, use `p-layout-md`.
- Simplify empty state to `CardTitle` + `CardDescription`.

This file only — no behavior changes.
