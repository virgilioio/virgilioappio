import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_ACCEPT,
  documentDay,
  documentError,
  documentKindLabel,
  documentName,
  documentPath,
  documentProblem,
  documentType,
  guessKind,
} from '@/lib/os/personDocuments'
import { describeAudit } from '@/lib/os/peopleAccess'

const T = '5ba7b145-f251-4b18-8900-724cb06028ab'
const U = '11111111-1111-4111-8111-111111111111'

describe('files on a profile', () => {
  it('takes PDFs, Word files and images up to 25 MB, nothing else', () => {
    expect(documentProblem({ name: 'Contract.PDF', size: 1000 })).toBeNull()
    expect(documentProblem({ name: 'NDA.docx', size: 1000 })).toBeNull()
    expect(documentProblem({ name: 'scan.jpeg', size: 1000 })).toBeNull()
    expect(documentProblem({ name: 'payroll.xlsx', size: 1000 })).toBe("payroll.xlsx isn't a PDF, Word file or image.")
    expect(documentProblem({ name: 'big.pdf', size: 26 * 1024 * 1024 })).toBe('big.pdf is over 25 MB.')
    expect(documentProblem({ name: 'empty.pdf', size: 0 })).toBe('empty.pdf is empty.')
    expect(documentType('a.jpg')).toBe('image/jpeg')
    expect(DOCUMENT_ACCEPT).toContain('.pdf')
  })

  it('names a file readably and guesses its kind from the name', () => {
    expect(documentName('Contractor_Agreement__2025.pdf')).toBe('Contractor Agreement 2025')
    expect(documentName('.pdf')).toBe('.pdf')
    expect(guessKind('Mutual NDA - signed.pdf')).toBe('nda')
    expect(guessKind('non-disclosure.pdf')).toBe('nda')
    expect(guessKind('Addendum 2.pdf')).toBe('amendment')
    expect(guessKind('Contract amendment.docx')).toBe('amendment')
    expect(guessKind('Services agreement.pdf')).toBe('agreement')
    expect(documentKindLabel('nda')).toBe('NDA')
    expect(documentKindLabel('weird')).toBe('Other')
  })

  it('puts every file in the person\'s own folder under a name storage accepts', () => {
    const path = documentPath(T, U, 'Contrato de prestación (firmado) #2.pdf', 'abc')
    expect(path.startsWith(`${T}/${U}/abc-`)).toBe(true)
    expect(path).toMatch(/^[\w/.-]+$/)
    expect(path.endsWith('.pdf')).toBe(true)
  })

  it('dates a file by when it was signed, else when it was added', () => {
    expect(documentDay({ signed_on: '2025-03-01', created_at: '2026-11-19T10:00:00Z' })).toBe('2025-03-01')
    expect(documentDay({ signed_on: null, created_at: '2026-11-19T10:00:00Z' })).toBe('2026-11-19')
  })

  it('says what the database refused in plain words', () => {
    expect(documentError({ code: 'GDC02' }, 'x')).toBe('A signing date can’t be in the future.')
    expect(documentError({ code: '42501' }, 'x')).toBe('Only People & Access admins can change these files.')
    expect(documentError({ code: 'XX000', message: 'raw server text' }, 'Try again.')).toBe('Try again.')
  })
})

describe('the history of a profile\'s files', () => {
  const row = (action: string, name = 'Contractor agreement') => ({
    id: 1, tenant_id: T, actor_id: 'admin', subject_user_id: U, action, app_key: null, detail: { name }, created_at: '2026-11-19T10:00:00Z',
  })
  const nameOf = (id: string | null) => (id === U ? 'Priya' : 'Someone')

  it('names the file and the person, never the contents', () => {
    expect(describeAudit(row('person.document_added') as never, nameOf)).toBe("Contractor agreement was added to Priya's profile")
    expect(describeAudit(row('person.document_updated') as never, nameOf)).toBe("Contractor agreement on Priya's profile was edited")
    expect(describeAudit(row('person.document_removed') as never, nameOf)).toBe("Contractor agreement was removed from Priya's profile")
    expect(describeAudit(row('person.document_restored') as never, nameOf)).toBe("Contractor agreement was put back on Priya's profile")
  })
})

describe('the line under a file', () => {
  it('reads kind, signing date and who added it', async () => {
    const { documentMeta } = await import('@/lib/os/personDocuments')
    const d = { id: 'd', tenant_id: T, user_id: U, name: 'X', kind: 'nda', signed_on: '2025-03-01', file_name: 'x.pdf', storage_path: 'p', mime_type: null, size_bytes: null, uploaded_by: 'a', created_at: '2026-11-19T10:00:00Z', removed_at: null } as const
    expect(documentMeta(d as never, () => 'Allan')).toBe('NDA · Signed Mar 1, 2025 · Added Nov 19, 2026 by Allan')
    expect(documentMeta({ ...d, signed_on: null } as never)).toBe('NDA · Added Nov 19, 2026')
  })
})
