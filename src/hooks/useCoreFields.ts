import { FieldType } from './useApplicationFields'

export interface CoreField {
  field_name: string
  field_label: string
  field_type: FieldType
  is_required: boolean
  placeholder_text?: string
  help_text?: string
  accepted_file_types?: string
  max_file_size_mb?: number
  display_order: number
}

export const CORE_FIELDS: CoreField[] = [
  {
    field_name: 'resume',
    field_label: 'Resume/CV',
    field_type: 'file',
    is_required: true,
    accepted_file_types: '.pdf,.doc,.docx',
    max_file_size_mb: 10,
    help_text: 'Upload your resume in PDF or Word format',
    display_order: 0
  },
  {
    field_name: 'candidate_name',
    field_label: 'Full Name',
    field_type: 'text',
    is_required: true,
    placeholder_text: 'Enter your full name',
    display_order: 1
  },
  {
    field_name: 'email',
    field_label: 'Email Address',
    field_type: 'email',
    is_required: true,
    placeholder_text: 'your.email@example.com',
    display_order: 2
  },
  {
    field_name: 'phone',
    field_label: 'Phone Number',
    field_type: 'text',
    is_required: false,
    placeholder_text: '+1 (555) 123-4567',
    display_order: 3
  },
  {
    field_name: 'linkedin_url',
    field_label: 'LinkedIn Profile',
    field_type: 'url',
    is_required: false,
    placeholder_text: 'https://linkedin.com/in/yourprofile',
    display_order: 4
  },
]

export function useCoreFields() {
  return {
    coreFields: CORE_FIELDS,
    getCoreField: (fieldName: string) => CORE_FIELDS.find(f => f.field_name === fieldName),
    getCoreFieldsByType: (fieldType: FieldType) => CORE_FIELDS.filter(f => f.field_type === fieldType)
  }
}