import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/integrations/supabase/client'

/**
 * Tax IDs (member profile part 2, 2026-10-24): a person's tax IDs, one of each
 * type, from the catalogue os_tax_id_types (twelve countries plus Other, each
 * with its format and check-digit rule). Kept like bank details: encrypted,
 * the browser only ever gets the last four (os_tax_ids); admins and Billing
 * reveal one (os_reveal_tax_id, in the person's history); the person or an
 * admin saves (os_save_tax_id) and removes (os_remove_tax_id), and when
 * someone else does it the person hears at once (bell and email).
 */

export interface TaxIdType {
  key: string
  country_code: string | null
  label: string
  holder: 'person' | 'company' | 'either'
  example: string
  pattern: string
  check_rule: CheckRule
  note: string | null
  position: number
}

export type CheckRule = 'none' | 'rfc' | 'nit_co' | 'cuit' | 'cpf' | 'cnpj' | 'rut' | 'ruc' | 'nif' | 'luhn' | 'bsn' | 'gstin'

export interface TaxIdRow {
  type_key: string
  label: string
  country_code: string | null
  holder: TaxIdType['holder']
  last4: string
  updated_at: string
  updated_by_name: string | null
}

export interface TaxIds {
  can_edit: boolean
  can_reveal: boolean
  ids: TaxIdRow[]
}

const idsKey = (tenantId?: string, userId?: string | null) => ['tax-ids', tenantId, userId] as const

/** The catalogue: it changes only with a migration, so it's read once. */
export function useTaxIdTypes() {
  return useQuery({
    queryKey: ['tax-id-types'],
    staleTime: Infinity,
    queryFn: async (): Promise<TaxIdType[]> => {
      const { data, error } = await supabase.from('os_tax_id_types').select('*').order('position')
      if (error) throw error
      return (data ?? []) as TaxIdType[]
    },
  })
}

/** The masked list, or null when the viewer may not see it at all. */
export function useTaxIds(tenantId: string | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: idsKey(tenantId, userId),
    enabled: !!tenantId && !!userId,
    queryFn: async (): Promise<TaxIds | null> => {
      const { data, error } = await supabase.rpc('os_tax_ids', { _tenant_id: tenantId!, _user_id: userId! })
      if (error) throw error
      return (data as unknown as TaxIds | null) ?? null
    },
  })
}

/** What the database said, when it said something a person can act on (GTX…). */
export function taxIdErrorText(err: unknown, fallback: string) {
  const e = err as { code?: string; message?: string } | null
  return e?.code?.startsWith('GTX') && e.message ? e.message : fallback
}

function useInvalidate(tenantId: string | undefined, userId: string | null | undefined) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: idsKey(tenantId, userId) })
    void qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
  }
}

export function useSaveTaxId(tenantId: string | undefined, userId: string | null | undefined) {
  const done = useInvalidate(tenantId, userId)
  return useMutation({
    mutationFn: async ({ typeKey, value }: { typeKey: string; value: string }) => {
      const { error } = await supabase.rpc('os_save_tax_id', {
        _tenant_id: tenantId!,
        _user_id: userId!,
        _type_key: typeKey,
        _value: value,
      })
      if (error) throw error
    },
    onSuccess: done,
  })
}

export function useRemoveTaxId(tenantId: string | undefined, userId: string | null | undefined) {
  const done = useInvalidate(tenantId, userId)
  return useMutation({
    mutationFn: async (typeKey: string) => {
      const { error } = await supabase.rpc('os_remove_tax_id', { _tenant_id: tenantId!, _user_id: userId!, _type_key: typeKey })
      if (error) throw error
    },
    onSuccess: done,
  })
}

export async function revealTaxId(tenantId: string, userId: string, typeKey: string): Promise<string> {
  const { data, error } = await supabase.rpc('os_reveal_tax_id', { _tenant_id: tenantId, _user_id: userId, _type_key: typeKey })
  if (error) throw error
  return String(data ?? '')
}

// The database's checks (tax_id_normal, tax_id_check), so a typo shows while
// typing. The database is what enforces them.

