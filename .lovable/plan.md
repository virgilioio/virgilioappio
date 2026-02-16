

## Add Help Text and Scorecard-Consistent Visuals to Salary Field

### What Changes

There are two parts: (1) adding a help text to the salary field on the public form, and (2) aligning the visual treatment of the salary field across the builder (view mode, edit mode, add mode) with the scorecard's established design language.

### 1. Public Form -- Salary Help Text

**File: `src/components/forms/ApplicationFieldsRenderer.tsx`**

Add a green help text below the salary input (matching the scorecard's ScorecardSheet pattern):
- "This will be added to your candidate profile." (candidate-facing wording)
- Use `text-xs text-green-600` styling, matching the scorecard

### 2. Builder View Mode -- Salary Field Visual Treatment

**File: `src/components/jobs/postings/FieldEditor.tsx`**

When a salary field is displayed in view mode (not editing), apply the scorecard's InterviewQuestionsList pattern:
- Green answer-type badge: `bg-green-500/10 text-green-700 border-green-300` with DollarSign icon and "Salary" label (instead of plain gray text)
- Blue "Syncs to Profile" badge: `bg-blue-500/10 text-blue-700 border-blue-300` with Link2 icon
- Gray currency/period badge: `bg-gray-100 text-gray-600` showing e.g. "USD / annually"

This replaces the plain `capitalize` text that currently just says "salary" for the type column.

### 3. Builder Edit Mode -- Salary Config Container

**File: `src/components/jobs/postings/FieldEditor.tsx`**

When editing a salary field, wrap the currency/period config in a styled container matching the scorecard's InterviewQuestionForm:
- Purple container: `bg-virgilio-purple/5 border border-virgilio-purple/20 rounded-lg p-4`
- Header with Link2 icon: "Syncs to Candidate Profile" in `text-virgilio-purple`
- Info box: white background with border, explaining that the salary value will automatically update the candidate's salary fields

### 4. Add Custom Field -- Salary Config Container

**File: `src/components/jobs/postings/PostingFieldsBuilder.tsx`**

Same treatment as edit mode:
- Wrap the currency/period selects in the purple container with the "Syncs to Candidate Profile" header and info box
- Matches the scorecard's InterviewQuestionForm pattern exactly

### Visual Reference (from scorecards)

The scorecard uses three distinct visual treatments:
- **Config/Form**: Purple container with "Syncs to Candidate Profile" + Link2 icon + info box
- **List/View**: Green badge for type + Blue "Syncs to Profile" badge + Gray currency/period badge
- **Fill/Public**: Green container with DollarSign icon + green help text about profile sync

We map these 1:1:
- Config/Form --> FieldEditor edit mode + PostingFieldsBuilder add section
- List/View --> FieldEditor view mode
- Fill/Public --> ApplicationFieldsRenderer salary case

### Files Changed

| File | Change |
|---|---|
| `src/components/jobs/postings/FieldEditor.tsx` | Green/blue/gray badges in view mode for salary fields. Purple container with info box in edit mode for salary config. |
| `src/components/jobs/postings/PostingFieldsBuilder.tsx` | Purple container with "Syncs to Candidate Profile" header and info box around salary config in Add Field section. |
| `src/components/forms/ApplicationFieldsRenderer.tsx` | Add green help text below salary input on public form. |

