

# Wire Up Rejection Email Sending from Application Review Sheet

## Problem
The `handleReject` function in `useApplicationReview.ts` hardcodes `sendEmail: false` (line 187) and never constructs `emailData`. The UI toggle and template selector work visually but are completely ignored when rejecting.

## Fix — `src/hooks/useApplicationReview.ts`

Update `handleReject` to:

1. Read `rejectionConfig.sendEmail` and `rejectionConfig.rejectionEmailTemplateId`
2. When both are truthy, look up the selected template from `rejection_email_templates` table to get `subject` and `body`
3. Look up the user's active mail identity for `fromEmail`
4. Resolve placeholders in subject/body using the current candidate's data (name, email, job title, etc.)
5. Pass the full `emailData` object to `rejectCandidate.mutateAsync`:
   ```
   sendEmail: rejectionConfig.sendEmail && !!template,
   emailData: {
     fromEmail,
     toEmails: [currentCandidate.email],
     subject: resolvedSubject,
     bodyHtml: resolvedBody,
     candidateId: currentCandidate.candidateId,
     jobId,
   }
   ```

### Data needed at reject time
- **Template** (`subject`, `body`): Query `rejection_email_templates` by `rejectionConfig.rejectionEmailTemplateId` — can be fetched once when config changes or at reject time
- **From email**: Query `user_mail_identities` for the current user's first active identity (same pattern as `RejectionEmailComposer`)
- **Candidate email**: Already in `currentCandidate.email`
- **Placeholder resolution**: Use the existing placeholder resolution utility to replace `{{candidate.first_name}}`, `{{job.title}}`, etc.

### Implementation approach
- Add the template and identity lookups inside `handleReject` (fetched on-demand at rejection time, not pre-loaded)
- If `sendEmail` is true but candidate has no email or no active mail identity, show a toast warning and still reject without email
- Reuse the same placeholder resolution pattern used in `useBulkRejectCandidates.ts`

Single file change: `src/hooks/useApplicationReview.ts`, ~30 lines modified in `handleReject`.