/** Without spaces, dots, dashes or slashes, in capitals. */
export const normalTaxId = (v: string) => v.replace(/[\s./-]/g, '').toUpperCase()

const num = (c: string) => Number(c)

export function taxIdCheck(rule: CheckRule, v: string): boolean {
  let s = 0
  switch (rule) {
    case 'none':
      return true
    case 'rfc': {
      const dict = '0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ Ñ'
      for (let i = 0; i < 12; i++) s += dict.indexOf(v[i]) * (13 - i)
      const d = 11 - (s % 11)
      return v[12] === (d === 11 ? '0' : d === 10 ? 'A' : String(d))
    }
    case 'nit_co': {
      const w = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]
      const body = v.slice(0, -1)
      for (let i = 0; i < body.length; i++) s += num(body[body.length - 1 - i]) * w[i]
      const r = s % 11
      return num(v.slice(-1)) === (r < 2 ? r : 11 - r)
    }
    case 'cuit': {
      const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
      for (let i = 0; i < 10; i++) s += num(v[i]) * w[i]
      const d = 11 - (s % 11)
      return d === 10 || num(v.slice(-1)) === (d === 11 ? 0 : d)
    }
    case 'cpf': {
      if (/^(.)\1*$/.test(v)) return false
      for (const k of [9, 10]) {
        s = 0
        for (let i = 0; i < k; i++) s += num(v[i]) * (k + 1 - i)
        if (((s * 10) % 11) % 10 !== num(v[k])) return false
      }
      return true
    }
    case 'cnpj': {
      if (/^(.)\1*$/.test(v)) return false
      const w = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      for (const k of [12, 13]) {
        s = 0
        for (let i = 0; i < k; i++) s += num(v[i]) * w[i + 13 - k]
        const r = s % 11
        if ((r < 2 ? 0 : 11 - r) !== num(v[k])) return false
      }
      return true
    }
    case 'rut': {
      const body = v.slice(0, -1)
      let m = 2
      for (let i = body.length - 1; i >= 0; i--) {
        s += num(body[i]) * m
        m = m === 7 ? 2 : m + 1
      }
      const d = 11 - (s % 11)
      return v.slice(-1) === (d === 11 ? '0' : d === 10 ? 'K' : String(d))
    }
    case 'ruc': {
      const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
      for (let i = 0; i < 10; i++) s += num(v[i]) * w[i]
      const d = 11 - (s % 11)
      return num(v.slice(-1)) === (d >= 10 ? d - 10 : d)
    }
    case 'nif': {
      const body = v.slice(0, 8).replace('X', '0').replace('Y', '1').replace('Z', '2')
      return v.slice(-1) === 'TRWAGMYFPDXBNJZSQVHLCKE'[Number(body) % 23]
    }
    case 'luhn': {
      for (let i = 0; i < v.length; i++) {
        let d = num(v[v.length - 1 - i])
        if (i % 2 === 1) {
          d *= 2
          if (d > 9) d -= 9
        }
        s += d
      }
      return s % 10 === 0
    }
    case 'bsn': {
      for (let i = 0; i < 8; i++) s += num(v[i]) * (9 - i)
      return (s - num(v[8])) % 11 === 0
    }
    case 'gstin': {
      const dict = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      for (let i = 0; i < 14; i++) {
        const p = dict.indexOf(v[i]) * (i % 2 === 0 ? 1 : 2)
        s += Math.floor(p / 36) + (p % 36)
      }
      return v.slice(-1) === dict[(36 - (s % 36)) % 36]
    }
  }
}

/** Null when it passes, otherwise the message the database would give. */
export function taxIdProblem(t: TaxIdType, raw: string): string | null {
  const v = normalTaxId(raw)
  if (!v) return `Enter the ${t.label}.`
  if (!new RegExp(t.pattern).test(v)) return `This doesn't look like a ${t.label}. For example: ${t.example}.`
  if (!taxIdCheck(t.check_rule, v)) return `This ${t.label} doesn't add up: check the characters.`
  return null
}
