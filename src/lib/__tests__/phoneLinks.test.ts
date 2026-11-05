import { describe, expect, it } from 'vitest'
import { phoneQueueHref } from '@/lib/phoneLinks'

describe('phone links from Home', () => {
  it('turns a job page with a candidate into the in-job profile', () => {
    expect(phoneQueueHref('/jobs/j1?candidate=c1', 'c1')).toBe('/jobs/j1/candidates/c1')
    expect(phoneQueueHref('/jobs/j1?candidate=c1&tab=offer', 'c1')).toBe('/jobs/j1/candidates/c1?tab=offer')
    expect(phoneQueueHref('/jobs/j1?candidate=c1&open=scorecard&stage=s1', 'c1')).toBe('/jobs/j1/candidates/c1?tab=scorecards')
  })
  it('leaves profile links alone and falls back to the general profile', () => {
    expect(phoneQueueHref('/jobs/j1/candidates/c1?tab=activity', 'c1')).toBe('/jobs/j1/candidates/c1?tab=activity')
    expect(phoneQueueHref('/candidates/c1?tab=activity', 'c1')).toBe('/candidates/c1?tab=activity')
    expect(phoneQueueHref(undefined, 'c9')).toBe('/candidates/c9')
  })
})
