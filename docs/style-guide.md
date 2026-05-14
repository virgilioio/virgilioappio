# Gio Design Foundation v1.0 — Style Guide

Single source of truth for typography and buttons. Replaces `docs/typography.md`.

> **Three rules, every page**
> 1. **One primary per surface.** Two primaries means neither is.
> 2. **Hierarchy by variant, density by size.** Pick variant for visual weight, size to fit the row.
> 3. **Destructive defaults to caution.** Solid danger only for irreversible, confirmed actions.

---

## 1. Typography

### Families

| Family          | Use                                  | Weights         | Tailwind          |
|-----------------|--------------------------------------|-----------------|-------------------|
| Poppins         | Display, headings, UI labels         | 400/500/600/700 | `font-poppins`    |
| Inter           | Body, tables, forms, paragraphs      | 400/500/600     | `font-inter`      |
| JetBrains Mono  | IDs, API keys, code only             | 400/500         | `font-mono`       |

### Tracking

- Headings: `-0.04em` (`tracking-page-title`)
- Caps / uppercase labels: `+0.08em` (`tracking-caps`)
- Body: default (0)

### Display & headings

| Token        | Tailwind          | Size   | Weight | Line  | Where it appears                              |
|--------------|-------------------|--------|--------|-------|-----------------------------------------------|
| `display.xl` | `text-display-xl` | 48px   | 600    | 1.05  | Marketing pages, splash screens               |
| `display.lg` | `text-display-lg` | 36px   | 600    | 1.10  | Dashboard greeting, onboarding step titles    |
| `h1`         | `text-h1`         | 26px   | 600    | 1.15  | PageHeader title — one per screen             |
| `h2`         | `text-h2`         | 18px   | 600    | 1.20  | Major card titles, dialog titles              |
| `h3`         | `text-h3`         | 14.5px | 600    | 1.30  | SettingsCard headers, sub-section titles      |
| `h4`         | `text-h4`         | 13px   | 600    | 1.30  | Item names in lists/tables, card item titles  |

### Body

| Token            | Tailwind             | Size  | Weight | Line | Where it appears                              |
|------------------|----------------------|-------|--------|------|-----------------------------------------------|
| `body.lg`        | `text-body-lg`       | 14px  | 400    | 1.55 | Settings descriptions, marketing copy         |
| `body.md`        | `text-body-md`       | 13px  | 400    | 1.50 | Default body — paragraphs, descriptions       |
| `body.sm`        | `text-body-sm`       | 12px  | 400    | 1.45 | Compact body — meta rows, dense UI            |
| `body.emphasis`  | `text-body-emphasis` | 13px  | 500    | 1.50 | Inline emphasis inside body text              |

### UI labels

| Token            | Tailwind             | Size    | Family   | Weight | Where                                         |
|------------------|----------------------|---------|----------|--------|-----------------------------------------------|
| `ui.menu.lg`     | `text-ui-menu-lg`    | 13px    | Poppins  | 500    | Top-nav tabs (header bar)                     |
| `ui.menu.md`     | `text-ui-menu-md`    | 12.5px  | Inter    | 500    | Settings sidebar nav, in-page tabs            |
| `ui.button.lg`   | `text-ui-button-lg`  | 13.5px  | Poppins  | 500    | 40px buttons (lg)                             |
| `ui.button.md`   | `text-ui-button-md`  | 13px    | Poppins  | 500    | 34px buttons — default size                   |
| `ui.button.sm`   | `text-ui-button-sm`  | 12px    | Poppins  | 500    | 28px buttons in dense rows                    |
| `ui.tab`         | `text-ui-tab`        | 12.5px  | Poppins  | 500    | Tab triggers (600 when active)                |
| `ui.breadcrumb`  | `text-ui-breadcrumb` | 11.5px  | Inter    | 400    | PageHeader breadcrumbs (last segment 500)     |

### Form fields

