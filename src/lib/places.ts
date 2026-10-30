import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { supabase } from '@/integrations/supabase/client'
import { COUNTRIES } from '@/constants/countries'
import { motionToken } from '@/lib/motion'

/**
 * Places (Allan, 2026-10-26): every country's states and provinces and every
 * city of 5,000 people or more, loaded from GeoNames (CC BY 4.0) into
 * geo_regions / geo_cities by the geo-load Edge Function. Anyone reads them,
 * the careers pages included. Locations are still stored as text (a member's
 * country code, a candidate's country name), so a place that isn't listed can
 * always be typed instead.
 */

export interface Region {
  code: string
  name: string
}

export interface City {
  id: number
  name: string
  region_code: string | null
  region_name: string | null
  population: number
}

/** Lower case without accents, as geo_fold() does in the database. */
export const foldPlace = (s: string | null | undefined) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[łŁ]/g, 'l')
    .replace(/[øØ]/g, 'o')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .trim()

const ALIASES: Record<string, string> = {
  usa: 'US',
  'u.s.': 'US',
  'u.s.a.': 'US',
  'united states of america': 'US',
  uk: 'GB',
  'u.k.': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'great britain': 'GB',
  brasil: 'BR',
  espana: 'ES',
  'the netherlands': 'NL',
  holland: 'NL',
  deutschland: 'DE',
}

/** An ISO code for a country written as a code or a name ("Mexico", "México", "MX"); '' if unknown. */
export function countryCodeFor(value: string | null | undefined): string {
  const raw = (value ?? '').trim()
  if (!raw) return ''
  const upper = raw.toUpperCase()
  if (upper !== 'OTHER' && COUNTRIES.some((c) => c.value === upper)) return upper
  const folded = foldPlace(raw)
  if (ALIASES[folded]) return ALIASES[folded]
  return COUNTRIES.find((c) => c.value !== 'OTHER' && foldPlace(c.label) === folded)?.value ?? ''
}

/** The English name for an ISO code, or the code itself. */
export const countryName = (code: string | null | undefined) =>
  code ? (COUNTRIES.find((c) => c.value === code)?.label ?? code) : ''

/** A country's states and provinces, by name. Fetched once per country and kept. */
export function useRegions(countryCode: string | null | undefined) {
  const cc = (countryCode ?? '').toUpperCase()
  return useQuery({
    queryKey: ['geo-regions', cc],
    enabled: /^[A-Z]{2}$/.test(cc),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<Region[]> => {
      const { data, error } = await supabase.from('geo_regions').select('code, name').eq('country_code', cc).order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

/** The region whose name matches what's stored (accents and case aside). */
export const regionByName = (regions: Region[] | undefined, name: string | null | undefined) => {
  const f = foldPlace(name)
  return f ? regions?.find((r) => foldPlace(r.name) === f) : undefined
}

/** Waits --delay-search after typing stops (§12). */
export function useDebounced<T>(value: T, ms = motionToken('--delay-search', 150)) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

/** Cities in a country (and state), biggest first, matching the start of any word. */
export function useCitySearch(countryCode: string | null | undefined, regionCode: string | null | undefined, q: string, enabled = true) {
  const cc = (countryCode ?? '').toUpperCase()
  const query = foldPlace(q)
  return useQuery({
    queryKey: ['geo-cities', cc, regionCode ?? null, query],
    enabled: enabled && /^[A-Z]{2}$/.test(cc),
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<City[]> => {
      const { data, error } = await supabase.rpc('geo_cities_search', {
        _country: cc,
        _region: regionCode ?? undefined,
        _q: query || undefined,
        _limit: 30,
      })
      if (error) throw error
      return (data ?? []) as City[]
    },
  })
}

/**
 * How the three pickers move together: changing the country clears the state
 * and city, changing the state clears the city, and a city picked from the
 * list fills an empty state. `country` is an ISO code.
 */
export interface PlaceValue {
  country: string
  region: string
  city: string
}

export function placeChange(prev: PlaceValue, key: keyof PlaceValue, value: string, regionOfCity?: string): PlaceValue {
  if (key === 'country') return value === prev.country ? prev : { country: value, region: '', city: '' }
  if (key === 'region') return foldPlace(value) === foldPlace(prev.region) ? prev : { ...prev, region: value, city: '' }
  return { ...prev, city: value, region: regionOfCity && !prev.region ? regionOfCity : prev.region }
}

/** A place by name ({ country, region, city } with the country's name) as one readable line: "Monterrey, Nuevo León, Mexico". */
export function placeToText(p: PlaceValue): string {
  return [p.city, p.region, p.country].map((s) => s.trim()).filter(Boolean).join(', ')
}

/**
 * Reads a line written by placeToText (or typed by hand) back into a place by
 * name. The last part counts as the country only when it is one; a line that
 * doesn't end in a country is kept whole as the city, so nothing typed is lost.
 */
export function placeFromText(text: string | null | undefined): PlaceValue {
  const raw = (text ?? '').trim()
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const last = parts[parts.length - 1]
  if (!last || !countryCodeFor(last)) return { country: '', region: '', city: raw }
  const country = countryName(countryCodeFor(last))
  if (parts.length === 1) return { country, region: '', city: '' }
  if (parts.length === 2) return { country, region: '', city: parts[0] }
  return { country, region: parts[parts.length - 2], city: parts.slice(0, -2).join(', ') }
}
