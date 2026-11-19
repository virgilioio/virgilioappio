import { describe, expect, it } from 'vitest'
import { jobValueFor, offerPhone, offerPrefill } from '@/lib/offerPrefill'
import { formatOfferValue } from '@/lib/offerValues'
import { OFFER_FIELD_TYPES, SMART_DEFAULT_LABEL } from '@/components/settings/offerForms/fieldTypes'
import { offerCategory } from '@/lib/sign/formats'

const DEP = '11111111-1111-4111-8111-111111111111'
const CLI = '22222222-2222-4222-8222-222222222222'
const job = { department_id: DEP, organization_id: CLI, employment_type: 'contract', work_mode: 'hybrid' }
const fields = [
  { field_name: 'department', field_type: 'department' },
  { field_name: 'client', field_type: 'client' },
  { field_name: 'employment_type', field_type: 'employment_type' },
  { field_name: 'work_location', field_type: 'work_location' },
  { field_name: 'job_title', field_type: 'text' },
]

describe('offer pre-fill from the job', () => {
  it('fills department, client, employment type and work location', () => {
    expect(offerPrefill(fields, {}, job)).toEqual({
      department: DEP,
      client: CLI,
      employment_type: 'contract',
      work_location: 'hybrid',
    })
  })

  it('never replaces what the recruiter chose or typed', () => {
    const values = { department: 'other-dept', client: CLI, employment_type: 'full_time', work_location: '  ' }
    expect(offerPrefill(fields, values, job)).toEqual({ work_location: 'hybrid' })
  })

  it('fills nothing the job doesn\'t say, and nothing without a job', () => {
    expect(offerPrefill(fields, {}, { department_id: null, organization_id: '', employment_type: null, work_mode: null })).toEqual({})
    expect(offerPrefill(fields, {}, null)).toEqual({})
  })

  it('reads the job\'s values as the offer stores them', () => {
    expect(jobValueFor('employment_type', { employment_type: 'freelance' })).toBe('contract')
    expect(jobValueFor('employment_type', { employment_type: 'vendor' })).toBe('vendor')
    expect(jobValueFor('employment_type', { employment_type: 'L1 - Specialists' })).toBeNull()
    expect(jobValueFor('work_location', { work_mode: 'On-site' })).toBe('onsite')
    expect(jobValueFor('work_location', { work_mode: 'onsite' })).toBe('onsite')
    expect(jobValueFor('work_location', { work_mode: 'anywhere' })).toBeNull()
    expect(jobValueFor('text', job)).toBeNull()
  })
})

describe('department and client on an offer', () => {
  it('are offered in the form editor with their own labels', () => {
    const types = OFFER_FIELD_TYPES.map((t) => t.value)
    expect(types).toContain('department')
    expect(types).toContain('client')
    expect(SMART_DEFAULT_LABEL.department).toBe('Department')
    expect(SMART_DEFAULT_LABEL.client).toBe('Client')
  })

  it('read as names, never ids', () => {
    const ctx = { departmentName: (id: string) => (id === DEP ? 'Operations' : null), clientName: (id: string) => (id === CLI ? 'Virgilio' : null) }
    expect(formatOfferValue(DEP, 'department', ctx)).toBe('Operations')
    expect(formatOfferValue(CLI, 'client', ctx)).toBe('Virgilio')
    // An id with no name yet reads as nothing, not the id.
    expect(formatOfferValue('33333333-3333-4333-8333-333333333333', 'client', ctx)).toBeNull()
    // Text typed before the field existed stays as typed.
    expect(formatOfferValue('Acme Corp', 'client', ctx)).toBe('Acme Corp')
  })

  it('sit with the job\'s details in Gio Sign\'s field list', () => {
    expect(offerCategory({ key: 'team', label: 'Team', type: 'department' })).toBe('Job')
    expect(offerCategory({ key: 'customer', label: 'Customer', type: 'client' })).toBe('Job')
  })
})

