

# Fix WhatsApp Template Variable Resolution

## Problem

The `variable_mapping` in the database stores dot-notation values like `{ "1": "candidate.first_name", "2": "job.title", "3": "company.name" }`. But `resolveTemplateVariables` in `WhatsAppChatTab.tsx` has switch cases for underscore-style names (`candidate_name`, `job_title`, `company_name`) that **never match**, so every variable falls through to `default` and renders as literal `[candidate.first_name]`.

## Fix — `src/components/candidates/WhatsAppChatTab.tsx` (lines 85-110)

Update the switch cases to match actual dot-notation keys from `AVAILABLE_PLACEHOLDERS`:

| Current (broken) | Corrected |
|---|---|
| `candidate_name` | `candidate.name` |
| _(missing)_ | `candidate.first_name` → split candidateName, take first word |
| `recruiter_name` | `recruiter.name`, `sender.name` |
| `company_name` | `company.name`, `organization.name` |
| `job_title` | `job.title` |
| `interview_date` | `interview.date` |
| _(missing)_ | `interview.time` |
| _(missing)_ | `sender.first_name`, `sender.email`, `sender.phone`, etc. |

The updated function will look roughly like:

```typescript
const resolveTemplateVariables = (template: WhatsAppTemplate) => {
  const mapping = template.variable_mapping || {}
  const variables: Record<string, string> = {}
  Object.entries(mapping).forEach(([key, field]) => {
    switch (field) {
      case 'candidate.name':
        variables[key] = candidateName || ''; break
      case 'candidate.first_name':
        variables[key] = candidateName?.split(' ')[0] || ''; break
      case 'candidate.email':
        // not available in props currently — leave blank
        variables[key] = ''; break
      case 'job.title':
        variables[key] = jobTitle || 'the position'; break
      case 'job.department': case 'job.location':
        variables[key] = ''; break
      case 'company.name': case 'organization.name':
        variables[key] = companyName || 'our company'; break
      case 'recruiter.name': case 'sender.name':
        variables[key] = recruiterName || 'Our team'; break
      case 'sender.first_name':
        variables[key] = recruiterName?.split(' ')[0] || ''; break
      case 'sender.email':
        variables[key] = user?.email || ''; break
      case 'interview.date':
        variables[key] = '[Date TBD]'; break
      case 'interview.time':
        variables[key] = '[Time TBD]'; break
      default:
        variables[key] = ''; break  // silently omit unknown fields instead of showing [field]
    }
  })
  return variables
}
```

## Files Modified

| File | Change |
|---|---|
| `src/components/candidates/WhatsAppChatTab.tsx` | Rewrite switch cases in `resolveTemplateVariables` (lines 85-110) to match dot-notation placeholder keys |

Single file, ~25 lines changed. No DB or edge function changes needed — the issue is purely client-side resolution.

