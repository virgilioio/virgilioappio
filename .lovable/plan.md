## Goal
Replace the static "Recruiting analytics." page title with the active view's name (e.g., "Recruiting Overview", "Revenue Analytics", or any custom view the user creates). When no view is active, fall back to a sensible default.

## Changes
**File:** `src/pages/Analytics.tsx`

1. Derive `activeViewName` from the loaded views list using `activeViewId`:
   ```ts
   const activeView = views.find(v => v.id === activeViewId)
   const pageTitle = activeView?.name ?? 'Analytics'
   ```
2. Replace the hardcoded `<h1>Recruiting analytics.</h1>` with `{pageTitle}` followed by the existing lilac period accent.
3. Keep the small "ANALYTICS" eyebrow label above the title unchanged (acts as the module label).
4. Title updates reactively when the user switches views via `AnalyticsViewSwitcher` or renames a view (since `views` comes from the same hook).

## Out of scope
- No changes to the view switcher, view CRUD, or widget logic.
- No change to the eyebrow ("ANALYTICS") or the widget-count subline.
