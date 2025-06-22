
import { useMemo } from 'react'
import { useCountries } from '@/hooks/useCountries'
import { useCountryFields } from '@/hooks/useCountryFields'

interface PlaceholderItem {
  key: string
  label: string
  category: 'organization' | 'country_field' | 'system' | 'job_request'
  description?: string
}

interface JobRequestData {
  title?: string
  description?: string
  department?: string
  level?: string
  location?: string
  salary_min?: number
  salary_max?: number
  currency?: string
  notes?: string
}

export function useAgreementPlaceholders(selectedCountryId?: string, jobRequestData?: JobRequestData) {
  const { countries } = useCountries()
  const selectedCountry = countries.find(c => c.id === selectedCountryId)
  const { fields } = useCountryFields(selectedCountry?.code)
  
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

    // Job request placeholders (if job request data is provided)
    if (jobRequestData) {
      items.push(
        { key: '{{job_title}}', label: 'Job Title', category: 'job_request', description: 'The title of the job request' },
        { key: '{{job_description}}', label: 'Job Description', category: 'job_request', description: 'Detailed job description' },
        { key: '{{job_department}}', label: 'Department', category: 'job_request', description: 'Job department' },
        { key: '{{job_level}}', label: 'Job Level', category: 'job_request', description: 'Job level (L1, L2, L3)' },
        { key: '{{job_location}}', label: 'Job Location', category: 'job_request', description: 'Job location' },
        { key: '{{job_salary_min}}', label: 'Minimum Salary', category: 'job_request', description: 'Minimum salary for the position' },
        { key: '{{job_salary_max}}', label: 'Maximum Salary', category: 'job_request', description: 'Maximum salary for the position' },
        { key: '{{job_currency}}', label: 'Salary Currency', category: 'job_request', description: 'Currency for salary range' },
        { key: '{{job_notes}}', label: 'Job Notes', category: 'job_request', description: 'Additional notes about the job request' }
      )
    }

    // Country-specific field placeholders
    if (selectedCountryId && fields.length > 0) {
      fields.forEach(field => {
        items.push({
          key: `{{${field.field_name}}}`,
          label: field.field_label,
          category: 'country_field',
          description: field.help_text || `${field.field_label} field value`
        })
      })
    }

    return items
  }, [selectedCountryId, fields, jobRequestData])

  const getPlaceholdersByCategory = (category: PlaceholderItem['category']) => {
    return placeholders.filter(p => p.category === category)
  }

  return {
    placeholders,
    getPlaceholdersByCategory
  }
}
