import { afterEach, describe, expect, it, vi } from 'vitest'
import { deliver, destinationsFor, detailValues, messageBlocks, messageLinks, missingSentence, openLink, esc, plainText, renderTemplate, type Destination, type MessageContext } from '../slack'

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

  it('DMs the team member their profile reminder, linking to their profile', async () => {
    const calls = stubSlack({ 'sofia@virgilio.tech': 'USOF' })
    const ctx2: MessageContext = {
      event: 'member.profile_incomplete',
      member: { name: 'Sofía Ramírez', email: 'sofia@virgilio.tech' },
      missing: ['birthday', 'tax', 'bank'],
      progress: '3 of 6 done',
      link: '/me',
    }
    await deliver('xoxb', 'Hi {member}! Your profile is {progress}. Still to add: {missing}.', [{ type: 'role', role: 'member' }], ctx2)
    const posts = calls.filter((c) => c.method === 'chat.postMessage')
    expect(posts.map((c) => c.body.get('channel'))).toEqual(['D-USOF'])
    expect(posts[0].body.get('blocks')).toContain('Hi <@USOF>! Your profile is 3 of 6 done. Still to add: birthday, tax ID and bank details.')
    expect(posts[0].body.get('blocks')).toContain('https://app.gogio.io/me?focus=card-personal|Finish your profile')
  })

  it('sends the interviewer to their own scorecard and everyone else to the scorecards', async () => {
    const calls = stubSlack({ 'jurre@virgilio.tech': 'UJUR' })
    await deliver('xoxb', 'x', [{ type: 'channel', id: 'C1', name: 'hiring' }, { type: 'role', role: 'interviewer' }],
      { ...ctx, event: 'interview.scheduled', interviewer: { name: 'Jurre Veen', email: 'jurre@virgilio.tech' } })
    const posts = calls.filter((c) => c.method === 'chat.postMessage')
    const byChannel = Object.fromEntries(posts.map((c) => [c.body.get('channel'), c.body.get('blocks') ?? '']))
    expect(byChannel['C1']).toContain('/jobs/j1/candidates/c1?tab=scorecards|Open the scorecards')
    expect(byChannel['D-UJUR']).toContain('/jobs/j1/candidates/c1?focus=my-scorecard|Open your scorecard')
  })
})

describe('links', () => {
  const base = 'https://app.gogio.io/jobs/j1/candidates/c1'
  it('sends an approver straight to the approval card', () => {
    expect(openLink({ ...ctx, event: 'offer.approval_requested', turn: true })).toEqual({ url: `${base}?focus=approval`, label: 'Review the offer' })
  })
  it('opens the offer tab for the other offer events', () => {
    expect(openLink({ ...ctx, event: 'offer.signed' })?.url).toBe(`${base}?tab=offer`)
  })
  it('opens onboarding after a hire and the reasons after a rejection', () => {
    expect(openLink({ ...ctx, event: 'candidate.hired' })?.url).toBe(`${base}?tab=onboarding`)
    expect(openLink({ ...ctx, event: 'candidate.rejected' })?.url).toBe(`${base}?tab=rejection-details`)
  })
  it('opens the profile for applications and stage moves, the job for job events', () => {
    expect(openLink({ ...ctx, event: 'candidate.stage_changed' })).toEqual({ url: base, label: "Open Ana <Torres> & Co's profile" })
    expect(openLink({ ...ctx, candidate: null, event: 'job.opened' })).toEqual({ url: 'https://app.gogio.io/jobs/j1', label: 'Open the job' })
  })
  it('a welcome links the team member to their profile, and a channel to nothing', () => {
    const welcome: MessageContext = { event: 'member.joined', member: { name: 'Sofía' } }
    expect(openLink(welcome, 'member')).toEqual({ url: 'https://app.gogio.io/me', label: 'Open your profile' })
    expect(openLink(welcome, 'everyone')).toBe(null)
    expect(JSON.stringify(messageBlocks('x', welcome))).not.toContain('<https')
  })
  it('only offers the links that fit the event', () => {
    const l = messageLinks({ ...ctx, event: 'candidate.applied' })
    expect(l.offer_link).toBe(null)
    expect(l.scorecard_link).toBe(null)
    expect(l.my_profile_link).toBe(null)
    expect(l.pipeline_link?.url).toBe('https://app.gogio.io/jobs/j1/pipeline')
  })
  it('writes link details as labelled Slack links, a dash where they don\'t apply', () => {
    const values = detailValues({ ...ctx, event: 'offer.approval_requested' }, () => null)
    expect(renderTemplate('{offer_link} · {my_profile_link}', values)).toBe(`<${base}?focus=approval|Review the offer> · —`)
  })
  it('a Send test with example details still shows every link, opening Gio', () => {
    const test: MessageContext = { event: 'offer.approval_requested', candidate: { id: '', name: 'Ana Example' }, job: { id: '', title: 'AE' } }
    expect(messageLinks(test).offer_link).toEqual({ url: 'https://app.gogio.io', label: 'Review the offer' })
  })
})

describe('missingSentence', () => {
  it('names the cards the way the profile does', () => {
    expect(missingSentence(['you'])).toBe('photo and title')
    expect(missingSentence(['personal', 'shipping'])).toBe('country and contact and shipping address')
    expect(missingSentence([])).toBe(null)
  })
  it('a People message has no job line', () => {
    const blocks = JSON.stringify(messageBlocks('x', { link: '/me' }, false, 'member'))
    expect(blocks).toContain('Gio ATS')
    expect(blocks).toContain('/me|Open in Gio')
  })
})