| Token              | Tailwind                | Size    | Family | Weight | Notes                                    |
|--------------------|-------------------------|---------|--------|--------|------------------------------------------|
| `form.label`       | `text-form-label`       | 12px    | Inter  | 500    | Field labels above inputs                |
| `form.value`       | `text-form-value`       | 13px    | Inter  | 400    | Text inside inputs/selects/textareas     |
| `form.placeholder` | `text-form-placeholder` | 13px    | Inter  | 400    | Placeholder — color `#A0A6B5`            |
| `form.helper`      | `text-form-helper`      | 11px    | Inter  | 400    | Helper text below the field              |
| `form.error`       | `text-form-error`       | 11.5px  | Inter  | 500    | Validation error — color `#FA5252`       |
| `form.required`    | `text-form-required`    | 12px    | Inter  | 500    | Required asterisk — color `#FA5252`      |

### Typography rules

1. Two families, no more. Mono is fallback for code-like content only.
2. Hierarchy by weight, not size. Most UI lives between 11–15px.
3. Headings are 600. Never 700, never 500.
4. Tracking: headings `-0.04em`, caps `+0.08em`, body 0.
5. Use tokens, not raw classes. Prefer `text-h1` over `text-2xl font-poppins font-semibold`.

---

## 2. Buttons

Every clickable affordance in Gio. Rules cover variant, size, state, shape, on-dark, and specialty patterns. **One primary per surface, always.**

> **Three rules**
> 1. **One primary per surface.** Per page, per dialog, per card. Two primaries means neither is.
> 2. **Hierarchy by variant, density by size.** Pick variant for visual weight, size to fit the row — never to add importance.
> 3. **Destructive defaults to caution.** Outline `danger` by default. Solid red is for the irreversible, confirmed step only.

### Variants

The variant determines visual weight and intent — not the action.

| Variant         | Color                                    | Use                                                                                  |
|-----------------|------------------------------------------|--------------------------------------------------------------------------------------|
| `primary`       | citron-noir `#0d0d09` → cream            | The single most important action on a screen. Save, Create, Submit, Continue.        |
| `purple`        | brand `#6F3FF5`                          | Brand-emphasis primary. AI / Gio / core CRM commits — Add to pipeline, Generate with Gio, Send offer. |
| `secondary`     | white + hairline border                  | Medium weight. Most buttons in the app are this. Cancel, Filter, Edit, Export.       |
| `ghost`         | no chrome until hover                    | Tertiary. Inline in dense rows, table actions, menu items. **Never destructive.**    |
| `danger`        | white + red text & border                | DEFAULT for destructive actions. **Outline only — never solid** unless confirmed.    |
| `dangerSolid`   | filled red                               | Confirm step inside a destructive dialog. Pair with a clear cancel. **Never the first action in a view.** |
| `success`       | filled green — used sparingly            | Positive confirmations only — Mark hired, Approve offer.                             |
| `link`          | inline purple, weight 500                | Inline in body text. Underline on hover. Never destructive.                          |

### Sizes

Five sizes. Default is **md (34px)** — use it unless you have a reason. **Size by row density, not by importance.**

| Size  | Height | Text     | Icon  | Use                                                                                  |
|-------|--------|----------|-------|--------------------------------------------------------------------------------------|
| `xs`  | 24px   | 11.5px   | 12px  | Inline pill in dense rows, table chip-style actions. Use very sparingly.             |
| `sm`  | 28px   | 12px     | 14px  | Card-internal buttons, toolbar actions inside lists, secondary actions in settings.  |
| `md`  | 34px   | 13px     | 14px  | **Default.** PageHeader actions, dialog footers, form submit, top-bar actions.       |
| `lg`  | 40px   | 13.5px   | 15px  | Heavy-emphasis CTAs in dialogs, full-width buttons in sheets, settings "Save" footers. |
| `xl`  | 48px   | 14px     | 16px  | Empty states, onboarding, marketing-style hero CTAs. Almost never inside the working app. |

### States

Every variant supports the same six states. Engineer them once.

