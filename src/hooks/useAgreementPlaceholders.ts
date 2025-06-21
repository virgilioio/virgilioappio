
import { useMemo } from 'react'
import { useCountries } from '@/hooks/useCountries'
import { useCountryFields } from '@/hooks/useCountryFields'

interface PlaceholderItem {
  key: string
  label: string
  category: 'organization' | 'country_field' | 'system'
  description?: string
}

export function useAgreementPlaceholders(selectedCountryId?: string) {
  const { countries } = useCountries()
  const { fields } = useCountryFields()
  
  const placeholders = useMemo(() => {
    const items: PlaceholderItem[] = []

    // System placeholders
    items.push(
      { key: '{{current_date}}', label: 'Current Date', category: 'system', description: 'Today\'s date' },
      { key: '{{agreement_version}}', label: 'Agreement Version', category: 'system', description: 'Version number of this agreement' }
    )

    // Organization placeholders
    items.push(
      { key: '{{organization_name}}', label: 'Organization Name', category: 'organization', description: 'Client organization name' },
      { key: '{{organization_country}}', label: 'Organization Country', category: 'organization', description: 'Client organization country' },
      { key: '{{billing_poc_name}}', label: 'Billing Contact Name', category: 'organization', description: 'Billing point of contact' },
      { key: '{{billing_poc_email}}', label: 'Billing Contact Email', category: 'organization', description: 'Billing contact email address' },
      { key: '{{billing_poc_phone}}', label: 'Billing Contact Phone', category: 'organization', description: 'Billing contact phone number' }
    )

    // Country-specific field placeholders
    if (selectedCountryId) {
      const countryFields = fields.filter(field => field.country_id === selectedCountryId)
      
      countryFields.forEach(field => {
        items.push({
          key: `{{${field.field_name}}}`,
          label: field.field_label,
          category: 'country_field',
          description: field.help_text || `${field.field_label} field value`
        })
      })
    }

    return items
  }, [selectedCountryId, fields])

  const getPlaceholdersByCategory = (category: PlaceholderItem['category']) => {
    return placeholders.filter(p => p.category === category)
  }

  return {
    placeholders,
    getPlaceholdersByCategory
  }
}
