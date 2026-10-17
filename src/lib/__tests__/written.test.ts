import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabaseClient', () => ({ supabase: {}, supabaseUrl: '', supabaseAnonKey: '' }))
vi.mock('@/lib/sign/pdf', () => ({ loadTemplatePdf: vi.fn() }))

import { docItems, emptyContent, remapRoles, signBlocks, type TplWritten } from '@/lib/sign/written'
import { duplicateDraft, moveItem, newDraft, stepIssue, templateIssues, usedTags, type TplDoc, type TplDraft } from '@/lib/sign/templates'

const pdf = (id: string, pages: number, position: number): TplDoc => ({
  id,
  name: `${id}.pdf`,
  storage_path: `t/templates/x/${id}.pdf`,
  page_count: pages,
  page_sizes: Array.from({ length: pages }, () => ({ w: 612, h: 792 })),
  size_bytes: 1,
  sha256: null,
  position,
})
const content = (...children: object[]) => ({ root: { type: 'root', children } })
const written = (id: string, position: number, c = emptyContent()): TplWritten => ({ id, name: id, position, content: c })

function draft(over: Partial<TplDraft> = {}): TplDraft {
  const d = newDraft('candidate')
  return { ...d, name: 'T', roles: [{ ...d.roles[0], id: 'r1' }], ...over }
}

describe('documents in one order', () => {
  it('interleaves uploaded and written documents by position', () => {
    const d = draft({ docs: [pdf('a', 1, 0), pdf('b', 2, 2)], written: [written('w', 1)] })
    expect(docItems(d).map((x) => x.doc.id)).toEqual(['a', 'w', 'b'])
  })

  it('moves a written document past an uploaded one without touching fields', () => {
    const d = draft({
      docs: [pdf('a', 1, 0), pdf('b', 2, 2)],
      written: [written('w', 1)],
      fields: [{ id: 'f', type: 'signature', rid: 'r1', page: 1, x: 1, y: 1, w: 10, h: 5, required: true, data_key: null, font_size: null }],
    })
    const next = moveItem(d, 1, 2)
    expect(docItems(next).map((x) => x.doc.id)).toEqual(['a', 'b', 'w'])
    expect(next.fields[0].page).toBe(1)
  })

  it('swapping two uploaded documents carries their fields', () => {
    const d = draft({
      docs: [pdf('a', 1, 0), pdf('b', 2, 1)],
      written: [],
      fields: [{ id: 'f', type: 'signature', rid: 'r1', page: 0, x: 1, y: 1, w: 10, h: 5, required: true, data_key: null, font_size: null }],
    })
    const next = moveItem(d, 0, 1)
    expect(docItems(next).map((x) => x.doc.id)).toEqual(['b', 'a'])
    expect(next.fields[0].page).toBe(2)
  })
})

describe('signing blocks and checks', () => {
  const block = (roleId: string, kind = 'signature') => ({ type: 'gio-sign', roleId, kind })

  it('a written signature block satisfies the signer, unless it is inside a section', () => {
    const ok = draft({ written: [written('w', 0, content(block('r1')))] })
    expect(templateIssues(ok)).toEqual([])
    const inSection = draft({ written: [written('w', 0, content({ type: 'gio-if', key: 'x', op: 'yes', children: [block('r1')] }))] })
    const issue = templateIssues(inSection).find((i) => /needs a signature field/.test(i.text))
    // Flagged on the Document step; it keeps Save off but not Continue (roles come after).
    expect(issue).toMatchObject({ step: 1, blocks: false })
    expect(stepIssue(1, inSection)).toBeNull()
  })

  it('flags a block for a removed role', () => {
    const d = draft({ written: [written('Offer', 0, content(block('gone')))] })
    expect(stepIssue(1, d)).toMatch(/belongs to a role/)
  })

  it('needs a document of either kind', () => {
    expect(stepIssue(0, draft())).toBe('Add at least one document')
  })

  it('lists blocks with whether they are conditional', () => {
    expect(signBlocks(content(block('r1'), { type: 'gio-if', children: [block('r2', 'date')] }))).toEqual([
      { roleId: 'r1', kind: 'signature', conditional: false },
      { roleId: 'r2', kind: 'date', conditional: true },
    ])
  })

  it('duplicating points blocks at the new roles', () => {
    const d = draft({ written: [written('w', 0, content(block('r1')))] })
    const copy = duplicateDraft(d)
    const roleId = copy.roles[0].id
    expect(roleId).not.toBe('r1')
    expect(signBlocks(copy.written[0].content)[0].roleId).toBe(roleId)
    expect(copy.written[0].id).not.toBe('w')
    expect(remapRoles(content(block('a')), new Map([['a', 'b']])).root.children[0].roleId).toBe('b')
  })

  it('counts written tags and conditions as used', () => {
    const d = draft({ written: [written('w', 0, content({ type: 'paragraph', children: [{ type: 'placeholder', placeholderKey: 'job_title' }] }, { type: 'gio-if', key: 'relocation_bonus', op: 'yes', children: [] }))] })
    expect(usedTags(d).map((t) => t.data_key).sort()).toEqual(['job_title', 'relocation_bonus'])
  })
})
