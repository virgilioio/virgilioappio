## Plan

1. **Harden widget data inputs**
   - Update the analytics widget data adapter so every array-like source is normalized before `.map()`, `.every()`, `.filter()`, or `.slice()` runs.
   - Default missing `series`, `sparkline`, CRM `trend`, and CRM breakdown arrays to `[]` so one malformed saved widget or partially-loaded hook cannot crash the whole Analytics page.

2. **Make saved widget loading defensive**
   - Sanitize `extra_state.widgets` when activating a saved Analytics view.
   - Drop or repair invalid saved widget configs with missing `metric`, `groupBy`, `viz`, or `span` so older persisted views cannot pass undefined fields into `WidgetFrame`.

3. **Fix the visible bad profile query**
   - Correct the CRM analytics owner lookup to query the existing `profiles.user_id` column instead of `profiles.id`, matching the project schema and preventing the `GET /profiles?...id=in...` 400 error.
   - Keep the returned owner metadata serializable, then rebuild maps inside memoized calculations.

4. **Reduce the large-stage 400 risk**
   - Inspect the stage-performance/stuck-candidate query path that produces a very large `current_stage_id=in.(...)` request.
   - If it is coming from Analytics, chunk the affected `.in(...)` request or route it through job IDs so Analytics no longer emits oversized PostgREST filter URLs.

5. **Validate against the live Analytics page**
   - Reopen `/analytics` after the changes.
   - Confirm the error boundary no longer appears and the console no longer reports `Cannot read properties of undefined (reading 'map')` for `WidgetFrame`.