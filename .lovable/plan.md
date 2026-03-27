

# Display DOCX Resumes in the Resume Viewer (Client-Side)

## Problem

DOCX resumes currently rely on a server-side `convert-document-to-pdf` edge function that only produces a placeholder PDF. Users see "Converting..." indefinitely or "Conversion failed" — DOCX files are never actually viewable inline.

## Solution

Render DOCX files directly in the browser using **mammoth.js** (a lightweight library that converts DOCX to clean HTML). No server-side conversion needed.

## How it works

1. Detect DOCX file type (already done via `needsConversion`)
2. Fetch the DOCX blob from Supabase storage (signed URL already available)
3. Convert to HTML using `mammoth.convertToHtml()`
4. Render the HTML in a sandboxed container with styled formatting

## Files changed

| File | Change |
|------|--------|
| `package.json` | Add `mammoth` dependency |
| `src/components/candidates/DOCXResumeViewer.tsx` | **New** — component that fetches DOCX blob, converts via mammoth.js, renders styled HTML |
| `src/components/candidates/CandidateResumeViewer.tsx` | Replace the `needsConversion && conversionStatus !== 'completed'` branch with `<DOCXResumeViewer>` when we have a signed URL for a DOCX file. Remove dependency on conversion status for display. |

## DOCXResumeViewer design

- Props: `url: string`, `height: number`
- Fetches the DOCX file as ArrayBuffer
- Calls `mammoth.convertToHtml({ arrayBuffer })` 
- Renders result in a scrollable `<div>` with basic document styling (fonts, spacing, tables, lists)
- Shows loading spinner while converting, error state on failure
- Matches the same container style as `PDFResumeViewer` (rounded border, bg-muted/30, overflow-y-auto)

## Behavior change

- DOCX resumes render immediately client-side — no waiting for server conversion
- The conversion status banner is hidden when we can render DOCX directly
- Download buttons still work as before (original DOCX file)
- Falls back to "cannot preview" message only if mammoth conversion fails

