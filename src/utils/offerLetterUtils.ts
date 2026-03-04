import { Candidate } from '@/hooks/useCandidates'

export interface OfferLetterData {
  candidate: Candidate
  job: any
  organization: any
  fieldValues: Record<string, any>
  /** Optional: field type metadata keyed by field_name for smart formatting */
  fieldTypes?: Record<string, string>
  /** Optional: recruiter name lookup keyed by user_id */
  recruiterLookup?: Record<string, string>
}

// Label maps for enum-style fields
const employmentTypeLabels: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  temporary: 'Temporary',
  internship: 'Internship',
  freelance: 'Freelance',
}

const workLocationLabels: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  on_site: 'On-site',
}

/**
 * Replace placeholders in template content with actual data
 */
export function processOfferLetterTemplate(
  templateContent: string, 
  data: OfferLetterData
): string {
  let processedContent = templateContent

  // Replace candidate placeholders
  const candidatePlaceholders = {
    '{{candidate.name}}': data.candidate.candidate_name || '',
    '{{candidate.location_city}}': data.candidate.location_city || '',
    '{{candidate.location_state}}': data.candidate.location_state || '',
    '{{candidate.location_country}}': data.candidate.location_country || '',
    '{{candidate.salary_amount}}': data.candidate.salary_amount?.toString() || '',
    '{{candidate.salary_currency}}': data.candidate.salary_currency || '',
    '{{candidate.salary_period}}': data.candidate.salary_period || ''
  }

  // Replace job placeholders
  const jobPlaceholders = {
    '{{job.title}}': data.job?.title || '',
    '{{job.department}}': data.job?.department || '',
    '{{job.location}}': data.job?.location || '',
    '{{job.level}}': data.job?.level || '',
    '{{job.salary_min}}': data.job?.salary_min?.toString() || '',
    '{{job.salary_max}}': data.job?.salary_max?.toString() || '',
    '{{job.currency}}': data.job?.currency || '',
    '{{job.description}}': data.job?.description || ''
  }

  // Replace organization placeholders
  const organizationPlaceholders = {
    '{{organization.name}}': data.organization?.name || '',
    '{{organization.country}}': data.organization?.country || '',
    '{{organization.default_currency}}': data.organization?.default_currency || ''
  }

  // Replace field placeholders with smart formatting
  const fieldPlaceholders = Object.entries(data.fieldValues).reduce((acc, [key, value]) => {
    const fieldType = data.fieldTypes?.[key]
    acc[`{{field.${key}}}`] = formatFieldValue(value, fieldType, data.recruiterLookup)
    return acc
  }, {} as Record<string, string>)

  // Apply all replacements
  const allPlaceholders = {
    ...candidatePlaceholders,
    ...jobPlaceholders,
    ...organizationPlaceholders,
    ...fieldPlaceholders
  }

  Object.entries(allPlaceholders).forEach(([placeholder, value]) => {
    processedContent = processedContent.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value)
  })

  return processedContent
}

/**
 * Format field values for display in the template, with smart type handling
 */
function formatFieldValue(value: any, fieldType?: string, recruiterLookup?: Record<string, string>): string {
  if (value == null) return ''

  // Smart field type formatting
  if (fieldType) {
    switch (fieldType) {
      case 'salary': {
        if (typeof value === 'object' && value !== null) {
          const { amount, currency, period } = value
          const formattedAmount = amount ? Number(amount).toLocaleString() : ''
          const parts = [currency, formattedAmount].filter(Boolean).join(' ')
          return period ? `${parts} per ${period}` : parts
        }
        break
      }
      case 'location': {
        if (typeof value === 'object' && value !== null) {
          const { city, state, country } = value
          return [city, state, country].filter(Boolean).join(', ')
        }
        break
      }
      case 'recruiter': {
        if (typeof value === 'string' && recruiterLookup) {
          return recruiterLookup[value] || value
        }
        break
      }
      case 'employment_type': {
        if (typeof value === 'string') {
          return employmentTypeLabels[value] || value
        }
        break
      }
      case 'work_location': {
        if (typeof value === 'string') {
          return workLocationLabels[value] || value
        }
        break
      }
      case 'date': {
        if (typeof value === 'string') {
          try {
            const date = new Date(value + 'T00:00:00')
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          } catch {
            return value
          }
        }
        break
      }
    }
  }

  // Generic fallback formatting
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  
  if (value instanceof Date) {
    return value.toLocaleDateString()
  }
  
  if (typeof value === 'number') {
    return value.toString()
  }

  if (typeof value === 'object') {
    // Last resort for unrecognized objects
    return JSON.stringify(value)
  }
  
  return String(value)
}

/**
 * Generate a default title for the offer letter
 */
export function generateOfferLetterTitle(candidate: Candidate, job: any): string {
  return `Offer Letter - ${candidate.candidate_name} - ${job?.title || 'Position'}`
}

/**
 * Validate required fields for offer letter creation
 */
export function validateOfferLetterData(data: OfferLetterData, requiredFields: string[]): string[] {
  const errors: string[] = []
  
  if (!data.candidate.candidate_name) {
    errors.push('Candidate name is required')
  }
  
  if (!data.job?.title) {
    errors.push('Job title is required')
  }
  
  if (!data.organization?.name) {
    errors.push('Organization name is required')
  }
  
  // Check required template fields
  requiredFields.forEach(fieldName => {
    if (!data.fieldValues[fieldName] || data.fieldValues[fieldName] === '') {
      errors.push(`${fieldName} is required`)
    }
  })
  
  return errors
}
