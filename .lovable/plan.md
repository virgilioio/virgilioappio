

# Show Currency and Period for Salary Fields in Application Responses

## Problem
When a candidate submits a salary value through a job application form, the application response only stores the raw numeric value. The currency (e.g., USD, EUR) and period (e.g., annually, monthly) are configured on the job posting's field definition (`job_posting_fields.field_config`), but the candidate response viewer doesn't fetch or display them.

## Solution
Enhance `CandidateApplicationResponses.tsx` to fetch the field configuration from `job_posting_fields` for salary (and location) type responses, then display the currency symbol and period alongside the salary value.

## Technical Changes

### File: `src/components/candidates/CandidateApplicationResponses.tsx`

1. **Fetch field configs from `job_posting_fields`**: After fetching responses, collect distinct `posting_id` values, then query `job_posting_fields` for fields matching those posting IDs and field names that are of type `salary` or `location`. Store a lookup map of `field_name -> field_config`.

2. **Update `formatFieldValue` for salary type**: When `field_type === 'salary'`, look up the field config to get the currency and period, then render the value with the currency symbol (using the existing `CURRENCY_SYMBOLS` map) and the period badge -- e.g., "$75,000 annually" instead of just "75000".

3. **Pass field configs into the render logic**: Thread the config lookup map through to the display, so each salary response row can access its associated currency and period.

### Display Format
A salary response will render as:
- Currency symbol badge (e.g., `$`) + formatted number + period badge (e.g., `Annually`)
- Matching the same visual pattern used in the public application form's salary field renderer

### No Database Changes Required
All data already exists -- `candidate_application_responses` has `posting_id`, and `job_posting_fields` has `field_config` with `currency` and `period`. We just need to join them at query time.