| State              | Behavior                                                                              |
|--------------------|---------------------------------------------------------------------------------------|
| **Default**        | Resting state. The 95% case.                                                          |
| **Hover**          | Fill shift only. Primary `-6%` lightness; secondary → `#FAFAF7`; ghost → `#F1F0EC`. **No translate, no scale.** |
| **Active / pressed** | Filled variants darken further; inner shadow. Lasts ~80ms. **No translate, no lift.** |
| **Focus**          | `:focus-visible` only. Purple ring `2px @ 30% opacity`, no offset. Never combine with hover. |
| **Disabled**       | 45% opacity, `cursor-not-allowed`, aria-disabled. Always pair with a tooltip explaining why. |
| **Loading**        | Spinner replaces leading icon. Label stays. Width is locked to avoid layout shift.    |

### Shapes & content (props)

Variant + size stay the same. What changes is what's *inside* the button.

| Prop          | Notes                                                                                   |
|---------------|-----------------------------------------------------------------------------------------|
| (text only)   | Default. Use whenever the label alone is unambiguous.                                   |
| `icon`        | Leading `LucideIcon`. Auto-sized to the button size. Use when the icon reinforces the verb (Download = download). |
| `iconRight`   | Trailing `LucideIcon`. For directional / external — arrow-right, external-link.         |
| `iconOnly`    | Square button (`w === h`). **Requires `aria-label`.** Toolbar utilities, table actions, close. |
| `dropdown`    | Appends `ChevronDown` at `opacity-0.65`. Indicates the button reveals a menu.           |
| `loading`     | Async actions. Spinner replaces `icon`; width locked.                                   |

### On dark (top bar)

When buttons sit on the citron-noir top bar, set `onDark` — variants are remapped automatically: primary becomes inverted cream-on-black, secondary uses a translucent fill, ghost gets a softer hover.

```tsx
<Button variant="primary" onDark>Create</Button>
<Button variant="secondary" onDark icon={Search}>Search Acme Talent</Button>
<Button variant="ghost" onDark>Jobs</Button>
```

> The legacy `variant="primaryOnDark|secondaryOnDark|ghostOnDark"` still works but is deprecated — migrate to `onDark`.

### Specialty patterns

These aren't standalone variants — they're compositions on top of `<Button>`.

| Pattern                | Component             | Notes                                                                                 |
|------------------------|-----------------------|---------------------------------------------------------------------------------------|
| Segmented control      | `<ToggleGroup>`       | Mutually-exclusive choice with 2–4 options. Active option = white fill + shadow.      |
| Toggle (single)        | `<Switch>`            | On/off binary in a settings row. Always pair with a label and helper text.            |
| Toggle button (pressed)| `<ToggleButton>`      | Visible-state push (Favorite, Pin, Bookmark). Pressed = lilac fill, `aria-pressed`.   |
| Split button           | `<SplitButton>`       | Default action + chevron sidecar opening alternatives.                                |
| Floating action (FAB)  | `<FAB>`               | Bottom-right, **mobile only**, one per screen. Desktop uses the page header instead.  |
| Link button            | `variant="link"`      | Inline purple in body text. Underline on hover.                                       |

### In context (ordering)

- **PageHeader actions** — right-aligned, `size="md"`. Reading right-to-left: primary → secondaries → icon-only overflow. Primary is rightmost — it's where the eye lands after scanning a row.
- **Dialog footer** — Cancel sits left of the primary so muscle memory reaches confirm at the end. Destructive confirms swap the primary to `dangerSolid`.
- **Destructive flow** — first surface uses outline `danger`. Only the confirm dialog uses `dangerSolid`.
- **Card footer (full-width)** — `size="lg"` + `className="w-full"`, single CTA, never paired.
- **Inline triage (table row)** — `size="sm"`, `iconOnly`, hidden until row hover. Reject sits left of Approve (same right-to-left commit pattern as dialogs).

### Anatomy

