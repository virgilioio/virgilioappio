# Gio Fit dossier PDF export

## Goal
Replace the in-job candidate profile’s generic download modal with a dossier-aware export flow. The preview and printable document will use one shared React document tree, producing selectable text through the browser’s native print-to-PDF flow.

## Build
- Use the uploaded `candidate-fit-export.jsx` and visual-reference HTML as the final visual authority once provided; preserve the current Gio design tokens and dossier data rules.
- Lift the dossier view mode so Export opens in the tab’s current Internal or Client-ready mode.
- Replace the in-job export modal with the 740px two-column **Export dossier** dialog: version selector, three effective include switches, locale-derived Letter/A4 selector, real scaled page-one preview, live shared page count, semantic filename, mode-specific note, and preparing state.
- Switching to Client-ready will turn contact details off automatically and relabel validation content; every option will alter the shared document data and page count.
- Build a shared dossier document model and shared presentational primitives for masthead, summary, skill groups, experience, education, provenance, dimensions, evidence, and validation points. The tab and print surfaces will consume the same normalized data and visual primitives rather than maintaining separate content logic.
- Render Letter and A4 pages at native CSS page geometry with fixed margins, searchable text, embedded Poppins/Inter, running headers/footers, derived `Page n of m`, internal watermark, and print-safe break rules.
- Print all evidence linearly. Client-ready output will remove salary, weights, points, weighted total, rubric mechanics, validation priorities, contact details by default, and the internal watermark.
- Open a dedicated print document from the shared React tree and invoke the browser print dialog. Keep the export dialog open through preparation, then close after the printable document is ready and printing begins.
- Keep the existing non-job candidate profile export unchanged because it has no Gio Fit dossier or job context.

## Technical details
- Add a pure `pageCount({ evidence, validation, content })` helper used by both preview metadata and every footer.
- Derive page allocation from measured print sections without shrinking body copy below 10.5px; evidence-off targets three pages, while long content may grow beyond four.
- Use CSS `@page`, `break-inside: avoid`, and `break-after: avoid`; no canvas screenshots, rasterized type, or parallel jsPDF dossier template.
- Default page size from browser/workspace locale, falling back to Letter for US/Canada/Mexico and A4 elsewhere.
- Use available fields only. Location and contact data render when present; unsupported work-authorisation, availability, and candidate-language metadata remain omitted.

## Verification
- Verify dialog behavior, current-mode defaulting, automatic contact redaction, all switches, filename, Letter/A4, and loading/close timing.
- Verify page-one preview matches the real print component and updates live.
- Verify evidence-off yields three pages and all footer totals match the dialog count through the shared helper.
- Verify Internal and Client-ready redactions, full evidence, provenance, watermark, headers/footers, page breaks, and no orphaned headings.
- Print both modes to PDF, render every page to images for visual inspection, and confirm text extraction/searchability.
- Verify the preview at the current desktop width and a narrow viewport, then confirm a clean build and no unrelated database changes.
