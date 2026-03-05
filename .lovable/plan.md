

# Update Offer Status from "finalized" to "approved"

A single database update to change the status of offer letter `1eaffa33-c4a0-4f76-89a6-16e1898cb6b7` from `finalized` to `approved`. This will make the "Generate Offer Letter" button visible in the UI.

**Change**: Run an UPDATE query setting `status = 'approved'` on the offer letter record for the current candidate/job.

No code changes needed -- this is a data fix only.

