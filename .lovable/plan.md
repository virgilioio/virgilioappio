

# Generate Offer Document from Approved Offer

## Overview

After an offer is fully approved, a "Generate Offer" button appears below the approval banner. The user selects an Offer Letter Template, the system processes the template by replacing placeholders with the offer's field values, generates a PDF, and saves it as a candidate attachment.

## Changes

### 1. "Generate Offer" button in `CandidateOfferDetails.tsx`
Below the approved banner, add a **"Generate Offer"** button (Virgilio purple style). Clicking it opens a dialog/inline selector showing available Offer Letter Templates (from `useOfferTemplates('organization')`). Once a template is selected, the system:
1. Fetches the template content (HTML with `{{field.*}}` placeholders)
2. Calls `processOfferLetterTemplate()` from `offerLetterUtils.ts` to replace all placeholders with actual offer field values
3. Renders the processed HTML to PDF using `jspdf` + `html2canvas` (both already installed)
4. Uploads the PDF to `candidate-attachments` storage bucket
5. Creates a `candidate_attachments` record linking to the candidate
6. Updates the offer letter status to `finalized`
7. Shows success toast

### 2. New component: `GenerateOfferDialog.tsx`
A dialog/sheet that:
- Lists available offer letter templates from `useOfferTemplates`
- Shows template name and description
- Has a "Generate" button after selection
- Shows a loading state during PDF generation
- Closes on success

### 3. PDF generation utility: `src/utils/generateOfferPdf.ts`
A function that:
- Takes processed HTML content string
- Creates a hidden div, renders the HTML
- Uses `html2canvas` to capture it
- Converts to PDF via `jspdf`
- Returns a `Blob`

### 4. Wiring in `CandidateOfferDetails.tsx`
- Import `useOfferTemplates`, `useCandidateAttachments`, the generate dialog, and PDF utility
- Show the "Generate Offer" button only when `approvalRequest?.status === 'approved'`
- After successful generation, call `refetch()` on attachments so the file appears in the Attachments tab

### Files
- **New**: `src/components/candidates/GenerateOfferDialog.tsx` -- template selector dialog
- **New**: `src/utils/generateOfferPdf.ts` -- HTML-to-PDF generation
- **Modified**: `src/components/candidates/CandidateOfferDetails.tsx` -- add Generate Offer button below approved banner
- **Modified**: `src/hooks/useOfferLetters.ts` -- add `updateOfferLetterStatus` method (if not already present)

No database changes needed -- uses existing `candidate_attachments` table and `candidate-attachments` storage bucket.