```
[icon]  Generate with Gio  [chevron]
  ↑     ↑                    ↑
  14px  Poppins 500          opacity-65
        13px · -0.005em
height 34px · radius 8 · pad-x 12 · gap 6 · pad-y 0
```

### Do & Don't

| Topic           | Do                                                          | Don't                                                              |
|-----------------|-------------------------------------------------------------|--------------------------------------------------------------------|
| Hierarchy       | One primary; demote Cancel to ghost so the eye lands on Save. | Two primaries shouting — neither wins.                            |
| Destructive     | Outline `danger` for the first destructive action.          | `dangerSolid` as the resting state — treats users as already wrong.|
| Sizing          | All `md` across a PageHeader. Importance comes from variant. | Mixed sizes to fake hierarchy — looks ransom-note.                |
| Icons           | Icon reinforces the verb (Download = download).             | Random decorative icon — user reads twice and trusts less.         |

### Button rules

1. **One primary per surface.** Demote the rest to secondary or ghost.
2. **Default size is `md` (34px).** Don't reach for `lg` to add emphasis — change variant instead.
3. **Destructive defaults to outline (`danger`).** Solid red is only for the final confirm step.
4. **Brand purple is for AI / Gio / core CRM commits.** Not a generic primary.
5. **No motion. Ever.** No translate, no lift, no scale, no bounce — only fill shifts.
6. **`iconOnly` requires `aria-label` + tooltip.** No exceptions.
7. **On the top bar, use `onDark` — never hand-roll `bg-white/10`.**

---

## 3. Badges & tags

The smallest building block in Gio — a colored pill that conveys status, category, or count at a glance. Used in tables, page headers, candidate cards, sheets, filters, and tabs.

> **Three rules**
> 1. **Color carries meaning.** Green = positive, red = critical, amber = warns, blue = informs. Never reassign a hue per surface.
> 2. **Pill by default, dot for status.** State-of-something gets a leading dot. Categorical tags don't. Counts get a circle.
> 3. **Small, quiet, never bold.** 11px Inter @ 500. Never 600+, never display fonts, never larger than 12.5px in-app.

### Color system — 10 tones

| Tone     | Token (bg / fg)                                     | Means                                                         |
|----------|-----------------------------------------------------|---------------------------------------------------------------|
| green    | `pastel-green` / `pastel-green-foreground`          | Positive — active, open, online, hired, paid, healthy         |
| red      | `destructive/10` / `destructive`                    | Critical — at-risk, rejected, error, expired, overdue         |
| pink     | `pastel-pink` / `pastel-pink-foreground`            | Attention                                                     |
| yellow   | `pastel-yellow` / `pastel-yellow-foreground`        | Warning — pending review, near-limit, slow, needs attention   |
| orange   | `pastel-orange` / `pastel-orange-foreground`        | Pending / in-flight (offer extended)                          |
| blue     | `pastel-blue` / `pastel-blue-foreground`            | Informational — in-progress phases (Phone screen, In trial)   |
| purple   | `pastel-purple` / `pastel-purple-foreground`        | Brand-emphasis — featured, role badges                        |
| **lilac**| `badge-lilac` / `badge-lilac-foreground`            | AI / soft brand emphasis (Suggested, Beta, Trial)             |
| neutral  | `muted` / `muted-foreground`                        | Default — categories without intent, count chips, inactive    |
| **ink**  | `badge-ink` / `badge-ink-foreground`                | Inverted — maximum emphasis (Workspace owner, Current plan)   |

### Types — 6 structural variants

| Type              | API                                  | Notes                                                                |
|-------------------|--------------------------------------|----------------------------------------------------------------------|
| Status badge      | `<Badge tone={t} dot>Open</Badge>`   | Default workhorse. State of something. Always a leading dot.         |
| Categorical tag   | `<Badge tone={t}>Figma</Badge>`      | Skill, role, source, department. No dot.                             |
| Count badge       | `<Badge tone="neutral" count={4}/>`  | Number next to titles or tab labels.                                 |
| Counter dot       | `<CounterBadge count={n} />`         | Notification overlay. Red dot for >0, number for >1, hard cap `99+`. |
| Removable chip    | `<RemovableChip onRemove={…}>`       | Active filter values. The × removes it.                              |
| Icon prefix badge | `<Badge tone="lilac" icon={Sparkles}>` | Sparkles = AI, Flame = trending, Lock = restricted.                |

