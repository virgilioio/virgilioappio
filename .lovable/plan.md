

# Enable Contact Enrichment via "Fetch Contact" Button in Chrome Extension

## Overview
When the user clicks "Fetch Contact" in the Chrome extension, it currently only scrapes the LinkedIn DOM for contact info (which rarely works). We'll add a server-side fallback that queries our enrichment provider through the GoGio API to retrieve email and phone numbers using the candidate's LinkedIn URL. This consumes 1 collect credit per successful lookup.

## User Experience
1. User clicks "Fetch Contact" on a LinkedIn profile
2. Step 1 (free): DOM scrape attempts to find contact info from LinkedIn's contact modal
3. Step 2 (1 credit): If DOM scrape finds nothing and a LinkedIn URL is available, the extension calls the GoGio API to fetch contact info
4. Toast messages:
   - Success: "Found 2 contact fields" (same as today)
   - No match: "No contact info found for this profile"
   - No credits: "Contact lookup limit reached for this month"
   - No LinkedIn URL: "LinkedIn URL required to fetch contact info"

## Changes

### 1. GoGio Backend -- Add `enrich` action to Chrome API Gateway
**File:** `supabase/functions/chrome-api-gateway/index.ts`

- Add `APOLLO_API_KEY` and `APOLLO_BULK_MATCH_URL` constants at the top (internal only, no user-facing references)
- Add `checkCollectCredit` and `incrementCollectCredits` helper functions (ported from `enrich-by-linkedin`)
- Add `handleEnrich` handler that:
  - Accepts `{ linkedin_url }` from the extension
  - Validates the LinkedIn URL is present
  - Checks credit availability for the user's tenant
  - Calls the enrichment provider's bulk_match API with the LinkedIn URL
  - On success: increments credits, returns `{ success, email, phone, contact_phones, contact_emails, title, company, credits_used, credits_remaining }`
  - Does NOT save to DB -- the extension just populates form fields (candidate isn't created yet)
- Add `'enrich'` case to the main router switch and `valid_actions` list

### 2. Chrome Extension API Client -- Add `enrichContact` method
**File (Chrome Helper Hub):** `src/lib/api.ts`

- Add `EnrichContactResponse` interface with `success`, `email`, `phone`, `credits_used`, `credits_remaining`, `error`, `error_code` fields
- Add `enrichContact(linkedinUrl: string)` method to `ApiClient` class that POSTs to `action=enrich`

### 3. Chrome Extension UI -- Update "Fetch Contact" button logic
**File (Chrome Helper Hub):** `src/components/extension/CandidateForm.tsx`

Update the `onClick` handler (lines 593-619) to:
1. First try DOM scrape (existing logic, free)
2. If DOM scrape returns no email and no phone, and `linkedinUrl` is available:
   - Call `apiClient.enrichContact(linkedinUrl)`
   - Populate email and phone fields from the response
   - Show appropriate toast based on result
3. Handle error cases:
   - `CREDITS_EXHAUSTED` -> toast.warning("Contact lookup limit reached for this month")
   - Other errors -> toast.error("Failed to fetch contact info")

## Credit Impact
- Each successful contact lookup consumes 1 collect credit from the tenant's monthly pool
- The free DOM scrape is always attempted first to avoid unnecessary credit usage
- Credit exhaustion is handled gracefully with a clear user message

