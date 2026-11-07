import { describe, expect, it } from 'vitest'
import { previewReviewEmail, reviewEmailValues, variableName, fillReviewEmail, type ReviewEmailContext } from '../reviewEmail'

const ctx: ReviewEmailContext = {
  job: { title: 'Head of Marketing', department: 'Marketing', location: 'Remote', salaryRange: '', clientName: 'Acme', workspaceName: 'Virgilio' },
  sender: { firstName: 'Allan', lastName: 'Pérez', email: 'allan@virgilio.tech', title: 'Founder', phone: '', linkedin: '' },
  fromEmail: 'allan@virgilio.tech',
}
const candidate = { candidateName: 'Deborah Szajngarten', email: 'deb@example.com', phone: null, locationCity: 'Monroe', locationState: 'New York', locationCountry: 'United States' }

describe('review rejection email', () => {
  const values = reviewEmailValues(ctx, candidate, 'Application Review')

  it('fills what the template menus offer, as the sender does', () => {
    expect(values['candidate.first_name']).toBe('Deborah')
    expect(values['candidate.full_name']).toBe('Deborah Szajngarten')
    expect(values['department.name']).toBe('Marketing')
    expect(values['client.name']).toBe('Acme')
    expect(values['organization.name']).toBe('Virgilio')
    expect(values['stage.name']).toBe('Application Review')
    expect(values['sender.name']).toBe('Allan Pérez')
    expect(values['candidate.location']).toBe('Monroe, New York, United States')
  })

  it('sends the same text the preview shows, empty ones blank', () => {
    const t = 'Hi {{candidate.first_name}}, {{job.title}} at {{client.name}}. {{job.salary_range}}'
    expect(fillReviewEmail(t, values)).toBe('Hi Deborah, Head of Marketing at Acme. ')
    const p = previewReviewEmail(t, values, true)
    expect(p.out).toContain('Hi Deborah, Head of Marketing at Acme.')
    expect(p.out).toContain('<span class="gio-var-empty">Job salary range</span>')
    expect(p.empty).toEqual(['Job salary range'])
  })

  it('escapes values in the HTML preview', () => {
    const p = previewReviewEmail('{{candidate.first_name}}', { 'candidate.first_name': '<b>x</b>' }, true)
    expect(p.out).toBe('&lt;b&gt;x&lt;/b&gt;')
  })

  it('names variables readably', () => {
    expect(variableName('candidate.phone')).toBe('Candidate phone')
    expect(variableName('client.name')).toBe('Client name')
    expect(variableName('stage.booking_link')).toBe('Booking link for this stage')
    expect(variableName('made.up')).toBe('made.up')
  })
})
