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
  | 'first_name'
  | 'last_name'
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
  | 'current_job_title'
  | 'company_current'
  | 'seniority_level'
  | 'years_experience'
  | '__skip__'

export const CANDIDATE_FIELD_OPTIONS: { value: CandidateField; label: string }[] = [
  { value: '__skip__', label: '— Skip —' },
  { value: 'candidate_name', label: 'Full Name' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'current_job_title', label: 'Job Title' },
  { value: 'company_current', label: 'Current Company' },
  { value: 'seniority_level', label: 'Seniority Level' },
  { value: 'years_experience', label: 'Years of Experience' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'resume_url', label: 'Resume / CV URL' },
  { value: 'location_city', label: 'City' },
  { value: 'location_state', label: 'State / Region' },
  { value: 'location_country', label: 'Country' },
  { value: 'profile_summary', label: 'Summary / Bio' },
  { value: 'source', label: 'Source' },
  { value: 'skills', label: 'Skills (comma-separated)' },
]

// Exact-match auto-map dictionary
const AUTO_MAP: Record<string, CandidateField> = {
  // Full name
  name: 'candidate_name',
  'full name': 'candidate_name',
  'candidate name': 'candidate_name',
  candidate: 'candidate_name',
  'nombre completo': 'candidate_name',

  // First name
  'first name': 'first_name',
  firstname: 'first_name',
  'given name': 'first_name',
  nombre: 'first_name',
  'primer nombre': 'first_name',
  'first': 'first_name',

  // Last name
  'last name': 'last_name',
  lastname: 'last_name',
  surname: 'last_name',
  'family name': 'last_name',
  apellido: 'last_name',
  apellidos: 'last_name',
  'last': 'last_name',

  // Email
  email: 'email',
  'e-mail': 'email',
  'email address': 'email',
  correo: 'email',
  'correo electrónico': 'email',
  'correo electronico': 'email',
  mail: 'email',

  // Phone
  phone: 'phone',
  telephone: 'phone',
  mobile: 'phone',
  'phone number': 'phone',
  tel: 'phone',
  teléfono: 'phone',
  telefono: 'phone',
  celular: 'phone',
  móvil: 'phone',
  movil: 'phone',

  // Job title
  'job title': 'current_job_title',
  title: 'current_job_title',
  position: 'current_job_title',
  'current title': 'current_job_title',
  'current position': 'current_job_title',
  'current role': 'current_job_title',
  cargo: 'current_job_title',
  puesto: 'current_job_title',
  rol: 'current_job_title',
  'título del puesto': 'current_job_title',

  // Company
  company: 'company_current',
  employer: 'company_current',
  'current company': 'company_current',
  'company name': 'company_current',
  organization: 'company_current',
  empresa: 'company_current',
  'empresa actual': 'company_current',
  compañía: 'company_current',

  // Seniority
  seniority: 'seniority_level',
  'seniority level': 'seniority_level',
  level: 'seniority_level',
  nivel: 'seniority_level',

  // Years of experience
  'years of experience': 'years_experience',
  'years experience': 'years_experience',
  experience: 'years_experience',
  'años de experiencia': 'years_experience',
  experiencia: 'years_experience',

  // LinkedIn
  linkedin: 'linkedin_url',
  'linkedin url': 'linkedin_url',
  'linkedin profile': 'linkedin_url',
  'perfil linkedin': 'linkedin_url',
  'linkedin link': 'linkedin_url',

  // Resume URL
  resume: 'resume_url',
  'resume url': 'resume_url',
  'cv url': 'resume_url',
  'cv link': 'resume_url',
  'resume link': 'resume_url',
  cv: 'resume_url',
  curriculum: 'resume_url',
  'curriculum vitae': 'resume_url',
  'enlace cv': 'resume_url',
  'link cv': 'resume_url',
  'resume file': 'resume_url',
  'cv pdf': 'resume_url',
  'archivo cv': 'resume_url',
  'resume/cv': 'resume_url',
  'cv url link': 'resume_url',
  'resume download': 'resume_url',
  'cv download': 'resume_url',
  'hoja de vida': 'resume_url',
  'resume attachment': 'resume_url',
  'cv attachment': 'resume_url',
  'doc url': 'resume_url',
  'doc link': 'resume_url',
  'file url': 'resume_url',
  'file link': 'resume_url',
  'resume pdf': 'resume_url',

  // Location
  city: 'location_city',
  ciudad: 'location_city',
  state: 'location_state',
  region: 'location_state',
  province: 'location_state',
  estado: 'location_state',
  provincia: 'location_state',
  región: 'location_state',
  country: 'location_country',
  país: 'location_country',
  pais: 'location_country',

  // Summary
  summary: 'profile_summary',
  bio: 'profile_summary',
  about: 'profile_summary',
  resumen: 'profile_summary',
  descripción: 'profile_summary',
  descripcion: 'profile_summary',

  // Source
  source: 'source',
  fuente: 'source',
  origen: 'source',

  // Skills
  skills: 'skills',
  habilidades: 'skills',
  competencias: 'skills',
}

// Substring fallback rules — if exact match fails, check if the header contains these keywords
const SUBSTRING_FALLBACKS: { keywords: string[]; field: CandidateField }[] = [
  { keywords: ['resume', 'cv', 'curriculum', 'hoja de vida'], field: 'resume_url' },
  { keywords: ['linkedin'], field: 'linkedin_url' },
  { keywords: ['email', 'correo', 'e-mail', 'mail'], field: 'email' },
  { keywords: ['phone', 'tel', 'móvil', 'movil', 'celular'], field: 'phone' },
]

export function autoMapHeaders(headers: string[]): Record<number, CandidateField> {
  const mapping: Record<number, CandidateField> = {}
  const usedFields = new Set<CandidateField>()

  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().trim()

    // 1. Try exact match
    const exactField = AUTO_MAP[normalized]
    if (exactField && !usedFields.has(exactField)) {
      mapping[index] = exactField
      usedFields.add(exactField)
      return
    }

    // 2. Try substring fallback
    for (const rule of SUBSTRING_FALLBACKS) {
      if (usedFields.has(rule.field)) continue
      if (rule.keywords.some(kw => normalized.includes(kw))) {
        mapping[index] = rule.field
        usedFields.add(rule.field)
        return
      }
    }

    // 3. Skip
    mapping[index] = '__skip__'
  })

  return mapping
}

/**
 * Detect skipped columns that contain URL-like values.
 * Returns indices of columns that look like they have URLs but are set to skip.
 */
export function detectSkippedUrlColumns(
  headers: string[],
  rows: string[][],
  mapping: Record<number, CandidateField>,
): number[] {
  const suspicious: number[] = []
  const sampleRows = rows.slice(0, 10)

  headers.forEach((_, index) => {
    if (mapping[index] !== '__skip__') return
    const hasUrls = sampleRows.some(row => {
      const val = row[index]?.trim()
      return val && (val.startsWith('http://') || val.startsWith('https://'))
    })
    if (hasUrls) suspicious.push(index)
  })

  return suspicious
}
