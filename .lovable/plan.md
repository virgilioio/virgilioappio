

## Fix Location Smart Field Rendering on Public Job Posting

### Problem
The public job posting page (`PublicJobPosting.tsx`) renders custom fields inline with individual `if` blocks for each field type (text, email, select, salary, etc.). The `location` field type was never added here, so location smart fields silently fail to render. The `ApplicationFieldsRenderer` component has the correct location rendering, but it is not used on this page.

### Solution
Add a `location` field type handler in the inline custom fields rendering block (after the existing `salary` handler at line 844), following the same pattern already established in `ApplicationFieldsRenderer`.

### Technical Change

**File: `src/pages/PublicJobPosting.tsx` (after line 844, inside the custom fields map)**

Add location field rendering:
```tsx
{field.field_type === 'location' && (() => {
  const config = field.field_config || {}
  const locationSubFields = config.fields || ['city', 'state', 'country']
  const locationValue = (() => {
    try {
      return customFieldResponses[field.id] 
        ? JSON.parse(customFieldResponses[field.id]) 
        : {}
    } catch { return {} }
  })()
  const updateLocation = (key: string, val: string) => {
    const next = { ...locationValue, [key]: val }
    setCustomFieldResponses(prev => ({ 
      ...prev, 
      [field.id]: JSON.stringify(next) 
    }))
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-green-600">
          Syncs to your candidate profile
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {locationSubFields.includes('city') && (
          <Input
            placeholder="City"
            value={locationValue.city || ''}
            onChange={(e) => updateLocation('city', e.target.value)}
          />
        )}
        {locationSubFields.includes('state') && (
          <Input
            placeholder="State / Province"
            value={locationValue.state || ''}
            onChange={(e) => updateLocation('state', e.target.value)}
          />
        )}
        {locationSubFields.includes('country') && (
          <Input
            placeholder="Country"
            value={locationValue.country || ''}
            onChange={(e) => updateLocation('country', e.target.value)}
          />
        )}
      </div>
    </div>
  )
})()}
```

Also add green "Syncs to profile" help text to the existing salary handler (lines 828-844) for visual consistency, matching the `ApplicationFieldsRenderer` pattern.

### Files Modified

| File | Change |
|---|---|
| `src/pages/PublicJobPosting.tsx` | Add `location` field type rendering block after salary; add sync help text to salary |

