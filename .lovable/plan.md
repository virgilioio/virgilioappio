Replace the hardcoded "Acme Talent careers page" label with the current tenant's company name in the Job Wizard → Job Posting step and the standalone Posting Channels card.

## Changes
- `src/components/jobs/wizard/JobPostingStep.tsx` (line 149): swap the hardcoded `name: 'Acme Talent careers page'` for a dynamic value built from `useTenant()` → `` `${tenant.name}'s careers page` ``. Fallback to `"Your careers page"` while loading or if tenant name is missing. Build the channels array inside the component (currently it's a module-level const) so it can read the tenant.
- `src/components/jobs/postings/PostingChannelsCard.tsx` (line 34): same treatment — read `useTenant()` and render `` `${tenant.name}'s careers page` ``, same fallback.

No backend, schema, or business-logic changes — purely a label fix sourced from existing tenant data.