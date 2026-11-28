import { describe, expect, it } from 'vitest'
import { STATIC_FEEDS, feedBody, feedFilePath, feedFileUrl, feedSourceUrl, looksLikeFeed, sameFeed } from '../jobFeedFiles'

const T = '5BA7B145-F251-4B18-8900-724CB06028AB'
const talent = (built: string, jobs: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<source>\n  <publisher>GoGio</publisher>\n  <lastbuilddate>${built}</lastbuilddate>\n  ${jobs}\n</source>`

describe('job feeds as files on app.gogio.io (2026-11-28)', () => {
  it('keeps each board and workspace at one address', () => {
    expect(feedFilePath('talent', T)).toBe('feeds/talent/5ba7b145-f251-4b18-8900-724cb06028ab.xml')
    expect(feedFileUrl('juju', T)).toBe('https://app.gogio.io/feeds/juju/5ba7b145-f251-4b18-8900-724cb06028ab.xml')
    expect(feedSourceUrl('jooble', T, 'http://x/fn')).toBe(`http://x/fn?tenant_id=${T}&board=jooble`)
  })
  it('writes nothing outside a board and a workspace id', () => {
    expect(feedFilePath('../talent', T)).toBeNull()
    expect(feedFilePath('talent', '../../x')).toBeNull()
    expect(feedFileUrl('Talent', 'not-a-uuid')).toBeNull()
  })
  it('lists only valid feeds, each once', () => {
    const keys = STATIC_FEEDS.map((f) => feedFilePath(f.board, f.tenantId))
    expect(keys.every(Boolean)).toBe(true)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('ignores the build stamps when deciding whether a feed changed', () => {
    const a = talent('2026-11-28T00:00:00.000Z', '<job><title>AE</title></job>')
    const b = talent('2026-11-28T01:00:00.000Z', '<job><title>AE</title></job>')
    const c = talent('2026-11-28T01:00:00.000Z', '<job><title>SDR</title></job>')
    expect(sameFeed(a, b)).toBe(true)
    expect(sameFeed(a, c)).toBe(false)
    expect(sameFeed(null, a)).toBe(false)
    expect(feedBody('<jobs><feeddate>2026-11-28</feeddate></jobs>')).toBe('<jobs><feeddate/></jobs>')
  })
  it('only takes a real feed from the function', () => {
    expect(looksLikeFeed(talent('x', ''))).toBe(true)
    expect(looksLikeFeed('<?xml version="1.0" encoding="utf-8"?>\n<jobs>\n</jobs>')).toBe(true)
    expect(looksLikeFeed('{"error":"talent integration not enabled"}')).toBe(false)
    expect(looksLikeFeed('<!doctype html><html></html>')).toBe(false)
  })
})
