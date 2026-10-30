import { describe, expect, it } from 'vitest'
import { notificationHref } from '../notificationLink'

const J = 'job-1'
const C = 'cand-1'

describe('notificationHref', () => {
  it('opens a scorecard on the in-job Scorecards tab', () => {
    expect(notificationHref({ category: 'scorecard_submitted', job_id: J, candidate_id: C, action_url: `/candidates?openCandidate=${C}` }))
      .toBe(`/jobs/${J}/candidates/${C}?tab=scorecards`)
  })

  it('opens interviews and client decisions in the job', () => {
    expect(notificationHref({ category: 'interview_event', job_id: J, candidate_id: C, action_url: `/candidates?openCandidate=${C}` }))
      .toBe(`/jobs/${J}/candidates/${C}`)
    expect(notificationHref({ category: 'candidate_update', job_id: J, candidate_id: C, action_url: `/candidates/${C}` }))
      .toBe(`/jobs/${J}/candidates/${C}`)
  })

  it('keeps the general profile without a job, and leaves other links alone', () => {
    expect(notificationHref({ category: 'interview_event', job_id: null, candidate_id: C, action_url: `/candidates?openCandidate=${C}` }))
      .toBe(`/candidates?openCandidate=${C}`)
    expect(notificationHref({ category: 'offer_event', job_id: J, candidate_id: C, action_url: `/jobs/${J}/candidates/${C}?focus=approval` }))
      .toBe(`/jobs/${J}/candidates/${C}?focus=approval`)
    expect(notificationHref({ category: 'talent_pool', job_id: null, candidate_id: null, action_url: '/find' })).toBe('/find')
    expect(notificationHref({ category: 'mention', job_id: J, candidate_id: C, action_url: null })).toBeNull()
  })
})
