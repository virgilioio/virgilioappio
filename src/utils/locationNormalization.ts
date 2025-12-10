import { LOCATION_OPTIONS, type LocationOption } from '@/constants/locations'

// Region to country code mappings (for expanding "Remote - LATAM" etc.)
export const REGION_TO_COUNTRY_CODES: Record<string, string[]> = {
  'LATAM': ['MX', 'CO', 'AR', 'BR', 'CL', 'PE', 'EC', 'VE', 'UY', 'PY', 'BO', 'CR', 'PA', 'GT', 'SV', 'HN', 'NI', 'DO'],
  'EMEA': ['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'PL', 'BE', 'SE', 'AE', 'SA', 'EG', 'ZA', 'KE'],
  'APAC': ['IN', 'CN', 'JP', 'SG', 'AU', 'KR', 'ID', 'TH', 'VN', 'PH', 'MY', 'NZ'],
  'NORTH_AMERICA': ['US', 'CA'],
  'NA': ['US', 'CA'],
  'NORTH AMERICA': ['US', 'CA'],
  'EUROPE': ['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'PL', 'BE', 'SE', 'PT', 'AT', 'CH', 'IE'],
  'ASIA': ['IN', 'CN', 'JP', 'SG', 'KR', 'ID', 'TH', 'VN', 'PH', 'MY'],
}

// Common city name variations and their canonical sourcing format
const CITY_ALIASES: Record<string, string> = {
  // US Cities
  'new york': 'New York,New York,US',
  'nyc': 'New York,New York,US',
  'new york city': 'New York,New York,US',
  'los angeles': 'Los Angeles,California,US',
  'la': 'Los Angeles,California,US',
  'san francisco': 'San Francisco,California,US',
  'sf': 'San Francisco,California,US',
  'bay area': 'San Francisco,California,US',
  'chicago': 'Chicago,Illinois,US',
  'boston': 'Boston,Massachusetts,US',
  'seattle': 'Seattle,Washington,US',
  'austin': 'Austin,Texas,US',
  'denver': 'Denver,Colorado,US',
  'miami': 'Miami,Florida,US',
  'atlanta': 'Atlanta,Georgia,US',
  'washington': 'Washington,District of Columbia,US',
  'washington dc': 'Washington,District of Columbia,US',
  'dc': 'Washington,District of Columbia,US',
  
  // Mexico Cities - Extended with Spanish variations
  'mexico city': 'Mexico City,Mexico City,MX',
  'cdmx': 'Mexico City,Mexico City,MX',
  'ciudad de mexico': 'Mexico City,Mexico City,MX',
  'ciudad de méxico': 'Mexico City,Mexico City,MX',
  'mexico city, cdmx': 'Mexico City,Mexico City,MX',
  'mexico city, cdmx, mexico': 'Mexico City,Mexico City,MX',
  'mexico city, cdmx, méxico': 'Mexico City,Mexico City,MX',
  'ciudad de méxico, cdmx': 'Mexico City,Mexico City,MX',
  'ciudad de méxico, cdmx, méxico': 'Mexico City,Mexico City,MX',
  'cdmx, mexico': 'Mexico City,Mexico City,MX',
  'cdmx, méxico': 'Mexico City,Mexico City,MX',
  'df': 'Mexico City,Mexico City,MX',
  'distrito federal': 'Mexico City,Mexico City,MX',
  'guadalajara': 'Guadalajara,Jalisco,MX',
  'guadalajara, jalisco': 'Guadalajara,Jalisco,MX',
  'guadalajara, jal': 'Guadalajara,Jalisco,MX',
  'guadalajara, jalisco, mexico': 'Guadalajara,Jalisco,MX',
  'guadalajara, jalisco, méxico': 'Guadalajara,Jalisco,MX',
  'monterrey': 'Monterrey,Nuevo León,MX',
  'monterrey, nuevo leon': 'Monterrey,Nuevo León,MX',
  'monterrey, nuevo león': 'Monterrey,Nuevo León,MX',
  'monterrey, nl': 'Monterrey,Nuevo León,MX',
  'monterrey, nuevo leon, mexico': 'Monterrey,Nuevo León,MX',
  'monterrey, nuevo león, méxico': 'Monterrey,Nuevo León,MX',
  'tijuana': 'Tijuana,Baja California,MX',
  'tijuana, baja california': 'Tijuana,Baja California,MX',
  'tijuana, bc': 'Tijuana,Baja California,MX',
  'cancun': 'Cancún,Quintana Roo,MX',
  'cancún': 'Cancún,Quintana Roo,MX',
  'cancun, quintana roo': 'Cancún,Quintana Roo,MX',
  'merida': 'Mérida,Yucatán,MX',
  'mérida': 'Mérida,Yucatán,MX',
  'merida, yucatan': 'Mérida,Yucatán,MX',
  'mérida, yucatán': 'Mérida,Yucatán,MX',
  'puebla': 'Puebla,Puebla,MX',
  'puebla, puebla': 'Puebla,Puebla,MX',
  'queretaro': 'Querétaro,Querétaro,MX',
  'querétaro': 'Querétaro,Querétaro,MX',
  'leon': 'León,Guanajuato,MX',
  'león': 'León,Guanajuato,MX',
  'leon, guanajuato': 'León,Guanajuato,MX',
  
  // Canada Cities
  'toronto': 'Toronto,Ontario,CA',
  'vancouver': 'Vancouver,British Columbia,CA',
  'montreal': 'Montreal,Quebec,CA',
  'montréal': 'Montreal,Quebec,CA',
  'calgary': 'Calgary,Alberta,CA',
  'ottawa': 'Ottawa,Ontario,CA',
  
  // South America Cities - Extended with Spanish/Portuguese variations
  'buenos aires': 'Buenos Aires,Buenos Aires,AR',
  'buenos aires, argentina': 'Buenos Aires,Buenos Aires,AR',
  'bogota': 'Bogotá,Cundinamarca,CO',
  'bogotá': 'Bogotá,Cundinamarca,CO',
  'bogota, colombia': 'Bogotá,Cundinamarca,CO',
  'bogotá, colombia': 'Bogotá,Cundinamarca,CO',
  'medellin': 'Medellín,Antioquia,CO',
  'medellín': 'Medellín,Antioquia,CO',
  'medellin, colombia': 'Medellín,Antioquia,CO',
  'medellín, colombia': 'Medellín,Antioquia,CO',
  'santiago': 'Santiago,Santiago Metropolitan,CL',
  'santiago, chile': 'Santiago,Santiago Metropolitan,CL',
  'sao paulo': 'São Paulo,São Paulo,BR',
  'são paulo': 'São Paulo,São Paulo,BR',
  'sao paulo, brazil': 'São Paulo,São Paulo,BR',
  'são paulo, brasil': 'São Paulo,São Paulo,BR',
  'rio de janeiro': 'Rio de Janeiro,Rio de Janeiro,BR',
  'rio de janeiro, brazil': 'Rio de Janeiro,Rio de Janeiro,BR',
  'rio de janeiro, brasil': 'Rio de Janeiro,Rio de Janeiro,BR',
  'lima': 'Lima,Lima,PE',
  'lima, peru': 'Lima,Lima,PE',
  'lima, perú': 'Lima,Lima,PE',
  
  // European Cities
  'london': 'London,England,GB',
  'berlin': 'Berlin,Berlin,DE',
  'paris': 'Paris,Île-de-France,FR',
  'madrid': 'Madrid,Madrid,ES',
  'barcelona': 'Barcelona,Catalonia,ES',
  'amsterdam': 'Amsterdam,North Holland,NL',
}

// State/Province abbreviation to full name mapping
const STATE_ALIASES: Record<string, string> = {
  // Mexico states
  'cdmx': 'Mexico City',
  'df': 'Mexico City',
  'jal': 'Jalisco',
  'nl': 'Nuevo León',
  'bc': 'Baja California',
  'qro': 'Querétaro',
  'gto': 'Guanajuato',
  'pue': 'Puebla',
  'yuc': 'Yucatán',
  'qroo': 'Quintana Roo',
  // US states
  'ca': 'California',
  'ny': 'New York',
  'tx': 'Texas',
  'fl': 'Florida',
  'wa': 'Washington',
  'co': 'Colorado',
  'il': 'Illinois',
  'ma': 'Massachusetts',
  'ga': 'Georgia',
}

// Country name to code mapping
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'united states': 'US',
  'usa': 'US',
  'u.s.': 'US',
  'u.s.a.': 'US',
  'america': 'US',
  'canada': 'CA',
  'mexico': 'MX',
  'méxico': 'MX',
  'united kingdom': 'GB',
  'uk': 'GB',
  'germany': 'DE',
  'france': 'FR',
  'spain': 'ES',
  'italy': 'IT',
  'netherlands': 'NL',
  'brazil': 'BR',
  'brasil': 'BR',
  'argentina': 'AR',
  'colombia': 'CO',
  'chile': 'CL',
  'peru': 'PE',
  'perú': 'PE',
  'australia': 'AU',
  'india': 'IN',
  'singapore': 'SG',
  'japan': 'JP',
}

/**
 * Format location for Apollo API
 * Apollo uses simple format: "City, Country" or "State, Country"
 */
export function formatLocationForApollo(locationValue: string): string | null {
  const parts = locationValue.split(',').map(p => p.trim());
  
  // Country code to name mapping
  const COUNTRY_CODE_TO_NAME: Record<string, string> = {
    'US': 'United States', 'CA': 'Canada', 'GB': 'United Kingdom', 'DE': 'Germany',
    'FR': 'France', 'ES': 'Spain', 'IT': 'Italy', 'NL': 'Netherlands', 'MX': 'Mexico',
    'BR': 'Brazil', 'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia', 'PE': 'Peru',
    'IN': 'India', 'CN': 'China', 'JP': 'Japan', 'SG': 'Singapore', 'AU': 'Australia'
  };
  
  if (parts.length === 3) {
    // "City,State,Country" → "City, Country"
    const city = parts[0];
    const countryCode = parts[2];
    const countryName = COUNTRY_CODE_TO_NAME[countryCode] || countryCode;
    return `${city}, ${countryName}`;
  } else if (parts.length === 2) {
    // "State,Country" → "State, Country"
    const state = parts[0];
    const countryCode = parts[1];
    const countryName = COUNTRY_CODE_TO_NAME[countryCode] || countryCode;
    return `${state}, ${countryName}`;
  } else if (parts.length === 1) {
    const countryCode = parts[0];
    return COUNTRY_CODE_TO_NAME[countryCode] || countryCode;
  }
  
  return null;
}

/**
 * Normalize a free-form location string to sourcing-compatible format(s)
 * Returns an array of location strings in the format expected by sourcing APIs
 */
export function normalizeLocationForSourcing(freeformLocation: string): string[] {
  if (!freeformLocation || freeformLocation.trim() === '') {
    return []
  }

  const location = freeformLocation.trim()
  const locationLower = location.toLowerCase()

  // Check for "Remote" with region (e.g., "Remote - LATAM")
  const remoteRegionMatch = location.match(/remote\s*[-–—]\s*(\w+)/i)
  if (remoteRegionMatch) {
    const region = remoteRegionMatch[1].toUpperCase()
    const countryCodes = REGION_TO_COUNTRY_CODES[region]
    if (countryCodes) {
      // Return country codes for the region
      return countryCodes
    }
  }

  // Check for pure "Remote" (no region) - return empty (global search)
  if (/^remote$/i.test(location.trim()) || /^remote\s+work$/i.test(location.trim())) {
    return []
  }

  // Check for region keywords in the location
  for (const [region, codes] of Object.entries(REGION_TO_COUNTRY_CODES)) {
    if (locationLower.includes(region.toLowerCase())) {
      return codes
    }
  }

  // Check for city aliases first (most specific) - check exact match first
  if (CITY_ALIASES[locationLower]) {
    return [CITY_ALIASES[locationLower]]
  }
  
  // Then check partial city alias matches
  for (const [alias, value] of Object.entries(CITY_ALIASES)) {
    if (locationLower.includes(alias)) {
      return [value]
    }
  }

  // Try exact match in LOCATION_OPTIONS
  const exactMatch = LOCATION_OPTIONS.find(
    opt => opt.label.toLowerCase() === locationLower || opt.value.toLowerCase() === locationLower
  )
  if (exactMatch) {
    return [exactMatch.value]
  }

  // Try partial matching in LOCATION_OPTIONS
  const partialMatches = LOCATION_OPTIONS.filter(opt => {
    const labelLower = opt.label.toLowerCase()
    const cityLower = opt.city?.toLowerCase() || ''
    const stateLower = opt.state?.toLowerCase() || ''
    
    return (
      locationLower.includes(cityLower) && cityLower !== '' ||
      locationLower.includes(stateLower) && stateLower !== '' ||
      labelLower.includes(locationLower) ||
      cityLower.includes(locationLower) ||
      stateLower.includes(locationLower)
    )
  })

  if (partialMatches.length > 0) {
    // Prefer city matches over state/country matches
    const cityMatches = partialMatches.filter(m => m.type === 'city')
    if (cityMatches.length > 0) {
      return [cityMatches[0].value]
    }
    return [partialMatches[0].value]
  }

  // Check for country name match
  for (const [countryName, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (locationLower.includes(countryName)) {
      // Return country code only
      return [code]
    }
  }

  // If the location contains a comma, try to parse it as "City, State, Country" format
  if (location.includes(',')) {
    const parts = location.split(',').map(p => p.trim())
    
    if (parts.length >= 2) {
      const cityPart = parts[0].toLowerCase()
      const statePart = parts.length >= 3 ? parts[1].toLowerCase() : ''
      const countryPart = parts[parts.length - 1].toLowerCase()
      
      // Expand state abbreviations
      const expandedState = STATE_ALIASES[statePart] || statePart
      
      // Look for country code
      const countryCode = COUNTRY_NAME_TO_CODE[countryPart] || 
        Object.entries(COUNTRY_NAME_TO_CODE).find(([name]) => countryPart.includes(name))?.[1]
      
      if (countryCode) {
        // Try to find a matching city in that country
        const cityMatch = LOCATION_OPTIONS.find(opt => 
          opt.countryCode === countryCode && 
          opt.city?.toLowerCase() === cityPart
        )
        if (cityMatch) {
          return [cityMatch.value]
        }
        
        // If we have city and state, try to construct a valid location
        if (cityPart && expandedState) {
          // Check if this constructed location exists in LOCATION_OPTIONS
          const constructedMatch = LOCATION_OPTIONS.find(opt =>
            opt.countryCode === countryCode &&
            opt.city?.toLowerCase() === cityPart &&
            opt.state?.toLowerCase() === expandedState.toLowerCase()
          )
          if (constructedMatch) {
            return [constructedMatch.value]
          }
        }
        
        // Just return the country code as fallback
        return [countryCode]
      }
    }
  }

  // Fallback: return empty array (will result in global search)
  console.warn(`Could not normalize location: "${location}"`)
  return []
}

/**
 * Check if a location string is already in valid sourcing format
 */
export function isValidSourcingLocation(location: string): boolean {
  if (!location) return false
  
  // Check if it exactly matches a LOCATION_OPTIONS value
  const isExactMatch = LOCATION_OPTIONS.some(opt => opt.value === location)
  if (isExactMatch) return true
  
  // Check if it's a valid country code
  if (/^[A-Z]{2}$/.test(location)) return true
  
  // Check if it's in "State,CountryCode" or "City,State,CountryCode" format
  const parts = location.split(',')
  if (parts.length === 2 || parts.length === 3) {
    const countryCode = parts[parts.length - 1].trim()
    if (/^[A-Z]{2}$/.test(countryCode)) return true
  }
  
  return false
}

/**
 * Get a display label for a sourcing location value
 */
export function getLocationDisplayLabel(value: string): string {
  const location = LOCATION_OPTIONS.find(loc => loc.value === value)
  if (location) return location.label
  
  // For country codes, return the country name
  const countryName = Object.entries(COUNTRY_NAME_TO_CODE).find(([_, code]) => code === value)?.[0]
  if (countryName) {
    return countryName.charAt(0).toUpperCase() + countryName.slice(1)
  }
  
  // Parse the value and format it
  const parts = value.split(',')
  return parts.join(', ')
}

/**
 * Normalize an array of locations, handling both already-valid and freeform locations
 */
export function normalizeLocationsArray(locations: string[]): string[] {
  const normalized = new Set<string>()
  
  for (const loc of locations) {
    if (isValidSourcingLocation(loc)) {
      normalized.add(loc)
    } else {
      const normalizedLocs = normalizeLocationForSourcing(loc)
      normalizedLocs.forEach(l => normalized.add(l))
    }
  }
  
  return Array.from(normalized)
}

// Backwards compatibility exports
export const normalizeLocationForCoresignal = normalizeLocationForSourcing
export const isValidCoresignalLocation = isValidSourcingLocation
