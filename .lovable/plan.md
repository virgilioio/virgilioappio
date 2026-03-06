

# Move Controls to Header & Reorder Sections

## Changes in `src/components/candidates/IndependentCandidateProfileSheet.tsx`

### 1. Move buttons to header, below candidate name
- After the candidate name row (line 285), add a new `div` containing:
  - `job_board_source` badge (if present)
  - `<AddToJobPipelineDialog>` ("Move to pipeline" button)
  - "Enrich from LinkedIn" button (if `canEnrich`)
- All in a horizontal `flex items-center gap-2` row

### 2. Remove the Controls Card
- Delete the entire Controls Card block (lines 348–377) since its contents now live in the header

### 3. Swap Contact Information above Career Summary
- In the accordion sections, move Contact Information before Career Summary
- Update `defaultValue` array order accordingly

