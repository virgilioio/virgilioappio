import { describe, expect, it } from 'vitest'
import { copyName } from '@/lib/copyName'
import { libraryMenu } from '@/components/settings/shared/libraryMenu'

const noop = () => {}
const Icon = () => null

describe('copyName', () => {
  it('is "Copy of" the original', () => {
    expect(copyName('Offer letter', ['Offer letter'])).toBe('Copy of Offer letter')
  })

  it('takes the next free number when the copy exists, whatever its case or spacing', () => {
    expect(copyName('Offer letter', ['Offer letter', ' copy of offer letter '])).toBe('Copy of Offer letter (2)')
    expect(copyName('Offer letter', ['Copy of Offer letter', 'Copy of Offer letter (2)'])).toBe('Copy of Offer letter (3)')
  })

  it('a copy of a copy never stacks', () => {
    expect(copyName('Copy of Offer letter', ['Offer letter', 'Copy of Offer letter'])).toBe('Copy of Offer letter (2)')
    expect(copyName('Copy of Offer letter (2)', ['Copy of Offer letter', 'Copy of Offer letter (2)'])).toBe('Copy of Offer letter (3)')
  })

  it('keeps within the limit by cutting the name, never the number', () => {
    const long = 'A'.repeat(200)
    const first = copyName(long, [])
    expect(first.length).toBe(120)
    const second = copyName(long, [first])
    expect(second.length).toBe(120)
    expect(second.endsWith(' (2)')).toBe(true)
  })

  it('an empty name still gets one', () => {
    expect(copyName('   ', [])).toBe('Copy of Untitled')
  })
})

describe('a library row menu', () => {
  const labels = (rows: ReturnType<typeof libraryMenu>) => rows.map((r) => (r.kind === 'separator' ? '—' : r.label))

  it('is Edit, the row\'s own actions, then Delete last after a divider', () => {
    const rows = libraryMenu({
      onEdit: noop,
      actions: [
        { label: 'Preview', icon: Icon, onSelect: noop },
        { label: 'Duplicate', icon: Icon, onSelect: noop },
      ],
      onDelete: noop,
    })
    expect(labels(rows)).toEqual(['Edit', 'Preview', 'Duplicate', '—', 'Delete'])
    expect(rows[rows.length - 1].kind).toBe('delete')
  })

  it('calls Edit "Rename" when a name is all there is', () => {
    expect(labels(libraryMenu({ onEdit: noop, editLabel: 'Rename', onDelete: noop }))).toEqual(['Rename', '—', 'Delete'])
  })

  it('has no divider above a lone Delete, and nothing for a row that can do nothing', () => {
    expect(labels(libraryMenu({ onDelete: noop }))).toEqual(['Delete'])
    expect(libraryMenu({})).toEqual([])
  })

  it('runs the row\'s own handlers', () => {
    const called: string[] = []
    const rows = libraryMenu({
      onEdit: () => called.push('edit'),
      actions: [{ label: 'Duplicate', icon: Icon, onSelect: () => called.push('duplicate'), disabled: true }],
      onDelete: () => called.push('delete'),
    })
    for (const r of rows) if (r.kind !== 'separator') r.onSelect()
    expect(called).toEqual(['edit', 'duplicate', 'delete'])
    expect(rows[1]).toMatchObject({ kind: 'action', disabled: true })
  })
})