### Sizes — 4 sizes

| Size  | Height | Text   | Use                                                                                  |
|-------|--------|--------|--------------------------------------------------------------------------------------|
| `xs`  | 18px   | 10px   | Inline in dense table rows, row cards, counter chips on tabs. **Most common in dense surfaces.** |
| `sm`  | 22px   | 11px   | **Default.** PageHeader meta row, profile chips, filter chips, sidebar nav counts.   |
| `md`  | 26px   | 12px   | Single status badges at the top of a sheet or detail page when they carry real signal. |
| `lg`  | 30px   | 12.5px | Marketing surfaces, trial banners. Almost never used inside the working app.         |

### States & modifiers

| Modifier         | Notes                                                                                |
|------------------|--------------------------------------------------------------------------------------|
| Default          | Filled with the tone's background. The 95% case.                                     |
| `pulse`          | Halo at 25% opacity around the dot. Real-time signal — Live now, Recording, Joining. Use sparingly. |
| `bordered`       | 1px hairline `current/20` border. Use when on a busy or colored surface.             |
| Inverted (`ink`) | Use `tone="ink"`. Maximum emphasis on light surfaces.                                |
| `shape="square"` | 6px radius instead of pill. Use when stacked inside small cards (job cards, table cells). Pill remains the brand. |

### By use case

| Use case          | Type          | Tone mapping                                                                              |
|-------------------|---------------|-------------------------------------------------------------------------------------------|
| Job status        | status badge  | open=green · paused=yellow · draft=neutral · closed=red · archived=neutral                |
| Candidate stage   | status badge  | sourced=neutral · phone/take-home/onsite=blue · offer=orange · hired=green · rejected=red |
| Member role       | categorical   | owner=ink · admin=blue · recruiter=purple · hiring manager=orange · interviewer=neutral · sales=lilac |
| AI fit score      | status badge  | ≥85=green · ≥70=blue · ≥50=yellow · ≥30=orange · <30=red. Always show the number.         |
| Scorecard rating  | status badge  | strong yes / yes / lean yes=green · neutral=neutral · lean no / no / strong no=red        |
| Billing & plan    | status badge  | current plan=ink · trial=lilac · paid=green · refunded=neutral · past due=red             |
| Integration status| status badge  | connected=green · action needed=yellow · beta=lilac · not connected=neutral               |
| System / AI flags | icon prefix   | lilac + Sparkles (AI) / Flame (trending) / Lock (restricted)                              |

The mappings above live in code at `src/lib/badge-tones.ts` — import the const, don't hardcode.

### Anatomy

```
┌────────────────────────────────────────────┐
│  •   AI suggested              38          │   height per size (xs 18 / sm 22 / md 26 / lg 30)
│  ↑   ↑                          ↑          │   radius 9999 (pill) or 6 (square)
│  dot label                      count chip │   pad-x per size · gap 6
│  7px 11px Inter 500             bg current/13%
└────────────────────────────────────────────┘
   bg = tone.bg · fg = tone.fg
```

### In context (recipes)

- **PageHeader meta row** (`sm` + `xs` mix): status badge + count chip + plain meta text. The badge sequence ends before the meta starts.
- **Dense table row** (`xs`): each badge does a different job. Two of the same tone in one row would compete — vary tones across columns.
- **Tab counter chip** (`xs` + `count`): active tab uses a saturated tone; inactive tabs use neutral counts.
- **Filter bar** (`sm` + removable): every active filter renders as a `<RemovableChip>` (defaults to purple) so they read as a set rather than competing meanings.
- **Notification stack**: `<CounterBadge>` — plain red dot for unread > 0; numbered for unread > 1, hard cap `99+`.
- **Skills cluster** (`xs` categorical): 3–5 skill badges max, then `<OverflowMore count={N} />`. Related skills share a tone.

