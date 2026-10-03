# Create Offer sheet redesign

## Goal
Replace the old floating offer composer with the supplied 820px right-side sheet while preserving every existing field, opening/Req ID rule, validation, draft, approval, and save behavior.

## Build
- Convert the composer shell to a full-height right sheet with the specified header, three-step rail, cream content area, and fixed footer.
- Present offer-form selection in Template, configured fields in Terms, and a review/approval-ready summary in Letter & approvals.
- Group configured fields into Role & start, Compensation, Benefits & conditions, and Additional terms without renaming or removing any field.
- Keep the Req ID picker first, preserve target-start defaults, and retain unavailable-opening protections.
- Add live compensation summary when recognizable salary/equity/bonus fields exist; otherwise omit unavailable calculations rather than invent data.
- Preserve draft restore, auto-save, explicit Save draft, close behavior, edit behavior, and final offer persistence.

## Validation
- Check TypeScript and the preview build.
- Open the current candidate route and verify sheet dimensions, step navigation, field persistence, and responsive behavior without submitting a real offer.
