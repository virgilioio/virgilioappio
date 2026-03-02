

# Add PlaceholderHelper to Confirmation Email Automation

## Problem
The Confirmation Email Automation component (`ConfirmationEmailAutomation.tsx`) uses a simple inline list of placeholder badges at the bottom of the form. Every other template editor in the app (Email Templates, Offer Letters, Contracts, Rejection Templates, Stage Email Sequences) uses the shared `PlaceholderHelper` component in a side panel layout. This is visually inconsistent.

## Solution
Refactor `ConfirmationEmailAutomation` to match the established template editor pattern:
- Use a 2-column grid layout (editor on left, `PlaceholderHelper` on right)
- Replace the inline placeholder badges with the shared `PlaceholderHelper` component
- Remove the inline `PLACEHOLDERS` constant since `PlaceholderHelper` already defines all available placeholders

## What Changes

**File: `src/components/settings/automations/ConfirmationEmailAutomation.tsx`**

1. Import `PlaceholderHelper` from `@/components/settings/PlaceholderHelper`
2. Wrap the form content in a `grid grid-cols-1 lg:grid-cols-3 gap-6` layout (same as all template sheets)
3. Place the Card with subject/body fields in `lg:col-span-2`
4. Place `PlaceholderHelper` in `lg:col-span-1`
5. Remove the inline "Available placeholder variables" section (the Badge list and Info icon)
6. Remove the `PLACEHOLDERS` constant and unused `Badge`/`Info` imports

The result will look identical to how template editors display placeholders -- a scrollable side panel with categorized placeholders (Job, Organization, Sender, Candidate, Stage) with copy/insert buttons.