### Do & Don't

1. **Status — dot or no dot, consistently.** State-of-something gets a dot; categorical does not. Mixing the conventions makes a reader unable to tell if a badge represents state, category, or both.
2. **Tone — one meaning per color.** Green = positive across the entire app (paid, active, hired, on-track). Never use the same tone for unrelated meanings.
3. **Quantity — three is the limit.** Three badges per row, then add an overflow chip. Stuffing every attribute into chips reads as confetti, not information.
4. **Size — match the row density.** `xs` inside a dense table row; `md` only on a sheet header. A `md` badge inside a 32px table row bullies the rest of the row.

---

## 4. Tables

The data surface that defines half of Gio. Tables for candidates, jobs, members, invoices, deals, customers. Implementation in `src/components/ui/table.tsx`, `table-cells.tsx`, `table-states.tsx`, `table-toolbar.tsx`, `table-pagination.tsx`.

### Three rules

1. **Default to default.** 52px rows for everything. Drop to 40px only when the same screen shows >50 rows.
2. **Headers are eyebrows, not titles.** 10.5px Inter caps, +0.06em tracking, muted color. Never bold, never the same weight as cells.
3. **Numbers right, names left.** Numeric columns right-align in Poppins with tabular-nums; names left-align in Inter.

### Anatomy (default density)

| Part | Spec |
|---|---|
| Header row | 36px h · `#FAFAF7` · `text-table-header` (10.5px Inter caps, +0.06em, tertiary) |
| Body row | 52px h · white |
| Cell padding | `0 14px` x · `12px` gap (`--tbl-cell-px`, `--tbl-cell-gap`) |
| Divider | `1px #F1F0EC` (`--tbl-divider-color`) |
| Border + radius | `1px #E7E8EE` · radius 12 (wrapper) |
| Hover row | `#FAFAF7` + actions appear (flat — no translate, no shadow) |
| Selected row | `#FAF8FF` + 2px purple **left rail** (inset shadow) |
| Zebra (off by default) | Every other row `#FAFAF7` |

### Density

`<Table density="...">` propagates to all sub-components via context.

| Density | Row | Header | Cell text | Avatar | Use for |
|---|---|---|---|---|---|
| `compact` (40h) | 40px | 32px | 12px | 22px | Pipeline overview, audit logs, integration sub-rows, screens with >50 rows |
| `default` (52h) ★ | 52px | 36px | 13px | 28–32px | Members, Candidates, Jobs, Invoices, SaaS customers — everything else |
| `comfortable` (64h) | 64px | 40px | 13px | 32+px | Marketing-style listings inside embeds (careers page). Almost never inside the app. |

### Column types — six and only six

Compose tables from these primitives — don't invent a seventh.

