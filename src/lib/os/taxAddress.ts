import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/integrations/supabase/client'
import { countryName } from '@/lib/places'

/**
 * Tax address (Allan, 2026-10-31): the address on a person's invoices to
 * Virgilio (commission payouts in Gio Sales), or their shipping address when
 * `same_as_shipping` is on (the default; the fields stay empty then).
 * os_person_tax_address keeps one per person, read and written by the person
 * and People & Access admins only (never externals, GEX02); the history names
 * the fields that changed, never the address. Gio Sales reads it only through
 * os_member_invoice_details when a payout is approved.
 */

export interface TaxAddress {
  same_as_shipping: boolean
  line1: string | null
  line2: string | null
  city: string | null
  region: string | null
  postal_code: string | null
  country_code: string | null
}

export const EMPTY_TAX_ADDRESS: TaxAddress = {
  same_as_shipping: true,
  line1: null,
  line2: null,
  city: null,
  region: null,
  postal_code: null,
  country_code: null,
}

const COLUMNS = 'same_as_shipping, line1, line2, city, region, postal_code, country_code'

const key = (tenantId: string | undefined, userId: string | null | undefined) => ['os-person-tax-address', tenantId, userId] as const

/** The address as it reads on an invoice, one line each, without blanks. */
export function taxAddressLines(a: Omit<TaxAddress, 'same_as_shipping'> | null | undefined): string[] {
  if (!a) return []
  const cityLine = [[a.city, a.region].filter(Boolean).join(', '), a.postal_code].filter(Boolean).join(' ')
  return [a.line1, a.line2, cityLine, countryName(a.country_code)].map((s) => (s ?? '').trim()).filter(Boolean)
}

/** Enough for an invoice: a street, a city and a country. */
export const addressComplete = (a: Omit<TaxAddress, 'same_as_shipping'> | null | undefined) => !!(a?.line1 && a.city && a.country_code)

/** null when nothing is saved yet, which reads as "same as shipping". */
export function useTaxAddress(tenantId: string | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: key(tenantId, userId),
    enabled: !!tenantId && !!userId,
    queryFn: async (): Promise<TaxAddress | null> => {
      const { data, error } = await supabase
        .from('os_person_tax_address')
        .select(COLUMNS)
        .eq('tenant_id', tenantId!)
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Saves the whole row (the database empties the fields when it's the same as shipping, and records which fields changed). */
export function useSaveTaxAddress(tenantId: string | undefined, userId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (address: TaxAddress) => {
      const { data, error } = await supabase
        .from('os_person_tax_address')
        .upsert({ tenant_id: tenantId!, user_id: userId!, ...address }, { onConflict: 'tenant_id,user_id' })
        .select(COLUMNS)
        .single()
      if (error) throw error
      return data as TaxAddress
    },
    onMutate: async (address) => {
      // The switch moves at once; a failure puts it back.
      const before = qc.getQueryData<TaxAddress | null>(key(tenantId, userId))
      qc.setQueryData(key(tenantId, userId), address)
      return { before }
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(key(tenantId, userId), ctx.before ?? null)
    },
    onSuccess: (saved) => {
      qc.setQueryData(key(tenantId, userId), saved)
      void qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
    },
  })
}
