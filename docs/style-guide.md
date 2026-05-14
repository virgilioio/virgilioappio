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

Every clickable affordance in Gio. Rules cover variant, size, state, shape, and the rare on-dark / specialty cases. **One primary per surface, always.**

### Variants

The variant determines visual weight and intent — not the action.

| Variant         | Use                                                                                  | Examples                                  |
|-----------------|--------------------------------------------------------------------------------------|-------------------------------------------|
| `primary`       | The single most important action on a screen. **Black fill, white text.** One per surface, ideally one per dialog. | Save, Create, Submit, Continue            |
| `purple`        | Brand-emphasis primary. Use when the action involves AI/Gio or core CRM commitments. | Add to pipeline, Generate with Gio, Send offer |
| `secondary`     | Medium weight. Most buttons in the app are this. White fill + thin border.           | Cancel, Filter, Edit, Export              |
| `ghost`         | Tertiary. Inline in dense rows, table actions, menu items, low-frequency settings. **Never for destructive actions.** | Edit, Remove, Open                        |
| `danger`        | Default for destructive action. **Outline only — never solid** unless the user has already confirmed. | Reject, Delete candidate, Archive job     |
| `dangerSolid`   | The confirm step inside a destructive dialog. Pair with a clear cancel. **Never the first action in a view.** | "Yes, delete workspace", "I understand, reject all 12" |
| `success`       | Positive confirmations only.                                                         | Mark hired, Approve offer                 |

### Sizes

Five sizes. Default is **md (34px)** — use it unless you have a reason. **Size by row density, not by importance.**

| Size  | Height | Token                | Use                                                                                  |
|-------|--------|----------------------|--------------------------------------------------------------------------------------|
| `xs`  | 24px   | `h-button-xs-v2`     | Inline in dense rows, table chip-style actions. Use very sparingly.                  |
| `sm`  | 28px   | `h-button-sm-v2`     | Card-internal buttons, toolbar actions inside lists, secondary actions in settings.  |
| `md`  | 34px   | `h-button-md-v2`     | **Default.** PageHeader actions, dialog footers, form submit, top-bar actions.       |
| `lg`  | 40px   | `h-button-lg-v2`     | Heavy emphasis CTAs in dialogs, full-width buttons in sheets, settings "Save" footers. |
| `xl`  | 48px   | `h-button-xl-v2`     | Empty states, onboarding, marketing-style hero CTAs. Almost never appears in the working app. |

### States

Every variant supports the same five states. Engineer them once; designers don't redraw them.

| State              | Behavior                                                                              |
|--------------------|---------------------------------------------------------------------------------------|
| **Default**        | Resting state. Where you see it most of the time.                                     |
| **Hover**          | "Barely a posture." Primary `-6%` lightness; secondary `-4%` alpha. **No lift, no scale.** |
| **Active / pressed** | Filling tones down, `translate-y-+0.5px`, inner shadow. Never a finger-zoom.       |
| **Focus**          | Only for keyboard navigation (`:focus-visible`). Purple ring 2px + offset, **35% opacity.** |
| **Disabled**       | 45% opacity, no pointer, aria attribute. Always pair with a media or reasoning why.   |
| **Loading**        | Async actions. Lock the width to avoid layout shift. Keep the label visible so users know what's happening. |

### Shapes & content

Variant always stays the same. What changes is what's *inside* the button.

| Shape                  | Notes                                                                                  |
|------------------------|----------------------------------------------------------------------------------------|
| Text only              | Default. Use whenever the label alone is unambiguous.                                  |
| Icon + text            | When an icon reinforces the action. Icon always 14–16px depending on size.             |
| Text + trailing icon   | For all external or arrow-right next steps, external link, "open in new tab", or chevron-down for dropdowns. |
| Icon only              | Toolbar utilities, +/×/sort/etc. **Always pair with `aria-label` and ideally a tooltip.** Never for unfamiliar actions. |
| With dropdown chevron  | Indicates the button reveals a menu. Chevron sits at the end with **0.65 opacity**.    |

### On dark (top bar)

When buttons sit on the cream-on-black top bar, variants are remapped: primary becomes inverted cream-on-black, secondary uses a translucent fill, ghost gets a softer hover.

| Variant            | Use                                                                                |
|--------------------|------------------------------------------------------------------------------------|
| `primaryOnDark`    | The "Create" button in the top bar. Cream fill on the black surface.               |
| `secondaryOnDark`  | Search trigger, workspace switcher, dropdown openers inside the top bar.           |
| `ghostOnDark`      | Top-level toggles in the top bar (Jobs, Candidates, notifications toggles).        |

### Specialty patterns

These aren't standalone variants — they're compositions of the same tokens.

| Pattern             | Notes                                                                                |
|---------------------|--------------------------------------------------------------------------------------|
| Segmented control   | Mutually exclusive choice with 2–4 options. Use when both options need to feel equal. Active option carries white fill + shadow. |
| Toggle (single)     | On/binary in settings rows. Always pair with a label on the left.                    |
| Toggle button (pressed) | Visible-state button (Star = Favorite, Bookmark, Pin). Pressed state carries a soft fill, `aria-pressed`. |
| Split button        | When the default action has variants. Main side fires the default, chevron side opens alternatives. |

### Button rules

1. **One primary per surface.** Demote the rest to secondary or ghost.
2. **Default size is `md` (34px).** Don't reach for `lg` to add emphasis — change variant instead.
3. **Destructive defaults to outline (`danger`).** Solid red is only for the final confirm step.
4. **Brand purple is for AI / Gio / core CRM commits.** Not a generic primary.
5. **No motion bigger than `translate-y-0.5px`.** No scale, no lift, no bounce.
6. **Icon-only requires `aria-label` + tooltip.** No exceptions.
