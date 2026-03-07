/**
 * Client-side CSV parser that handles:
 * - Quoted fields with commas
 * - Escaped quotes ("" inside quoted fields)
 * - Various line endings (CRLF, LF, CR)
 * - UTF-8 BOM
 */

export interface ParsedCSV {
  headers: string[]
  rows: string[][]
  totalRows: number
}

export function parseCSV(text: string): ParsedCSV {
  // Strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1)
  }

  const rows: string[][] = []
  let i = 0
  const len = text.length

  while (i < len) {
    const row: string[] = []
    while (i < len) {
      let value = ''
      if (text[i] === '"') {
        // Quoted field
        i++ // skip opening quote
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') {
              value += '"'
              i += 2
            } else {
              i++ // skip closing quote
              break
            }
          } else {
            value += text[i]
            i++
          }
        }
      } else {
        // Unquoted field
        while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          value += text[i]
          i++
        }
      }
      row.push(value.trim())

      if (i < len && text[i] === ',') {
        i++ // skip comma
      } else {
        break
      }
    }

    // Skip line endings
    if (i < len && text[i] === '\r') i++
    if (i < len && text[i] === '\n') i++

    // Skip empty rows
    if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
      rows.push(row)
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [], totalRows: 0 }
  }

  const headers = rows[0]
  const dataRows = rows.slice(1)

  return {
    headers,
    rows: dataRows,
    totalRows: dataRows.length,
  }
}

// Candidate field definitions for column mapping
export type CandidateField =
  | 'candidate_name'
  | 'email'
  | 'phone'
  | 'linkedin_url'
  | 'resume_url'
  | 'location_city'
  | 'location_state'
  | 'location_country'
  | 'profile_summary'
  | 'source'
  | 'skills'
  | '__skip__'

export const CANDIDATE_FIELD_OPTIONS: { value: CandidateField; label: string }[] = [
  { value: '__skip__', label: '— Skip —' },
  { value: 'candidate_name', label: 'Full Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'resume_url', label: 'Resume URL' },
  { value: 'location_city', label: 'City' },
  { value: 'location_state', label: 'State / Region' },
  { value: 'location_country', label: 'Country' },
  { value: 'profile_summary', label: 'Summary / Bio' },
  { value: 'source', label: 'Source' },
  { value: 'skills', label: 'Skills (comma-separated)' },
]

const AUTO_MAP: Record<string, CandidateField> = {
  name: 'candidate_name',
  'full name': 'candidate_name',
  'candidate name': 'candidate_name',
  'first name': 'candidate_name',
  candidate: 'candidate_name',
  email: 'email',
  'e-mail': 'email',
  'email address': 'email',
  phone: 'phone',
  telephone: 'phone',
  mobile: 'phone',
  'phone number': 'phone',
  linkedin: 'linkedin_url',
  'linkedin url': 'linkedin_url',
  'linkedin profile': 'linkedin_url',
  resume: 'resume_url',
  'resume url': 'resume_url',
  'cv url': 'resume_url',
  'cv link': 'resume_url',
  'resume link': 'resume_url',
  city: 'location_city',
  state: 'location_state',
  region: 'location_state',
  province: 'location_state',
  country: 'location_country',
  summary: 'profile_summary',
  bio: 'profile_summary',
  about: 'profile_summary',
  source: 'source',
  skills: 'skills',
}

export function autoMapHeaders(headers: string[]): Record<number, CandidateField> {
  const mapping: Record<number, CandidateField> = {}
  const usedFields = new Set<CandidateField>()

  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().trim()
    const field = AUTO_MAP[normalized]
    if (field && !usedFields.has(field)) {
      mapping[index] = field
      usedFields.add(field)
    } else {
      mapping[index] = '__skip__'
    }
  })

  return mapping
}
