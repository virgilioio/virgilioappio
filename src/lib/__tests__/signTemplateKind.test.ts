import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabaseClient', () => ({ supabase: {}, supabaseUrl: '', supabaseAnonKey: '' }))
vi.mock('@/lib/sign/pdf', () => ({ loadTemplatePdf: vi.fn() }))

import { fillFromFor, newDraft, withKind, type TplRole } from '@/lib/sign/templates'

const role = (over: Partial<TplRole>): TplRole => ({ id: 'r', label: 'R', role: 'signer', fixed: false, fill_from: null, name: '', email: '', color: '#000', ...over })

// save_sign_template refuses a source the template's type doesn't have (GSN12).
describe('role sources follow the template type', () => {
  it('drops the candidate source when a new template becomes a customer one', () => {
    const d = withKind(newDraft('candidate'), 'customer')
    expect(d.roles[0].fill_from).toBeNull()
    expect(d.roles[0].label).toBe('Client signer')
  })

  it('turns a hiring manager into typed on a member template', () => {
    const d = withKind({ ...newDraft('candidate'), roles: [role({ fill_from: 'record' }), role({ id: 'h', fill_from: 'hiring_manager' })] }, 'member')
    expect(d.roles.map((r) => r.fill_from)).toEqual(['record', 'typed'])
  })

  it('keeps fixed roles fixed on every type', () => {
    for (const k of ['candidate', 'member', 'customer'] as const) expect(fillFromFor(k, role({ fixed: true, fill_from: 'fixed' }))).toBe('fixed')
  })

  it('leaves candidate sources alone', () => {
    for (const f of ['record', 'hiring_manager', 'sender', 'typed'] as const) expect(fillFromFor('candidate', role({ fill_from: f }))).toBe(f)
  })
})
