import { Candidate } from '@/hooks/useCandidates'

export interface OfferLetterData {
  candidate: Candidate
  job: any
  organization: any
  fieldValues: Record<string, any>
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

  // Replace field placeholders
  const fieldPlaceholders = Object.entries(data.fieldValues).reduce((acc, [key, value]) => {
    acc[`{{field.${key}}}`] = formatFieldValue(value)
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
 * Format field values for display in the template
 */
function formatFieldValue(value: any): string {
  if (value == null) return ''
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  
  if (value instanceof Date) {
    return value.toLocaleDateString()
  }
  
  if (typeof value === 'number') {
    return value.toString()
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