# Fix: Calendar page should belong to the ATS module

## Root cause

`getActiveSection()` in `src/components/layout/AppSidebar.tsx` is the single source of truth for "which module am I in". Its `ATS_PREFIXES` list currently is:

```
['/find', '/jobs', '/candidates', '/pipeline', '/analytics', '/talent-intelligence']
```

`/calendar` is missing, so on the Calendar page it returns `null`. That single value drives both broken behaviors:

- **Left rail (AppSidebar):** no item matches `active === 'ats'`, so the ATS tile loses its cream/active treatment.
- **Top header (Header.tsx, line 176–178):** `activeSection` is `null`, and the nav is built by `items.filter(i => i.section === activeSection)`, which yields an empty array — the entire ATS tab strip disappears.

## Change

Single-line edit in `src/components/layout/AppSidebar.tsx`:

Add `'/calendar'` to `ATS_PREFIXES`:

```ts
const ATS_PREFIXES = [
  '/find',
  '/jobs',
  '/candidates',
  '/pipeline',
  '/calendar',
  '/analytics',
  '/talent-intelligence',
]
```

That's the entire fix — both Header and AppSidebar already read from `getActiveSection`, and the Calendar nav entry in `Header.tsx` is already tagged `section: 'ats'`.

## Verification

- Navigate to `/calendar`: ATS tile in the left rail shows the active (cream) state with lilac accent; top header shows the full ATS nav with "Calendar" highlighted.
- Navigate to `/jobs`, `/candidates`, etc.: unchanged.
- Navigate to `/crm`, `/insights`, `/dashboard`: unchanged.

## Out of scope

No changes to the Calendar page itself, the Header nav list, route registration, or any other module logic.