1. **`<IdentityCell name sub src />`** — avatar + name (13/500) + sub-text (11/muted). First column of every people/object table.
2. **`<StatusCell>`** — wraps a single `<Badge size="sm">`. One badge per cell — never stack. Pull tones from §3.
3. **`<NumericCell>`** — Poppins, tabular-nums, weight 500, right-aligned. Counts, currency, percentages. Set `<TableCell className="text-right">`.
4. **`<MonoCell>`** — JetBrains Mono 12.5px/500. Invoice IDs, API keys, slugs.
5. **`<ComposedCell overflowCount>`** + **`<AvatarStack people max={4} />`** — stacked avatars (−8px overlap) and badge clusters with overflow chip.
6. **`<ActionCell>`** — fixed 32px column, `iconOnly` ghost buttons or single `⋯` menu. Visible on row hover only (relies on row's `group` class — already built into `<TableRow>`).

### Row states

| State | Component / pattern |
|---|---|
| Default | `<TableRow>` |
| Hover | Automatic on `<TableRow>` (`#FAFAF7` fill — no glow, no scale) |
| Selected | `<TableRow data-state="selected">` (`#FAF8FF` + purple left rail) |
| Disabled | `<TableRow data-state="disabled">` (40% opacity, pointer-events off) |
| Error | `<TableRow data-state="error">` (red left rail) |
| Loading | `<TableSkeleton rows={5} columns={N} />` — header stays solid; always 3–5 skeleton rows |
| Empty | `<TableEmpty colSpan title description ctaLabel onCta />` — center text + single CTA. No illustrations inside data tables (keep the Gio mascot for app-level empties). |
| Filtered empty | `<TableFilteredEmpty colSpan query onClearFilters />` — distinct from true-empty; offer to clear filters, not to add data. |

### Toolbar

`<TableToolbar left={...} right={...} />` sits above every table. Anatomy:

```
[Search 30h ≤280w] [Segmented status w/ counts] [Filter pills + "+ Filter"]   [Columns · Density · Export · Primary]
```

- `<TableSearch placeholder="Search members…" />` — 30h, max-w 280, **explicit placeholder**.
- `<TableSegmented options={[{value, label, count}]} />` — mirrors the most-filtered column · counts inline · active = white card.
- `<TableFilterPills />` + `<TableAddFilterButton />` — purple removable badges + ghost `+ Filter` trigger.
- Right cluster order: **Columns toggle → Density → Export → Primary action**. Primary is the only non-ghost button.

**Bulk-select morph.** When `selectedCount > 0`, swap the toolbar for `<TableBulkBar count entityLabel onClear>...</TableBulkBar>`. Inside, render bulk actions as `size="sm"`. Reject is `variant="danger"` (outline) per §2.

### Pagination & footer

Two patterns, **never both** on the same table.

- **`<TableFooterSummary rangeStart rangeEnd total entityLabel onLoadMore />`** ★ default. Use when tables auto-paginate via virtual scroll, or for candidate/people/job lists.
- **`<TablePagination page totalPages perPage onPageChange onPerPageChange />`** — invoice tables, audit logs, anywhere users benefit from page-jumping. **Don't use for candidate/people tables** — filtering is the right primitive there.

### Do & Don't

1. **Headers — eyebrow caps, never bold body weight.** 10.5px Inter caps orient the eye; 13px bold headers shout louder than the data and the table reads bottom-heavy.
2. **Density — match the use, don't pick at random.** 52px by default. 64px for everything wastes a screen of scrolling for half the information.
3. **Alignment — numeric right, text left.** The eye scans a clean right edge for numbers and a clean left edge for names. Everything-left makes numbers compete with names for the same reading column.
4. **Hover & selection — fill, not glow.** Hover = `#FAFAF7` flat fill. Selected = `#FAF8FF` + 2px purple left rail. **No translate, no shadow, no scale.** Wobbly rows on scroll are the single most common drift.

### Tokens (in `index.css`)

```css
--tbl-row-h-compact: 40px;
--tbl-row-h-default: 52px;   /* ★ */
--tbl-row-h-comfy:   64px;
--tbl-header-h-compact: 32px;
--tbl-header-h-default: 36px;
--tbl-header-h-comfy:   40px;
--tbl-cell-px:  14px;
--tbl-cell-gap: 12px;
--tbl-row-hover:    40 33% 97%;     /* #FAFAF7 (HSL channels) */
--tbl-row-selected: 267 100% 98%;   /* #FAF8FF */
--tbl-divider-color: 40 14% 93%;    /* #F1F0EC */
--tbl-border-color:  225 14% 92%;   /* #E7E8EE */
--tbl-border-radius: 12px;
```

Typography utilities (in `tailwind.config.ts`): `text-table-header`, `text-table-header-compact`, `text-table-cell`, `text-table-cell-compact`, `text-table-name`, `text-table-sub`, `text-table-num`, `text-table-mono`.
