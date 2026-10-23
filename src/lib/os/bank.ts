import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/integrations/supabase/client'

/**
 * Bank details (member profile step 5, 2026-10-23): where Virgilio pays a
 * person's commissions. The database keeps the account number encrypted and
 * only ever hands the browser the masked view (os_bank_details); the full
 * number comes from os_reveal_bank_account, for admins and Billing, and every
 * reveal is in the person's history. Saving goes through os_save_bank_details,
 * which checks the numbers again and tells the person when someone else
 * changed them.
 */

export type BankKind = 'mx_clabe' | 'us_account' | 'intl'

export interface BankDetails {
  has_details: boolean
  kind: BankKind | null
  country_code: string | null
  holder_name: string | null
  bank_name: string | null
  currency: string | null
  account_label: 'CLABE' | 'Account number' | 'IBAN' | null
  account_last4: string | null
  routing_number: string | null
  account_type: 'checking' | 'savings' | null
  swift: string | null
  updated_at: string | null
  updated_by_name: string | null
  can_edit: boolean
  can_reveal: boolean
}

export interface BankDraft {
  kind: BankKind
  holder_name: string
  bank_name: string
  /** Blank keeps the number on record (same kind of account only). */
  account: string
  currency: string
  country_code: string
  routing_number: string
  account_type: 'checking' | 'savings' | ''
  swift: string
}

export const KIND_LABEL: Record<BankKind, string> = {
  mx_clabe: 'Mexico',
  us_account: 'United States',
  intl: 'Another country',
}

const bankKey = (tenantId?: string, userId?: string | null) => ['bank-details', tenantId, userId] as const

/** The masked details, or null when the viewer may not see them at all. */
export function useBankDetails(tenantId: string | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: bankKey(tenantId, userId),
    enabled: !!tenantId && !!userId,
    queryFn: async (): Promise<BankDetails | null> => {
      const { data, error } = await supabase.rpc('os_bank_details', { _tenant_id: tenantId!, _user_id: userId! })
      if (error) throw error
      const row = (data ?? [])[0]
      return row ? (row as unknown as BankDetails) : null
    },
  })
}

/** What the database said, when it said something a person can act on (GBK…). */
export function bankErrorText(err: unknown, fallback: string) {
  const e = err as { code?: string; message?: string } | null
  return e?.code?.startsWith('GBK') && e.message ? e.message : fallback
}

export function useSaveBankDetails(tenantId: string | undefined, userId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: BankDraft) => {
      const { error } = await supabase.rpc('os_save_bank_details', {
        _tenant_id: tenantId!,
        _user_id: userId!,
        _kind: d.kind,
        _holder_name: d.holder_name,
        _bank_name: d.bank_name,
        _account: d.account,
        _currency: d.currency || null,
        _country_code: d.country_code || null,
        _routing_number: d.routing_number || null,
        _account_type: d.account_type || null,
        _swift: d.swift || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: bankKey(tenantId, userId) })
      void qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
    },
  })
}

export async function revealBankAccount(tenantId: string, userId: string): Promise<string> {
  const { data, error } = await supabase.rpc('os_reveal_bank_account', { _tenant_id: tenantId, _user_id: userId })
  if (error) throw error
  return String(data ?? '')
}

// The same checks as the database, so a typo shows while typing. The database
// is what enforces them.

export const digits = (s: string) => s.replace(/\D/g, '')
export const compact = (s: string) => s.replace(/[\s-]/g, '').toUpperCase()

export function clabeValid(c: string) {
  if (!/^\d{18}$/.test(c)) return false
  const w = [3, 7, 1]
  let s = 0
  for (let i = 0; i < 17; i++) s += (Number(c[i]) * w[i % 3]) % 10
  return (10 - (s % 10)) % 10 === Number(c[17])
}

export function abaValid(r: string) {
  if (!/^\d{9}$/.test(r)) return false
  const d = r.split('').map(Number)
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0
}

export function looksLikeIban(a: string) {
  return /^[A-Z]{2}\d{2}/.test(a) && a.length >= 15
}

export function ibanValid(a: string) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(a)) return false
  const s = a.slice(4) + a.slice(0, 4)
  let r = 0
  for (const ch of s) {
    if (/\d/.test(ch)) r = (r * 10 + Number(ch)) % 97
    else r = (r * 100 + (ch.charCodeAt(0) - 55)) % 97
  }
  return r === 1
}

export const swiftValid = (s: string) => /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(s)

/** The bank behind a CLABE's first three digits (the database's clabe_bank). */
const CLABE_BANKS: Record<string, string> = {
  '002': 'Citibanamex',
  '012': 'BBVA México',
  '014': 'Santander',
  '021': 'HSBC',
  '030': 'BanBajío',
  '036': 'Inbursa',
  '042': 'Mifel',
  '044': 'Scotiabank',
  '058': 'Banregio',
  '059': 'Invex',
  '062': 'Afirme',
  '072': 'Banorte',
  '127': 'Banco Azteca',
  '130': 'Compartamos',
  '132': 'Multiva',
  '133': 'Actinver',
  '137': 'BanCoppel',
  '143': 'CIBanco',
  '156': 'Sabadell',
  '166': 'Banco del Bienestar',
  '638': 'Nu México',
  '646': 'STP',
  '699': 'Fondeadora',
  '722': 'Mercado Pago',
  '728': 'Spin by OXXO',
}
export const clabeBank = (c: string) => (c.length >= 3 ? CLABE_BANKS[c.slice(0, 3)] ?? null : null)

/** "BBVA México · CLABE •••• 7899" */
export function maskedAccount(b: Pick<BankDetails, 'bank_name' | 'account_label' | 'account_last4'>) {
  return [b.bank_name, b.account_label && b.account_last4 ? `${b.account_label} •••• ${b.account_last4}` : null]
    .filter(Boolean)
    .join(' · ')
}

/** Groups of four for reading a revealed number aloud or comparing it. */
export const grouped = (s: string) => s.replace(/(.{4})(?=.)/g, '$1 ')
