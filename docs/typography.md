# Typography — Gio Design Foundation v1.0

Single source of truth for the type system. Every token below maps to a Tailwind utility (`text-{token}`) and reflects the Gio design guideline.

## Families

| Family          | Use                                  | Weights         | Tailwind          |
|-----------------|--------------------------------------|-----------------|-------------------|
| Poppins         | Display, headings, UI labels         | 400/500/600/700 | `font-poppins`    |
| Inter           | Body, tables, forms, paragraphs      | 400/500/600     | `font-inter`      |
| JetBrains Mono  | IDs, API keys, code only             | 400/500         | `font-mono`       |

## Tracking

- Headings: `-0.04em` (`tracking-page-title`)
- Caps / uppercase labels: `+0.08em` (`tracking-caps`)
- Body: default (0)

---

## Display & headings

Reserve `display.*` for marketing/splash. There must never be more than one Display per screen.

| Token            | Tailwind            | Size    | Weight | Line  | Where it appears                              |
|------------------|---------------------|---------|--------|-------|-----------------------------------------------|
| `display.xl`     | `text-display-xl`   | 48px    | 600    | 1.05  | Marketing pages, splash screens (rare in-app) |
| `display.lg`     | `text-display-lg`   | 36px    | 600    | 1.10  | Dashboard greeting, onboarding step titles    |
| `h1`             | `text-h1`           | 26px    | 600    | 1.15  | PageHeader title — one per screen             |
| `h2`             | `text-h2`           | 18px    | 600    | 1.20  | Major card titles, dialog titles              |
| `h3`             | `text-h3`           | 14.5px  | 600    | 1.30  | SettingsCard headers, sub-section titles      |
| `h4`             | `text-h4`           | 13px    | 600    | 1.30  | Item names in lists/tables, card item titles  |

## Body

| Token            | Tailwind             | Size  | Weight | Line | Where it appears                              |
|------------------|----------------------|-------|--------|------|-----------------------------------------------|
| `body.lg`        | `text-body-lg`       | 14px  | 400    | 1.55 | Settings descriptions, marketing copy         |
| `body.md`        | `text-body-md`       | 13px  | 400    | 1.50 | Default body — paragraphs, descriptions       |
| `body.sm`        | `text-body-sm`       | 12px  | 400    | 1.45 | Compact body — meta rows, dense UI            |
| `body.emphasis`  | `text-body-emphasis` | 13px  | 500    | 1.50 | Inline emphasis inside body text              |

## UI labels

Anything you click, type into, or pick from. Poppins gives chrome a designed feel.

| Token            | Tailwind             | Size    | Family   | Weight | Where it appears                              |
|------------------|----------------------|---------|----------|--------|-----------------------------------------------|
| `ui.menu.lg`     | `text-ui-menu-lg`    | 13px    | Poppins  | 500    | Top-nav tabs (header bar)                     |
| `ui.menu.md`     | `text-ui-menu-md`    | 12.5px  | Inter    | 500    | Settings sidebar nav, in-page tabs            |
| `ui.button.lg`   | `text-ui-button-lg`  | 13.5px  | Poppins  | 500    | 40px buttons (lg)                             |
| `ui.button.md`   | `text-ui-button-md`  | 13px    | Poppins  | 500    | 34px buttons — default size                   |
| `ui.button.sm`   | `text-ui-button-sm`  | 12px    | Poppins  | 500    | 28px buttons in dense rows                    |
| `ui.tab`         | `text-ui-tab`        | 12.5px  | Poppins  | 500    | Tab triggers (weight goes to 600 when active) |
| `ui.breadcrumb`  | `text-ui-breadcrumb` | 11.5px  | Inter    | 400    | PageHeader breadcrumbs (last segment 500)     |

## Form fields

Labels stacked at 11.5–12px; values at 13px.

| Token              | Tailwind                 | Size    | Family | Weight | Notes                                    |
|--------------------|--------------------------|---------|--------|--------|------------------------------------------|
| `form.label`       | `text-form-label`        | 12px    | Inter  | 500    | Field labels above inputs                |
| `form.value`       | `text-form-value`        | 13px    | Inter  | 400    | Text inside inputs, selects, textareas   |
| `form.placeholder` | `text-form-placeholder`  | 13px    | Inter  | 400    | Placeholder — color `#A0A6B5`            |
| `form.helper`      | `text-form-helper`       | 11px    | Inter  | 400    | Helper text below the field              |
| `form.error`       | `text-form-error`        | 11.5px  | Inter  | 500    | Validation error — color `#FA5252`       |
| `form.required`    | `text-form-required`     | 12px    | Inter  | 500    | Required asterisk — color `#FA5252`      |

---

## Rules

1. **Two families, no more.** Mono is fallback for code-like content only.
2. **Hierarchy by weight, not size.** Most UI lives between 11–15px; headings earn their size by being rare.
3. **Headings are 600.** Never 700, never 500.
4. **Tracking up top.** Headings `-0.04em`. Caps `+0.08em`. Body 0.
5. **Use tokens, not raw classes.** Prefer `text-h1` over `text-2xl font-poppins font-semibold`.
