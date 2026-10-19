import { describe, expect, it } from 'vitest'
import { draftHasTag, encodeMentions, matchPeople, mentionQuery, parseComment, taggedIn } from '../mentions'

const ann = { id: '11111111-1111-4111-8111-111111111111', name: 'Ann' }
const annLee = { id: '22222222-2222-4222-8222-222222222222', name: 'Ann Lee' }

describe('mentions', () => {
  it('encodes the picked people still in the draft, longest names first', () => {
    const out = encodeMentions('Hi @Ann Lee and @Ann, see @Annabel', [ann, annLee])
    expect(out).toBe(`Hi @[Ann Lee](user:${annLee.id}) and @[Ann](user:${ann.id}), see @Annabel`)
  })

  it('drops a pick whose name was edited away', () => {
    expect(taggedIn('Hi @An', [ann])).toEqual([])
    expect(draftHasTag('Hi @An', [ann])).toBe(false)
    expect(draftHasTag('Hi @Ann.', [ann])).toBe(true)
  })

  it('sees a stored tag typed by hand', () => {
    expect(draftHasTag(`x @[Bo](user:${ann.id})`, [])).toBe(true)
    expect(draftHasTag(`x @[Bo](user:${ann.id})`, [])).toBe(true)
  })

  it('parses a stored comment into text and chips', () => {
    expect(parseComment(`Ask @[Ann Lee](user:${annLee.id}) today`)).toEqual([
      { kind: 'text', text: 'Ask ' },
      { kind: 'mention', name: 'Ann Lee', id: annLee.id },
      { kind: 'text', text: ' today' },
    ])
  })

  it('reads the "@" being typed, not an email address', () => {
    expect(mentionQuery('Hi @an', 6)).toEqual({ start: 3, query: 'an' })
    expect(mentionQuery('@', 1)).toEqual({ start: 0, query: '' })
    expect(mentionQuery('Hi @Ann Le', 10)).toEqual({ start: 3, query: 'Ann Le' })
    expect(mentionQuery('mail ann@x.com', 14)).toBeNull()
  })

  it('ranks names that start with the query first', () => {
    const people = [{ name: 'Lee Ann' }, { name: 'Ann Lee' }, { name: 'Bob', email: 'annie@x.com' }]
    expect(matchPeople(people, 'ann').map((p) => p.name)).toEqual(['Ann Lee', 'Lee Ann', 'Bob'])
  })
})
