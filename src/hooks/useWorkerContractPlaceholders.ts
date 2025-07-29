import { useState, useEffect } from 'react'
import { useWorkerComplianceFields } from '@/hooks/useWorkerComplianceFields'
import { useCountryFields } from '@/hooks/useCountryFields'

export interface PlaceholderItem {
  key: string
  label: string
  category: 'system' | 'worker_contract' | 'organization_compliance' | 'country_compliance'
  description?: string
}

export function useWorkerContractPlaceholders(selectedCountryId?: string, selectedCountryName?: string) {
  const [placeholders, setPlaceholders] = useState<PlaceholderItem[]>([])
  const { fields: countryFields } = useWorkerComplianceFields(selectedCountryName)
  const { fields: organizationFields } = useCountryFields()

  useEffect(() => {
    console.log('🔍 useWorkerContractPlaceholders: Country fields:', countryFields)
    console.log('🔍 useWorkerContractPlaceholders: Selected country name:', selectedCountryName)
    const systemPlaceholders: PlaceholderItem[] = [
      { key: '{{current_date}}', label: 'Current Date', category: 'system', description: 'Today\'s date' },
      { key: '{{template_version}}', label: 'Template Version', category: 'system', description: 'Version of the contract template' },
      { key: '{{contract_number}}', label: 'Contract Number', category: 'system', description: 'Auto-generated contract number' }
    ]

    const workerContractPlaceholders: PlaceholderItem[] = [
      { key: '{{worker_name}}', label: 'Worker Full Name', category: 'worker_contract', description: 'Full name of the worker' },
      { key: '{{worker_id}}', label: 'Worker ID', category: 'worker_contract', description: 'Unique worker identifier' },
      { key: '{{legal_first_name}}', label: 'Legal First Name', category: 'worker_contract', description: 'Legal first name' },
      { key: '{{legal_last_name}}', label: 'Legal Last Name', category: 'worker_contract', description: 'Legal last name' },
      { key: '{{citizenship}}', label: 'Citizenship', category: 'worker_contract', description: 'Worker\'s citizenship' },
      { key: '{{country_of_residence}}', label: 'Country of Residence', category: 'worker_contract', description: 'Worker\'s country of residence' },
      { key: '{{job_title}}', label: 'Job Title', category: 'worker_contract', description: 'Position title' },
      { key: '{{worker_type}}', label: 'Worker Type', category: 'worker_contract', description: 'Employee or Contractor' },
      { key: '{{contract_type}}', label: 'Contract Type', category: 'worker_contract', description: 'Type of employment contract' },
      { key: '{{start_date}}', label: 'Start Date', category: 'worker_contract', description: 'Contract start date' },
      { key: '{{end_date}}', label: 'End Date', category: 'worker_contract', description: 'Contract end date' },
      { key: '{{base_salary}}', label: 'Base Salary', category: 'worker_contract', description: 'Base salary amount' },
      { key: '{{currency}}', label: 'Currency', category: 'worker_contract', description: 'Salary currency' },
      { key: '{{payment_period}}', label: 'Payment Period', category: 'worker_contract', description: 'Payment frequency period' },
      { key: '{{working_location}}', label: 'Working Location', category: 'worker_contract', description: 'Work location' },
      { key: '{{scope_of_work}}', label: 'Scope of Work', category: 'worker_contract', description: 'Description of work scope' },
      { key: '{{employment_terms}}', label: 'Employment Terms', category: 'worker_contract', description: 'Terms of employment' },
      { key: '{{seniority_level}}', label: 'Seniority Level', category: 'worker_contract', description: 'Job seniority level' },
      { key: '{{organization_name}}', label: 'Organization Name', category: 'worker_contract', description: 'Name of the organization' },
      { key: '{{department_name}}', label: 'Department', category: 'worker_contract', description: 'Department name' },
      { key: '{{manager_name}}', label: 'Manager Name', category: 'worker_contract', description: 'Name of the manager' }
    ]

    // Generate placeholders from country compliance fields
    const countryCompliancePlaceholders: PlaceholderItem[] = countryFields.map(field => ({
      key: `{{country_${field.field_name}}}`,
      label: field.field_label,
      category: 'country_compliance' as const,
      description: `Country compliance field: ${field.field_label}`
    }))

    // Generate placeholders from organization compliance fields
    const organizationCompliancePlaceholders: PlaceholderItem[] = organizationFields.map(field => ({
      key: `{{org_${field.field_name}}}`,
      label: field.field_label,
      category: 'organization_compliance' as const,
      description: `Organization compliance field: ${field.field_label}`
    }))

    const allPlaceholders = [
      ...systemPlaceholders,
      ...workerContractPlaceholders,
      ...organizationCompliancePlaceholders,
      ...countryCompliancePlaceholders
    ]

    setPlaceholders(allPlaceholders)
  }, [countryFields, organizationFields, selectedCountryName])

  const getPlaceholdersByCategory = (category: PlaceholderItem['category']) => {
    return placeholders.filter(p => p.category === category)
  }

  return {
    placeholders,
    getPlaceholdersByCategory
  }
}