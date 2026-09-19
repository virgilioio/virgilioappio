# Fix scorecard formatting across dossier outputs

## What will change
- Detect scorecard notes stored as Markdown and convert them into structured HTML before rendering.
- Preserve headings, numbered sections, nested bullet lists, bold, italics, quotes, and paragraph spacing in the internal Gio Fit section.
- Apply the same normalization to the public dossier response and PDF export so all three outputs match.
- Keep collapsed scorecard previews as concise plain text while expanded and exported views retain structure.

## Technical details
- Reuse the existing Markdown converter and safe HTML renderer for authenticated dossier views.
- Add equivalent server-side Markdown parsing and sanitization for the public dossier payload.
- Validate against the actual stored scorecard format shown in the screenshot, then run type/build checks and visually inspect a rendered PDF page.
