

# Align WhatsApp Template Creator with GoGio's Placeholder System

## What and Why

The WhatsApp template creator currently uses its own `AVAILABLE_VARIABLES` list with underscore-separated keys (`candidate_name`, `job_title`). GoGio already has a unified placeholder system in `placeholderUtils.ts` using dot-notation keys (`candidate.first_name`, `job.title`) rendered as purple pill badges. The template creator should use the same placeholders and the same visual style.

## Changes

### 1. `WhatsAppTemplateCreator.tsx`

- **Remove** the local `AVAILABLE_VARIABLES` array
- **Import** `AVAILABLE_PLACEHOLDERS` from `@/utils/placeholderUtils`
- **Filter** to a WhatsApp-relevant subset (candidate name/first_name, job title, sender name/first_name, plus a few WhatsApp-specific ones like `interview_date`, `interview_time`, `portal_link` — these would be added to `placeholderUtils.ts` if not already there)
- **Variable chips**: Style them as purple pill badges matching the existing `placeholder-badge` visual style — `bg-purple-500/15 text-purple-600 border-purple-500/30` (the same tokens used in `rich-text-editor.tsx` and `PlaceholderNode.tsx`)
- **Insert** `{{candidate.first_name}}` (dot-notation) into the textarea
- **Preview**: Resolve `{{candidate.first_name}}` → `[Candidate First Name]` using the label from `AVAILABLE_PLACEHOLDERS`
- Group the chips by category (Candidate, Job, Sender) as done in the email PlaceholderHelper

### 2. `placeholderUtils.ts`

- Add WhatsApp-specific placeholders that don't exist yet: `interview.date`, `interview.time`, `offer.details`, `portal.link`
- Tag them with a `category` so they can be filtered for WhatsApp context

### 3. `manage-whatsapp-templates/index.ts` (edge function)

- Update the named-to-numbered conversion regex to handle dot-notation keys (`candidate.first_name` → `{{1}}`). The existing regex `/\{\{([a-z_]+)\}\}/g` needs to become `/\{\{([a-z_.]+)\}\}/g` to match dots.

### 4. Template display (`WhatsAppTemplateLibrary.tsx`, `WhatsAppIntegrationCard.tsx`)

- When showing template previews with `variable_mapping`, resolve numbered placeholders back to labels using the shared `AVAILABLE_PLACEHOLDERS` list

## Visual Result

Variable chips in the WhatsApp template creator will look identical to the purple pill badges used in email template editors — consistent, recognizable, and using the same design tokens.

