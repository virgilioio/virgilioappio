import { COUNTRIES } from '@/constants/countries'

/**
 * Rough centre of each country as [lng, lat], for pins on the talent map
 * (Intelligence). Names match how candidates store countries; ISO codes
 * resolve through COUNTRIES.
 */
export const COUNTRY_COORDS: Record<string, [number, number]> = {
  'United States': [-98, 39], 'Canada': [-106, 56], 'Mexico': [-102, 23],
  'Brazil': [-51, -14], 'Argentina': [-64, -34], 'Colombia': [-74, 4],
  'Chile': [-71, -35], 'Peru': [-76, -10], 'Venezuela': [-66, 7],
  'Ecuador': [-78, -2], 'Uruguay': [-56, -33], 'Paraguay': [-58, -23],
  'Bolivia': [-65, -17], 'Puerto Rico': [-66, 18], 'Suriname': [-56, 4],
  'Guatemala': [-90, 15], 'Dominican Republic': [-70, 19], 'El Salvador': [-89, 14],
  'Honduras': [-87, 15], 'Nicaragua': [-85, 13], 'Cuba': [-79, 22], 'Costa Rica': [-84, 10], 'Panama': [-80, 9],
  'United Kingdom': [-2, 54], 'Germany': [10, 51], 'France': [2, 47],
  'Spain': [-4, 40], 'Italy': [12, 43], 'Netherlands': [5, 52],
  'Belgium': [4, 51], 'Switzerland': [8, 47], 'Austria': [14, 47],
  'Sweden': [15, 62], 'Norway': [8, 62], 'Denmark': [10, 56],
  'Finland': [26, 64], 'Poland': [20, 52], 'Portugal': [-8, 39],
  'Ireland': [-8, 53], 'Czech Republic': [15, 50], 'Romania': [25, 46],
  'Greece': [22, 39], 'Hungary': [19, 47], 'Ukraine': [32, 49],
  'Turkey': [35, 39], 'Russia': [105, 60],
  'India': [79, 21], 'China': [104, 35], 'Japan': [138, 36],
  'South Korea': [128, 36], 'Korea (South)': [128, 36],
  'Indonesia': [120, -5], 'Philippines': [122, 13],
  'Vietnam': [108, 14], 'Thailand': [101, 15], 'Malaysia': [102, 4],
  'Singapore': [104, 1], 'Pakistan': [69, 30], 'Bangladesh': [90, 24],
  'Sri Lanka': [81, 7], 'Nepal': [84, 28],
  'Australia': [133, -27], 'New Zealand': [174, -41],
  'South Africa': [24, -29], 'Nigeria': [8, 10], 'Kenya': [38, 0],
  'Egypt': [30, 27], 'Morocco': [-6, 32], 'Ghana': [-2, 8],
  'Ethiopia': [40, 9], 'Tanzania': [35, -6],
  'Israel': [35, 31], 'United Arab Emirates': [54, 24],
  'Saudi Arabia': [45, 24], 'Qatar': [51, 25],
  'Taiwan': [121, 24], 'Hong Kong': [114, 22],
}

export function getCoords(name: string): [number, number] | null {
  if (COUNTRY_COORDS[name]) return COUNTRY_COORDS[name]
  const country = COUNTRIES.find(c => c.value === name || c.label === name)
  if (country && COUNTRY_COORDS[country.label]) return COUNTRY_COORDS[country.label]
  return null
}

export function countryName(name: string): string {
  const country = COUNTRIES.find(c => c.value === name)
  return country ? country.label : name
}

export function countryFlag(name: string): string | null {
  const country = COUNTRIES.find(c => c.value === name || c.label === name)
  if (!country) return null
  return country.value.toUpperCase().replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)))
}
