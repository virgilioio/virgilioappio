import { describe, expect, it } from 'vitest'
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LIST,
  employmentTypeKey,
  employmentTypeLabel,
  googleEmploymentType,
} from '@/lib/employmentTypes'
import { jujuJobType, talentJobType } from '../../../supabase/functions/_shared/employmentTypes.ts'
import { formatOfferValue } from '@/lib/offerValues'
import { buildJobPostingJsonLd } from '@/lib/jobPostingJsonLd'
import { Constants } from '@/integrations/supabase/types'

describe('employment types: one list', () => {
  it('offers the six options in one order', () => {
    expect(EMPLOYMENT_TYPES.map((t) => t.label)).toEqual([
      'Full-time', 'Part-time', 'Contractor', 'External vendor', 'Temporary', 'Internship',
    ])
    expect(EMPLOYMENT_TYPE_LIST).toBe('Full-time, Part-time, Contractor, External vendor, Temporary, Internship')
  })

  it('every option is a value a job can hold', () => {
    const allowed = new Set<string>(Constants.public.Enums.job_employment_type)
    for (const t of EMPLOYMENT_TYPES) expect(allowed.has(t.value)).toBe(true)
    expect(allowed.size).toBe(EMPLOYMENT_TYPES.length)
  })

  it('keeps the stored value of jobs that said Contract', () => {
    expect(employmentTypeKey('contract')).toBe('contract')
    expect(employmentTypeLabel('contract')).toBe('Contractor')
  })

  it('reads older spellings as the option they meant', () => {
    expect(employmentTypeKey('freelance')).toBe('contract')
    expect(employmentTypeKey('Contractor')).toBe('contract')
    expect(employmentTypeKey('Full-Time')).toBe('full_time')
    expect(employmentTypeKey('full time')).toBe('full_time')
    expect(employmentTypeKey('external vendor')).toBe('vendor')
    expect(employmentTypeKey('intern')).toBe('internship')
  })

  it('never invents an option', () => {
    expect(employmentTypeKey('')).toBeNull()
    expect(employmentTypeKey(null)).toBeNull()
    expect(employmentTypeKey('L1 - Specialists')).toBeNull()
    expect(employmentTypeLabel(null)).toBeNull()
    expect(employmentTypeLabel('  ')).toBeNull()
    expect(employmentTypeLabel('per_diem')).toBe('Per diem')
  })

  it('an offer value reads with the same words', () => {
    expect(formatOfferValue('vendor', 'employment_type')).toBe('External vendor')
    expect(formatOfferValue('contract', 'employment_type')).toBe('Contractor')
    expect(formatOfferValue('full_time', 'employment_type')).toBe('Full-time')
  })

  it("sends Google a type it knows: a vendor is a contractor's engagement", () => {
    expect(googleEmploymentType('vendor')).toBe('CONTRACTOR')
    expect(googleEmploymentType('contract')).toBe('CONTRACTOR')
    expect(googleEmploymentType('full_time')).toBe('FULL_TIME')
    expect(googleEmploymentType('internship')).toBe('INTERN')
    expect(googleEmploymentType('temporary')).toBe('TEMPORARY')
    expect(googleEmploymentType('volunteer')).toBe('VOLUNTEER')
    expect(googleEmploymentType('something else')).toBeUndefined()
    const ld = buildJobPostingJsonLd({
      posting: { id: 'p1', title: 'Analyst', slug: 'analyst', description: '<p>Work</p>', details: { employment_type: 'vendor' }, created_at: '2026-11-18T00:00:00Z' } as never,
      job: null as never,
      tenant: { name: 'Acme' } as never,
      url: 'https://example.com/p/analyst',
    })
    expect(ld.employmentType).toBe('CONTRACTOR')
  })

  it('job board feeds get a type they know, and none when the post has none', () => {
    expect(talentJobType('vendor')).toBe('Contract')
    expect(talentJobType('full_time')).toBe('Full time')
    expect(talentJobType(null)).toBeNull()
    expect(talentJobType('L1 - Specialists')).toBeNull()
    expect(jujuJobType('vendor')).toBe('contract')
    expect(jujuJobType(undefined)).toBe('fulltime')
  })
})
