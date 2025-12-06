import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeadersFor, handlePreflight } from '../_shared/mod.ts';

interface JobSpecs {
  title?: string;
  skills?: string[];
  location?: string;
  location_details?: {
    type?: 'city' | 'state' | 'country' | 'region' | 'remote';
    city?: string;
    state?: string;
    country?: string;
    country_code?: string;
    region?: 'LATAM' | 'EMEA' | 'APAC' | 'NORTH_AMERICA';
    is_remote?: boolean;
  };
}

interface NormalizedSpecs {
  standardized_title?: string;
  standardized_skills?: string[];
  standardized_location?: string;
  standardized_locations?: string[]; // Array of CoreSignal-compatible location strings
  normalization_metadata: {
    title_mapping?: { original: string; canonical: string; synonyms_used?: string[] };
    skills_mapping?: Array<{ original: string; canonical: string; synonyms_used?: string[] }>;
    location_mapping?: { original: string; canonical: string; coresignal_locations: string[]; synonyms_used?: string[] };
    ai_variations_used?: boolean;
    fallback_used?: boolean;
  };
}

// Region to country code mappings for expanding regional locations
const REGION_TO_COUNTRY_CODES: Record<string, string[]> = {
  'LATAM': ['MX', 'CO', 'AR', 'BR', 'CL', 'PE', 'EC', 'VE', 'UY', 'PY', 'BO', 'CR', 'PA', 'GT', 'SV', 'HN', 'NI', 'DO'],
  'EMEA': ['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'PL', 'BE', 'SE', 'AE', 'SA', 'EG', 'ZA', 'KE'],
  'APAC': ['IN', 'CN', 'JP', 'SG', 'AU', 'KR', 'ID', 'TH', 'VN', 'PH', 'MY', 'NZ'],
  'NORTH_AMERICA': ['US', 'CA'],
};

// City aliases for common variations
const CITY_ALIASES: Record<string, string> = {
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
  'washington dc': 'Washington,District of Columbia,US',
  'dc': 'Washington,District of Columbia,US',
  'mexico city': 'Mexico City,Mexico City,MX',
  'cdmx': 'Mexico City,Mexico City,MX',
  'ciudad de mexico': 'Mexico City,Mexico City,MX',
  'guadalajara': 'Guadalajara,Jalisco,MX',
  'monterrey': 'Monterrey,Nuevo León,MX',
  'toronto': 'Toronto,Ontario,CA',
  'vancouver': 'Vancouver,British Columbia,CA',
  'montreal': 'Montreal,Quebec,CA',
  'buenos aires': 'Buenos Aires,Buenos Aires,AR',
  'bogota': 'Bogotá,Cundinamarca,CO',
  'bogotá': 'Bogotá,Cundinamarca,CO',
  'medellin': 'Medellín,Antioquia,CO',
  'medellín': 'Medellín,Antioquia,CO',
  'santiago': 'Santiago,Santiago Metropolitan,CL',
  'sao paulo': 'São Paulo,São Paulo,BR',
  'são paulo': 'São Paulo,São Paulo,BR',
  'london': 'London,England,GB',
  'berlin': 'Berlin,Berlin,DE',
  'paris': 'Paris,Île-de-France,FR',
  'madrid': 'Madrid,Madrid,ES',
  'barcelona': 'Barcelona,Catalonia,ES',
  'amsterdam': 'Amsterdam,North Holland,NL',
};

// Country name to code mapping
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'united states': 'US', 'usa': 'US', 'u.s.': 'US', 'u.s.a.': 'US', 'america': 'US',
  'canada': 'CA', 'mexico': 'MX', 'méxico': 'MX',
  'united kingdom': 'GB', 'uk': 'GB', 'england': 'GB',
  'germany': 'DE', 'france': 'FR', 'spain': 'ES', 'italy': 'IT', 'netherlands': 'NL',
  'brazil': 'BR', 'brasil': 'BR', 'argentina': 'AR', 'colombia': 'CO', 'chile': 'CL',
  'peru': 'PE', 'perú': 'PE', 'australia': 'AU', 'india': 'IN', 'singapore': 'SG', 'japan': 'JP',
};

