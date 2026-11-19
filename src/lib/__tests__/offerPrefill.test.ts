import { describe, expect, it } from 'vitest'
import { jobValueFor, offerPrefill } from '@/lib/offerPrefill'
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
