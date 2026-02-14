

## Add Country-Level Location Options to Sourcing Filter

### Problem
The location selector in sourcing projects only has country-level entries for US, Canada, Mexico, and a handful of LATAM countries. If you want to search for candidates in, say, Germany, India, or Australia, there's no option available.

### Solution
Add a comprehensive list of country-level entries to `src/constants/locations.ts`. This covers all major hiring markets globally.

### Countries to Add (grouped by region)

**Europe**: United Kingdom, Germany, France, Spain, Italy, Netherlands, Switzerland, Sweden, Norway, Denmark, Finland, Ireland, Austria, Belgium, Portugal, Poland, Czech Republic, Romania, Greece, Hungary, Ukraine, Croatia, Slovakia, Slovenia, Bulgaria, Lithuania, Latvia, Estonia, Luxembourg, Iceland

**Asia-Pacific**: India, China, Japan, South Korea, Singapore, Australia, New Zealand, Philippines, Indonesia, Thailand, Vietnam, Malaysia, Taiwan, Hong Kong, Pakistan, Bangladesh, Sri Lanka, Nepal

**Middle East**: United Arab Emirates, Israel, Saudi Arabia, Qatar, Bahrain, Kuwait, Oman, Jordan, Lebanon, Turkey

**Africa**: South Africa, Nigeria, Kenya, Egypt, Ghana, Morocco, Tunisia, Ethiopia, Tanzania, Rwanda

**Caribbean / Central America**: Dominican Republic, Guatemala, Honduras, El Salvador, Nicaragua, Jamaica, Trinidad and Tobago, Puerto Rico

**South America (missing)**: Bolivia, Paraguay, Venezuela

### File Changed

**`src/constants/locations.ts`**
- Add ~80-90 new country-type entries before the closing bracket of the array
- Each follows the existing pattern: `{ value: "XX", label: "Country Name", country: "Country Name", countryCode: "XX", type: "country" }`
- Organized by region with comments for readability

### No Other Changes Needed
- The `LocationSelector` component already supports `type: 'country'` and displays "Country" as the subtitle
- The search/filter logic in the selector already works with all location types
- The `locationNormalization.ts` utility already handles country-code-based matching

