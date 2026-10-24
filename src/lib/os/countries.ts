import { COUNTRIES } from '@/constants/countries'

/** A country's name from its two-letter code ("MX" → "Mexico"), or the code itself. */
export const countryLabel = (code: string | null | undefined) =>
  code ? COUNTRIES.find((c) => c.value === code)?.label ?? code : 'Not set'
