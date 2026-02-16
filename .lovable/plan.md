

## Add "Salary" Answer Type to Job Posting Form Fields

### Overview
Reuse the same salary expectations pattern from scorecards as a new field type in the job posting form builder. When a recruiter selects "Salary" as the answer type, they configure the currency and period -- the public form then renders a numeric input with currency/period badges, and the submitted value syncs to the candidate's salary profile fields.

### How It Works

**Builder (recruiter configuring the form)**
1. Recruiter picks "Salary" from the answer type dropdown
2. Configuration section appears with Currency (using the existing `CurrencySelect` component) and Period (hourly/monthly/annually) dropdowns
3. The label is auto-set to "Salary Expectations" (editable) and help text explains it syncs to the candidate profile

**Public form (candidate filling it out)**
1. Renders a numeric input with currency and period badges beside it (same visual pattern as the scorecard salary field)
2. Submitted value is stored alongside currency/period metadata

**On submission**
1. The salary value, currency, and period are written to the candidate's `salary_amount`, `salary_currency`, and `salary_period` fields automatically

### Technical Details

**1. Database: Add `salary` to `field_type` enum + add config column**

| Change | Detail |
|---|---|
| Migration | `ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'salary'` |
| New column | Add `field_config JSONB DEFAULT NULL` to `job_posting_application_fields` -- stores `{ "currency": "USD", "period": "annually" }` for salary fields (generic enough for future field-type configs) |

**2. Type updates**

| File | Change |
|---|---|
| `src/hooks/useJobPostingFields.ts` | Add `'salary'` to `FieldType` union. Add `field_config` to `PostingField` interface. Pass `field_config` through `addCustomField` and `updateField`. |

**3. Builder UI -- FieldEditor + PostingFieldsBuilder**

| File | Change |
|---|---|
| `src/components/jobs/postings/FieldEditor.tsx` | When type is `salary`: show Currency (`CurrencySelect`) + Period dropdown in edit mode. Load/save config from `field_config` JSON column. Hide placeholder/help text inputs (auto-generated). |
| `src/components/jobs/postings/PostingFieldsBuilder.tsx` | Add "Salary" to the type dropdown (with DollarSign icon). When selected, show Currency + Period config inline. Pass `field_config` to `addCustomField`. Auto-set label to "Salary Expectations". |

**4. Public form rendering**

| File | Change |
|---|---|
| `src/components/forms/ApplicationFieldsRenderer.tsx` | Add `salary` case: render a numeric input + currency badge + period badge (matching scorecard pattern). Store value as the raw number string. |
| `src/pages/PublicJobPosting.tsx` | Add `salary` to the `FieldType` union. On form submission, detect salary fields and sync `salary_amount`, `salary_currency`, `salary_period` to the candidate record. |

**5. Candidate profile sync**

On public form submission, if a salary field exists:
- Parse the numeric value from the form
- Read currency and period from the field's `field_config`
- Update the candidate's `salary_amount`, `salary_currency`, `salary_period` columns

This mirrors exactly how the scorecard salary question syncs to the candidate profile.

### Files Changed

| File | Change |
|---|---|
| New migration | Add `salary` enum value + `field_config JSONB` column |
| `src/hooks/useJobPostingFields.ts` | Add salary type, field_config to interface and persistence |
| `src/components/jobs/postings/FieldEditor.tsx` | Salary config UI in edit mode |
| `src/components/jobs/postings/PostingFieldsBuilder.tsx` | Salary type in dropdown + config UI when adding |
| `src/components/forms/ApplicationFieldsRenderer.tsx` | Salary field rendering (number input + badges) |
| `src/pages/PublicJobPosting.tsx` | Salary type + candidate profile sync on submit |

