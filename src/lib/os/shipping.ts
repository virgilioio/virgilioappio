import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/integrations/supabase/client'
import { countryName } from '@/lib/places'

/**
 * Shipping addresses (Allan, 2026-10-26): where Virgilio sends a person swag
 * or mail. os_person_shipping keeps one per person, read and written by the
 * person and People & Access admins only (never externals, GEX02); the
 * history names the fields that changed, never the address. A profile counts
 * it as done with a street, a city and a country.
 */

export interface ShippingAddress {
  recipient_name: string | null
  line1: string | null
  line2: string | null
  city: string | null
  region: string | null
  postal_code: string | null
  country_code: string | null
  phone: string | null
  notes: string | null
}

export const EMPTY_SHIPPING: ShippingAddress = {
  recipient_name: null,
  line1: null,
  line2: null,
  city: null,
  region: null,
  postal_code: null,
  country_code: null,
  phone: null,
  notes: null,
}

const COLUMNS = 'recipient_name, line1, line2, city, region, postal_code, country_code, phone, notes'

const key = (tenantId: string | undefined, userId: string | null | undefined) => ['os-person-shipping', tenantId, userId] as const

export const shippingComplete = (a: ShippingAddress | null | undefined) => !!(a?.line1 && a.city && a.country_code)

/** The address as it goes on a parcel, one line each, without blanks. */
export function shippingLines(a: ShippingAddress | null | undefined, fallbackName?: string | null): string[] {
  if (!a) return []
  const cityLine = [[a.city, a.region].filter(Boolean).join(', '), a.postal_code].filter(Boolean).join(' ')
  return [a.recipient_name || fallbackName || '', a.line1, a.line2, cityLine, countryName(a.country_code)]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
}

export function useShipping(tenantId: string | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: key(tenantId, userId),
    enabled: !!tenantId && !!userId,
    queryFn: async (): Promise<ShippingAddress | null> => {
      const { data, error } = await supabase
        .from('os_person_shipping')
        .select(COLUMNS)
        .eq('tenant_id', tenantId!)
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Saves the whole address (the database turns blanks into nulls and records which fields changed). */
export function useSaveShipping(tenantId: string | undefined, userId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (address: ShippingAddress) => {
      const { data, error } = await supabase
        .from('os_person_shipping')
        .upsert({ tenant_id: tenantId!, user_id: userId!, ...address }, { onConflict: 'tenant_id,user_id' })
        .select(COLUMNS)
        .single()
      if (error) throw error
      return data as ShippingAddress
    },
    onSuccess: (saved) => {
      qc.setQueryData(key(tenantId, userId), saved)
      void qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
    },
  })
}

export interface ShippingRow extends ShippingAddress {
  user_id: string
  updated_at: string
}

/** Everyone's addresses in a workspace, for an admin's export (RLS returns only your own otherwise). */
export async function fetchAllShipping(tenantId: string): Promise<ShippingRow[]> {
  const { data, error } = await supabase
    .from('os_person_shipping')
    .select(`user_id, updated_at, ${COLUMNS}`)
    .eq('tenant_id', tenantId)
  if (error) throw error
  return (data ?? []) as ShippingRow[]
}