serve(async (req) => {
  // Handle preflight FIRST, before any other code runs
  const pre = handlePreflight(req);
  if (pre) return pre;

  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { specs }: { specs: JobSpecs } = await req.json();
    console.log('🔄 Normalizing job specs:', JSON.stringify(specs, null, 2));

    const normalized: NormalizedSpecs = {
      normalization_metadata: {}
    };

    // Normalize title
    if (specs.title) {
      const titleResult = await normalizeTitle(supabaseClient, specs.title);
      if (titleResult.canonical) {
        normalized.standardized_title = titleResult.canonical;
        normalized.normalization_metadata.title_mapping = {
          original: specs.title,
          canonical: titleResult.canonical,
          synonyms_used: titleResult.synonyms_used
        };
      }
    }

    // Normalize skills
    if (specs.skills && specs.skills.length > 0) {
      const skillsResults = await Promise.all(
        specs.skills.map(skill => normalizeSkill(supabaseClient, skill))
      );
      
      const mappedSkills = skillsResults.filter(result => result.canonical);
      if (mappedSkills.length > 0) {
        normalized.standardized_skills = mappedSkills.map(result => result.canonical!);
        normalized.normalization_metadata.skills_mapping = mappedSkills.map(result => ({
          original: result.original,
          canonical: result.canonical!,
          synonyms_used: result.synonyms_used
        }));
      }
    }

    // Normalize location - now returns CoreSignal-compatible locations
    if (specs.location || specs.location_details) {
      const locationResult = await normalizeLocationForCoresignal(specs.location || '', specs.location_details);
      normalized.standardized_location = locationResult.canonical;
      normalized.standardized_locations = locationResult.coresignal_locations;
      normalized.normalization_metadata.location_mapping = {
        original: specs.location || '',
        canonical: locationResult.canonical,
        coresignal_locations: locationResult.coresignal_locations,
        synonyms_used: locationResult.synonyms_used
      };
    }

    // Generate AI variations if needed (for query building later)
    if (specs.title || (specs.skills && specs.skills.length > 0)) {
      try {
        const variations = await generateAIVariations(specs);
        normalized.normalization_metadata.ai_variations_used = true;
        normalized.normalization_metadata = {
          ...normalized.normalization_metadata,
          ...variations
        };
      } catch (error) {
        console.warn('⚠️ AI variations failed, continuing without:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    console.log('✅ Normalization complete:', JSON.stringify(normalized, null, 2));

    return new Response(JSON.stringify({ normalized }), {
      headers: { 'Content-Type': 'application/json', ...cors },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Normalization error:', error);
    return new Response(
      JSON.stringify({ error: 'Normalization failed', details: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { 'Content-Type': 'application/json', ...cors }, status: 500 }
    );
  }
});

async function normalizeTitle(supabaseClient: any, title: string) {
  console.log('🏷️ Normalizing title:', title);
  
  // Try exact match first
  const { data: exactMatch } = await supabaseClient
    .from('standard_job_titles')
    .select('canonical_title, synonyms')
    .eq('canonical_title', title)
    .single();

  if (exactMatch) {
    return { original: title, canonical: exactMatch.canonical_title };
  }

  // Try synonym match
  const { data: synonymMatches } = await supabaseClient
    .from('standard_job_titles')
    .select('canonical_title, synonyms')
    .contains('synonyms', [title.toLowerCase()]);

  if (synonymMatches && synonymMatches.length > 0) {
    const match = synonymMatches[0];
    return { 
      original: title, 
      canonical: match.canonical_title,
      synonyms_used: match.synonyms.filter((s: string) => s.toLowerCase().includes(title.toLowerCase()))
    };
  }

  // Try partial matching
  const { data: partialMatches } = await supabaseClient
    .from('standard_job_titles')
    .select('canonical_title, synonyms')
    .or(`canonical_title.ilike.%${title}%,synonyms.cs.{${title.toLowerCase()}}`);

  if (partialMatches && partialMatches.length > 0) {
    const match = partialMatches[0];
    return { 
      original: title, 
      canonical: match.canonical_title,
      synonyms_used: ['partial_match']
    };
  }

  console.log('⚠️ No standard title found for:', title);
  return { original: title, canonical: null };
}

async function normalizeSkill(supabaseClient: any, skill: string) {
  console.log('🎯 Normalizing skill:', skill);
  
  // Try exact match first
  const { data: exactMatch } = await supabaseClient
    .from('standard_skills')
    .select('canonical_name, synonyms')
    .eq('canonical_name', skill)
    .single();

  if (exactMatch) {
    return { original: skill, canonical: exactMatch.canonical_name };
  }

  // Try synonym match
  const { data: synonymMatches } = await supabaseClient
    .from('standard_skills')
    .select('canonical_name, synonyms')
    .contains('synonyms', [skill.toLowerCase()]);

  if (synonymMatches && synonymMatches.length > 0) {
    const match = synonymMatches[0];
    return { 
      original: skill, 
      canonical: match.canonical_name,
      synonyms_used: match.synonyms.filter((s: string) => s.toLowerCase().includes(skill.toLowerCase()))
    };
  }

  // Try partial matching
  const { data: partialMatches } = await supabaseClient
    .from('standard_skills')
    .select('canonical_name, synonyms')
    .or(`canonical_name.ilike.%${skill}%,synonyms.cs.{${skill.toLowerCase()}}`);

  if (partialMatches && partialMatches.length > 0) {
    const match = partialMatches[0];
    return { 
      original: skill, 
      canonical: match.canonical_name,
      synonyms_used: ['partial_match']
    };
  }

  console.log('⚠️ No standard skill found for:', skill);
  return { original: skill, canonical: skill }; // Keep original if no match
}

// Enhanced location normalization that returns CoreSignal-compatible formats
async function normalizeLocationForCoresignal(
  location: string, 
  locationDetails?: JobSpecs['location_details']
): Promise<{ canonical: string; coresignal_locations: string[]; synonyms_used?: string[] }> {
  console.log('🌍 Normalizing location for CoreSignal:', location, locationDetails);
  
  const locationLower = location.toLowerCase().trim();
  let coresignalLocations: string[] = [];
  let canonical = location;

  // If we have structured location_details from AI, use that first
  if (locationDetails) {
    if (locationDetails.is_remote && locationDetails.region) {
      // Remote with region - expand to country codes
      const regionCodes = REGION_TO_COUNTRY_CODES[locationDetails.region];
      if (regionCodes) {
        coresignalLocations = regionCodes;
        canonical = `Remote - ${locationDetails.region}`;
        console.log('📍 Used location_details region:', locationDetails.region, '→', coresignalLocations);
        return { canonical, coresignal_locations: coresignalLocations };
      }
    } else if (locationDetails.country_code) {
      // Build CoreSignal format from structured data
      if (locationDetails.city && locationDetails.state) {
        coresignalLocations = [`${locationDetails.city},${locationDetails.state},${locationDetails.country_code}`];
      } else if (locationDetails.state) {
        coresignalLocations = [`${locationDetails.state},${locationDetails.country_code}`];
      } else {
        coresignalLocations = [locationDetails.country_code];
      }
      console.log('📍 Built from location_details:', coresignalLocations);
      return { canonical: location, coresignal_locations: coresignalLocations };
    }
  }

  // Check for "Remote - REGION" pattern
  const remoteRegionMatch = location.match(/remote\s*[-–—]\s*(\w+)/i);
  if (remoteRegionMatch) {
    const region = remoteRegionMatch[1].toUpperCase();
    const regionCodes = REGION_TO_COUNTRY_CODES[region];
    if (regionCodes) {
      console.log('📍 Matched Remote - Region pattern:', region, '→', regionCodes);
      return { canonical: location, coresignal_locations: regionCodes };
    }
  }

  // Check for pure "Remote" (global search)
  if (/^remote$/i.test(locationLower) || /^remote\s+work$/i.test(locationLower)) {
    console.log('📍 Pure remote - global search');
    return { canonical: 'Remote', coresignal_locations: [] };
  }

  // Check for region keywords
  for (const [region, codes] of Object.entries(REGION_TO_COUNTRY_CODES)) {
    if (locationLower.includes(region.toLowerCase())) {
      console.log('📍 Matched region keyword:', region, '→', codes);
      return { canonical: location, coresignal_locations: codes };
    }
  }

  // Check city aliases
  for (const [alias, value] of Object.entries(CITY_ALIASES)) {
    if (locationLower.includes(alias)) {
      console.log('📍 Matched city alias:', alias, '→', value);
      return { canonical: location, coresignal_locations: [value] };
    }
  }

  // Try to parse "City, State, Country" or "City, Country" format
  if (location.includes(',')) {
    const parts = location.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1].toLowerCase();
      
      // Check if last part is a country name we know
      const countryCode = COUNTRY_NAME_TO_CODE[lastPart];
      if (countryCode) {
        if (parts.length === 3) {
          // City, State, Country
          coresignalLocations = [`${parts[0]},${parts[1]},${countryCode}`];
        } else if (parts.length === 2) {
          // Could be City, Country or State, Country
          // For major cities, use the city format
          const cityLower = parts[0].toLowerCase();
          if (CITY_ALIASES[cityLower]) {
            coresignalLocations = [CITY_ALIASES[cityLower]];
          } else {
            // Assume it's a state/city and just use country code
            coresignalLocations = [countryCode];
          }
        }
        console.log('📍 Parsed comma-separated location:', parts, '→', coresignalLocations);
        return { canonical: location, coresignal_locations: coresignalLocations };
      }
    }
  }

  // Check for country names
  for (const [countryName, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (locationLower.includes(countryName)) {
      console.log('📍 Matched country name:', countryName, '→', code);
      return { canonical: location, coresignal_locations: [code] };
    }
  }

  console.log('⚠️ Could not normalize location to CoreSignal format:', location);
  return { canonical: location, coresignal_locations: [], synonyms_used: ['no_match'] };
}

// Legacy function for backward compatibility
async function normalizeLocation(supabaseClient: any, location: string) {
  const result = await normalizeLocationForCoresignal(location);
  return { 
    original: location, 
    canonical: result.canonical,
    coresignal_locations: result.coresignal_locations,
    synonyms_used: result.synonyms_used
  };
}

async function generateAIVariations(specs: JobSpecs) {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = `Generate search variations for job matching:
  
Job Title: ${specs.title || 'N/A'}
Skills: ${specs.skills?.join(', ') || 'N/A'}

For each item, provide 3-5 variations including:
- Exact terms
- Common abbreviations 
- Related/synonym terms
- Industry variations

Return as JSON:
{
  "title_variations": ["variation1", "variation2", ...],
  "skill_variations": {
    "skill1": ["var1", "var2", ...],
    "skill2": ["var1", "var2", ...]
  }
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates search variations for job matching. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const variations = JSON.parse(data.choices[0].message.content);
  
  console.log('🤖 Generated AI variations:', JSON.stringify(variations, null, 2));
  return { ai_variations: variations };
}