describe('offer pre-fill from the job title and the candidate', () => {
  // The three forms' own fields, as they are in the database.
  const forms = [
    { field_name: 'job_title', field_label: 'Job Title', field_type: 'text' },
    { field_name: 'candidate_s_full_legal_name', field_label: "Candidate's Full Legal Name", field_type: 'text' },
    { field_name: 'candidate_s_full_name', field_label: "Candidate's Full Legal Name", field_type: 'text' },
    { field_name: 'candidate_s_personal_email', field_label: "Candidate's Personal Email", field_type: 'email' },
    { field_name: 'personal_email', field_label: 'Personal Email', field_type: 'email' },
    { field_name: 'phone_number', field_label: 'Phone Number', field_type: 'phone', field_config: { defaultCountryCode: '+1' } },
    { field_name: 'candidate_s_location', field_label: "Candidate's Location", field_type: 'location', field_config: { fields: ['city', 'state', 'country'] } },
    { field_name: 'candidate_s_location_of_origin', field_label: "Candidate's Location of Origin", field_type: 'location', field_config: { fields: ['country'] } },
    { field_name: 'job_location', field_label: 'Job location', field_type: 'location', field_config: { fields: ['state', 'country'] } },
    { field_name: 'job_description', field_label: 'Job Description', field_type: 'textarea' },
  ]
  const person = {
    candidate_name: 'Priya Raman', email: 'priya@example.com', email_status: 'verified', phone: '+52 55-1234-5678',
    location_city: 'Guadalajara', location_state: 'Jalisco', location_country: 'Mexico',
  }

  it('fills the job title and the candidate\'s details, and nothing else', () => {
    expect(offerPrefill(forms, {}, { title: 'Senior Product Designer' }, person)).toEqual({
      job_title: 'Senior Product Designer',
      candidate_s_full_legal_name: 'Priya Raman',
      candidate_s_full_name: 'Priya Raman',
      candidate_s_personal_email: 'priya@example.com',
      personal_email: 'priya@example.com',
      phone_number: '+525512345678',
      candidate_s_location: JSON.stringify({ city: 'Guadalajara', state: 'Jalisco', country: 'Mexico' }),
    })
  })

  it('never fills where someone was born or where the job is', () => {
    const patch = offerPrefill(forms, {}, { title: 'X' }, person)
    expect(patch.candidate_s_location_of_origin).toBeUndefined()
    expect(patch.job_location).toBeUndefined()
    expect(patch.job_description).toBeUndefined()
  })

  it('never replaces what is already there', () => {
    const values = { job_title: 'Lead Designer', phone_number: '+15550001111', personal_email: '' }
    const patch = offerPrefill(forms, values, { title: 'Senior Product Designer' }, person)
    expect(patch.job_title).toBeUndefined()
    expect(patch.phone_number).toBeUndefined()
    expect(patch.personal_email).toBe('priya@example.com')
  })

  it('leaves a guessed email off the offer', () => {
    expect(offerPrefill(forms, {}, null, { ...person, email_status: 'extrapolated' }).personal_email).toBeUndefined()
    expect(offerPrefill(forms, {}, null, { ...person, email_status: null }).personal_email).toBe('priya@example.com')
    expect(offerPrefill(forms, {}, null, { ...person, email: 'not an email' }).personal_email).toBeUndefined()
  })

  it('never fills someone else\'s email, phone or name from the candidate', () => {
    const others = [
      { field_name: 'manager_email', field_label: 'Hiring manager email', field_type: 'email' },
      { field_name: 'emergency_phone', field_label: 'Emergency contact phone', field_type: 'phone' },
      { field_name: 'manager_full_name', field_label: "Manager's full name", field_type: 'text' },
    ]
    expect(offerPrefill(others, {}, null, person)).toEqual({})
  })

  it('keeps only the parts of a place the field asks for', () => {
    const field = { field_name: 'home', field_label: 'Home address', field_type: 'location', field_config: { fields: ['state', 'country'] } }
    expect(offerPrefill([field], {}, null, person)).toEqual({ home: JSON.stringify({ state: 'Jalisco', country: 'Mexico' }) })
    expect(offerPrefill([field], {}, null, { ...person, location_state: null, location_country: null })).toEqual({})
  })
})

describe('offer phone numbers', () => {
  it('keeps a number that carries its own country code', () => {
    expect(offerPhone('+52 55-1234-5678')).toBe('+525512345678')
    expect(offerPhone('+44 20 7946 0958')).toBe('+442079460958')
    expect(offerPhone('+1 (415) 555-0134')).toBe('+14155550134')
  })

  it('gives ten digits without one the field\'s default code', () => {
    expect(offerPhone('415 555 0134')).toBe('+14155550134')
    expect(offerPhone('55 1234 5678', '+52')).toBe('+525512345678')
  })

  it('leaves out anything it can\'t read safely', () => {
    expect(offerPhone('525512345678')).toBeNull()
    expect(offerPhone('12345')).toBeNull()
    expect(offerPhone('+12')).toBeNull()
    expect(offerPhone('')).toBeNull()
    expect(offerPhone(null)).toBeNull()
  })
})
