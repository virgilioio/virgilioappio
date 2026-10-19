import { describe, expect, it } from 'vitest'
import { DEFAULT_SECTIONS, formSections, groupBySection } from '../offerSections'

const f = (id: string, order: number, key: string | null) => ({ id, display_order: order, section_key: key })

describe('groupBySection', () => {
  it('puts fields in their sections, in section order, each by display order', () => {
    const groups = groupBySection(DEFAULT_SECTIONS, [f('b', 2, 'role'), f('a', 1, 'role'), f('c', 0, 'compensation')])
    expect(groups.map((g) => g.section?.id)).toEqual(['role', 'compensation', 'benefits', 'additional'])
    expect(groups[0].fields.map((x) => x.id)).toEqual(['a', 'b'])
    expect(groups[1].fields.map((x) => x.id)).toEqual(['c'])
  })
  it('sends a field with a missing or unknown section to the last one, as the database does', () => {
    const groups = groupBySection(DEFAULT_SECTIONS, [f('a', 0, null), f('b', 1, 'gone')])
    expect(groups[3].fields.map((x) => x.id)).toEqual(['a', 'b'])
  })
  it('makes one plain list when the form has no sections', () => {
    const groups = groupBySection([], [f('a', 1, null), f('b', 0, 'role')])
    expect(groups).toHaveLength(1)
    expect(groups[0].section).toBeNull()
    expect(groups[0].fields.map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('formSections', () => {
  it('reads the stored list and falls back to the defaults when there is none', () => {
    expect(formSections({ sections: [{ id: 'x', title: 'Pay', columns: 1 }] })).toEqual([{ id: 'x', title: 'Pay', columns: 1 }])
    expect(formSections({})).toEqual(DEFAULT_SECTIONS)
    expect(formSections({ sections: [] })).toEqual([])
  })
})
