import { describe, expect, it } from 'vitest'
import {
  appliedViaText,
  channelForHost,
  channelForTag,
  channelLabel,
  resolveApplySource,
} from '../../../supabase/functions/_shared/applySource'
import { readTags } from '../applySource'

describe('resolveApplySource', () => {
  it('reads the share kit tag first', () => {
    expect(resolveApplySource({ src: 'linkedin', referrer_host: 'google.com' })).toEqual({
      channel: 'linkedin',
      detail: { referrer_host: 'google.com' },
    })
  })

  it('reads the job board feeds\' ?source=', () => {
    expect(resolveApplySource({ source: 'jooble' }).channel).toBe('jooble')
    expect(resolveApplySource({ source: 'talent' }).channel).toBe('talent')
  })

  it('reads utm_source and keeps the other utm tags', () => {
    expect(resolveApplySource({ utm_source: 'LinkedIn Post', utm_medium: 'social', utm_campaign: 'q4' })).toEqual({
      channel: 'linkedin',
      detail: { tag: 'LinkedIn Post', utm_source: 'LinkedIn Post', utm_medium: 'social', utm_campaign: 'q4' },
    })
  })

  it('keeps a tag it does not know as another website', () => {
    expect(resolveApplySource({ src: 'Hacker News' })).toEqual({ channel: 'other', detail: { tag: 'Hacker News' } })
  })

  it('falls back to the sending site', () => {
    expect(resolveApplySource({ referrer_host: 'www.linkedin.com' }).channel).toBe('linkedin')
    expect(resolveApplySource({ referrer_host: 'l.facebook.com' }).channel).toBe('facebook')
    expect(resolveApplySource({ referrer_host: 'www.google.com.mx' }).channel).toBe('google')
    expect(resolveApplySource({ referrer_host: 'mx.indeed.com' }).channel).toBe('indeed')
    expect(resolveApplySource({ referrer_host: 'example.org' })).toEqual({ channel: 'other', detail: { referrer_host: 'example.org' } })
  })

  it('treats our own pages and no information as direct', () => {
    expect(resolveApplySource({ referrer_host: 'app.gogio.io' })).toEqual({ channel: 'direct', detail: {} })
    expect(resolveApplySource({})).toEqual({ channel: 'direct', detail: {} })
    expect(resolveApplySource(null).channel).toBe('direct')
  })

  it('reads who shared the link', () => {
    expect(resolveApplySource({ src: 'whatsapp', by: 'client' }).detail).toEqual({ by_client: true })
    expect(resolveApplySource({ src: 'x', by: '3ab94f45' }).detail).toEqual({ share_code: '3ab94f45' })
    expect(resolveApplySource({ src: 'x', by: 'not a code!' }).detail).toEqual({})
  })

  it('clips long values', () => {
    const r = resolveApplySource({ src: 'a'.repeat(300) })
    expect(r.channel).toBe('other')
    expect(r.detail.tag).toHaveLength(80)
  })
})

describe('hosts and tags', () => {
  it('prefers the more specific site', () => {
    expect(channelForHost('mail.google.com')).toBe('email')
    expect(channelForHost('t.co')).toBe('x')
    expect(channelForHost('lnkd.in')).toBe('linkedin')
    expect(channelForHost('notlinkedin.com')).toBeNull()
  })

  it('knows aliases and first words', () => {
    expect(channelForTag('google_jobs')).toBe('google')
    expect(channelForTag('OCC Mundial')).toBe('occ')
    expect(channelForTag('twitter')).toBe('x')
    expect(channelForTag('whatsapp-group')).toBe('whatsapp')
    expect(channelForTag('???')).toBeNull()
  })
})

describe('labels', () => {
  it('names each application', () => {
    expect(channelLabel(null)).toBe('Not tracked')
    expect(channelLabel('linkedin')).toBe('LinkedIn')
    expect(channelLabel('other', { referrer_host: 'example.org' })).toBe('Another website (example.org)')
    expect(appliedViaText('whatsapp', { by_client: true })).toBe("WhatsApp · the client's team")
    expect(appliedViaText('linkedin', { shared_by_name: 'Ana' })).toBe('LinkedIn · shared by Ana')
  })
})

describe('readTags', () => {
  it('reads the link and the sending site, never our own', () => {
    expect(readTags('?src=linkedin&by=client&utm_campaign=q4', 'https://www.linkedin.com/feed/')).toEqual({
      src: 'linkedin',
      source: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: 'q4',
      by: 'client',
      referrer_host: 'linkedin.com',
    })
    expect(readTags('', 'https://app.gogio.io/careers/acme').referrer_host).toBeNull()
    expect(readTags('', 'not a url').referrer_host).toBeNull()
  })
})
