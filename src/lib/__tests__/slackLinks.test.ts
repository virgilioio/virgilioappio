import { describe, expect, it } from 'vitest'
import { messageLinks, openLink } from '../../../supabase/functions/_shared/slack'
import { LINK_DETAILS, SLACK_DETAILS, SLACK_EVENTS, linkLabel, openLabel } from '../slack'

// The builder's preview and "{" menu must say what Slack will say.
const ctxFor = (event: string) => ({
  event,
  candidate: { id: 'c1', name: SLACK_DETAILS.candidate.example },
  job: { id: 'j1', title: 'AE' },
  missing: ['tax'],
})

describe('Slack links: the builder and the server agree', () => {
  for (const def of SLACK_EVENTS) {
    it(`${def.key}: every link it offers is filled, with the same words`, () => {
      const server = messageLinks(ctxFor(def.key))
      for (const key of def.details.filter((d) => LINK_DETAILS.has(d))) {
        expect(server[key]?.label, key).toBe(linkLabel(key, def.key))
      }
    })
    it(`${def.key}: "Open" reads the same`, () => {
      const dm = def.key.startsWith('member.') ? 'member' : def.key === 'interview.scheduled' ? 'interviewer' : 'everyone'
      expect(openLink(ctxFor(def.key), dm)?.label ?? null).toBe(openLabel(def.key, dm !== 'everyone')?.label ?? null)
      if (dm !== 'everyone' && !def.dmOnly) expect(openLink(ctxFor(def.key), 'everyone')?.label ?? null).toBe(openLabel(def.key, false)?.label ?? null)
    })
  }
})
