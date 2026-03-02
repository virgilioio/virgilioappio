

# Upgrade Confirmation Email to use Lexical Template Editors

## Problem
The workspace Confirmation Email Automation uses plain `<Input>` and `<Textarea>` elements, so placeholders appear as raw `{{text}}`. The stage email automation uses Lexical-based `SubjectTemplateEditor` and `BodyTemplateEditor`, which render placeholders as interactive purple pill badges and support direct insertion from the PlaceholderHelper sidebar.

This creates two completely different experiences for the same type of task (composing email templates with placeholders).

## Solution
Replace the plain input/textarea in `ConfirmationEmailAutomation` with the same Lexical editors used in `EmailSequenceBuilder`, including:
- `SubjectTemplateEditor` for the subject line (single-line, purple badges)
- `BodyTemplateEditor` for the email body (rich text, purple badges)
- Wire `PlaceholderHelper` with an `onInsert` callback that inserts directly into the last focused editor
- Track last focused field (subject vs body) to route placeholder insertions correctly

## Changes

**File: `src/components/settings/automations/ConfirmationEmailAutomation.tsx`**

1. Replace `Input` import with `SubjectTemplateEditor` + `SubjectTemplateEditorHandle`
2. Replace `Textarea` import with `BodyTemplateEditor` + `BodyTemplateEditorHandle`
3. Add `useRef` for both editor handles (to call `insertPlaceholder()`)
4. Add `lastFocusedField` state to track which editor was last focused (`'subject' | 'body'`)
5. Add `handleInsertPlaceholder` function that routes to the correct editor ref
6. Pass `onInsert={handleInsertPlaceholder}` to `PlaceholderHelper`
7. Replace `<Input>` with `<SubjectTemplateEditor>` passing `ref`, `value`, `onChange`, `onFocus`, and `placeholder`
8. Replace `<Textarea>` with `<BodyTemplateEditor>` passing `ref`, `value`, `onChange`, and `onFocus`
9. Remove unused `Input`, `Textarea` imports

### Structure after change

```text
ConfirmationEmailAutomation
+-- grid (3-col)
|   +-- col-span-2
|   |   +-- Card
|   |   |   +-- Subject: SubjectTemplateEditor (Lexical, purple badges)
|   |   |   +-- Body: BodyTemplateEditor (Lexical, purple badges)
|   |   +-- Info Card (workspace default note)
|   +-- col-span-1
|       +-- PlaceholderHelper (onInsert -> insert into last focused editor)
```

This exactly matches the pattern in `EmailSequenceBuilder.tsx`, ensuring full visual and behavioral consistency across the app.

