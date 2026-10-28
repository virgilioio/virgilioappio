import { afterEach, describe, expect, it, vi } from 'vitest'
import { deliver, destinationsFor, detailValues, esc, plainText, renderTemplate, type Destination, type MessageContext } from '../slack'

const ctx: MessageContext = {
  candidate: { id: 'c1', name: 'Ana <Torres> & Co' },
  job: { id: 'j1', title: 'Account Executive', client: 'Acme', department: 'Sales' },
  stage: 'Final interview',
  from_stage: 'Recruiter screen',
  actor: { name: 'Victoria Bravo', email: 'victoria@virgilio.tech' },
  recruiters: [{ name: 'Victoria Bravo', email: 'victoria@virgilio.tech' }],
  sourcers: [{ name: 'Ritika S.', email: 'ritika@virgilio.tech' }],
  hiring_managers: [],
  rating: 'lean_yes',
}

describe('renderTemplate', () => {
  const values = detailValues(ctx, (p) => (p.email === 'victoria@virgilio.tech' ? '<@UVIC>' : null))

  it('fills details, mentions people Slack knows and links the candidate and job', () => {
    const out = renderTemplate('{who} just hired {candidate} for {client} ({job})', values)
    expect(out).toBe('<@UVIC> just hired <https://app.gogio.io/jobs/j1/candidates/c1|Ana &lt;Torres&gt; &amp; Co> for Acme (<https://app.gogio.io/jobs/j1|Account Executive>)')
  })

  it('keeps Slack tags and escapes everything else the person typed', () => {
    const out = renderTemplate('Hey <@U123ABC> and <!here>: 1 < 2 & {sourcer}', values)
    expect(out).toBe('Hey <@U123ABC> and <!here>: 1 &lt; 2 &amp; Ritika S.')
  })

  it('writes a dash for an empty detail and leaves unknown braces alone', () => {
    expect(renderTemplate('{hiring_manager} · {reason} · {nope}', values)).toBe('— · — · {nope}')
  })

  it('reads ratings as people say them', () => {
    expect(renderTemplate('{rating}', values)).toBe('Lean yes')
  })

  it('names Gio when nobody did it', () => {
    expect(renderTemplate('{who}', detailValues({ ...ctx, actor: null }, () => null))).toBe('Gio')
  })

  it('has a plain version for notifications', () => {
    expect(plainText(renderTemplate('{candidate} moved', values))).toBe('Ana <Torres> & Co moved')
  })

  it('escapes the three characters Slack needs', () => {
    expect(esc('a<b>&c')).toBe('a&lt;b&gt;&amp;c')
  })
})

describe('deliver', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubSlack(lookup: Record<string, string>, failChannel?: string) {
    const calls: Array<{ method: string; body: URLSearchParams }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: URLSearchParams }) => {
      const method = url.split('/api/')[1]
      calls.push({ method, body: init.body })
      const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200 })
      if (method === 'users.lookupByEmail') {
        const id = lookup[init.body.get('email') ?? '']
        return json(id ? { ok: true, user: { id } } : { ok: false, error: 'users_not_found' })
      }
      if (method === 'conversations.open') return json({ ok: true, channel: { id: `D-${init.body.get('users')}` } })
      if (method === 'chat.postMessage') {
        if (init.body.get('channel') === failChannel) return json({ ok: false, error: 'not_in_channel' })
        return json({ ok: true, ts: '1.2' })
      }
      return json({ ok: false, error: 'unknown_method' })
    }))
    return calls
  }

  it('posts to channels and DMs the job’s people it finds in Slack', async () => {
    const calls = stubSlack({ 'victoria@virgilio.tech': 'UVIC' })
    const results = await deliver('xoxb', '{candidate} is in {stage}', [
      { type: 'channel', id: 'C1', name: 'hiring' },
      { type: 'role', role: 'recruiter' },
      { type: 'role', role: 'sourcer' },
    ], ctx)
    const posts = calls.filter((c) => c.method === 'chat.postMessage').map((c) => c.body.get('channel'))
    expect(posts.sort()).toEqual(['C1', 'D-UVIC'])
    expect(results.find((r) => r.to === 'Ritika S.')?.problem).toContain('isn’t in your Slack'.replace('’', "'"))
  })

  it('says plainly when Gio isn’t in a channel', async () => {
    stubSlack({}, 'C2')
    const [r] = await deliver('xoxb', 'x', [{ type: 'channel', id: 'C2', name: 'private' }], ctx)
    expect(r.ok).toBe(false)
    expect(r.problem).toBe("Gio isn't in #private. Type /invite @Gio there.")
  })

  it('sends a test’s "job’s people" to the sender only', async () => {
    const calls = stubSlack({})
    await deliver('xoxb', 'x', [{ type: 'role', role: 'hiring_manager' }, { type: 'role', role: 'recruiter' }], ctx, { test: true, testTo: 'UME' })
    const posts = calls.filter((c) => c.method === 'chat.postMessage').map((c) => c.body.get('channel'))
    expect(posts).toEqual(['D-UME'])
  })

  const approval: MessageContext = {
    ...ctx,
    approvers: [{ name: 'Erik Veen', email: 'erik@virgilio.tech' }],
    approval_step: 'Step 2 of 3',
  }
  const mixed: Destination[] = [{ type: 'channel', id: 'C1', name: 'offers' }, { type: 'role', role: 'approver' }]

  it('DMs only the approver whose turn it is, and nobody else, on their turn', async () => {
    const calls = stubSlack({ 'erik@virgilio.tech': 'UERIK' })
    await deliver('xoxb', '{approver}, your turn ({approval_step})', mixed, { ...approval, turn: true })
    const posts = calls.filter((c) => c.method === 'chat.postMessage')
    expect(posts.map((c) => c.body.get('channel'))).toEqual(['D-UERIK'])
    expect(posts[0].body.get('blocks')).toContain('<@UERIK>, your turn (Step 2 of 3)')
  })

  it('keeps the request\'s own message from the approver (they hear on their turn)', async () => {
    const calls = stubSlack({ 'erik@virgilio.tech': 'UERIK' })
    await deliver('xoxb', 'x', mixed, approval)
    const posts = calls.filter((c) => c.method === 'chat.postMessage').map((c) => c.body.get('channel'))
    expect(posts).toEqual(['C1'])
  })

  it('a test goes everywhere', () => {
    expect(destinationsFor(mixed, approval, true)).toEqual(mixed)
  })
})
