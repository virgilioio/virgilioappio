

## Remove Profile Summary from Public Job Application Form

### Problem
The "Profile Summary" text field is shown to candidates on the public job application form, but anything they type gets silently overwritten seconds later by the AI-generated profile summary (background enrichment). This is misleading UX -- candidates waste time writing something that gets discarded.

### What Changes

**File 1: `src/pages/PublicJobPosting.tsx`**

- Remove the "Profile Summary" rich text editor block (lines 690-699) from the public form UI
- Keep `profile_summary` in the state object (it still gets populated by AI resume parsing during the form session), but remove the manual text input
- The AI-parsed profile summary from resume upload still flows through correctly -- it just won't have a visible editor for manual entry

**File 2: `src/hooks/useCoreFields.ts`**

- Remove `profile_summary` from the `CORE_FIELDS` array (the entry at display_order 5)
- This removes it from the default core fields that render in public forms
- Internal candidate forms (`CandidateFormSheet`) have their own profile summary field (a rich text editor) that is NOT driven by `CORE_FIELDS`, so internal functionality is unaffected

### What Stays the Same

- Internal candidate creation forms still have the profile summary editor (it's hardcoded in `CandidateFormSheet`, not from `CORE_FIELDS`)
- AI resume parsing during public form still populates `profile_summary` in the background state
- Background enrichment (`enrich-candidate-profile`) still generates and saves the AI profile summary after submission
- The `profile_summary` value from AI parsing is still sent in the submission payload and saved to the candidate record

### Technical Details

| Area | Impact |
|---|---|
| Public form UI | Profile Summary text box removed -- cleaner form |
| Core fields hook | `profile_summary` entry removed from defaults |
| Internal forms | No change -- they use their own rich text editor |
| AI enrichment | No change -- still runs after submission |
| Data flow | profile_summary from AI resume parse still saved correctly |

