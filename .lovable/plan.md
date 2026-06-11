## Plan

1. **Add splash readiness reporting to public careers routes**
   - Update `PublicCareersPage` to mark the Gio splash ready once its initial loading state finishes, including success, empty, and error states.
   - Update `VirgilioCareersPage` the same way.

2. **Keep behavior scoped**
   - Do not change auth bootstrapping, the splash animation, or protected app routes.
   - Keep the existing in-page careers loading spinners for the short data-fetching phase.

3. **Validate the fix**
   - Verify both `/virgilio-careers` and `/careers/:companySlug` can dismiss the splash after their data load resolves.
   - Confirm the page still shows the canonical careers empty/error states when applicable.