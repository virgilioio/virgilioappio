import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../../utils/createSecureEdgeFunction.ts";

const corsHeaders = createSecureCorsHeaders();

interface JobSpecs {
  title?: string;
  skills?: string[];
  location?: string;
}

interface NormalizedSpecs {
  standardized_title?: string;
  standardized_skills?: string[];
  standardized_location?: string;
  normalization_metadata: {
    title_mapping?: { original: string; canonical: string; synonyms_used?: string[] };
    skills_mapping?: Array<{ original: string; canonical: string; synonyms_used?: string[] }>;
    location_mapping?: { original: string; canonical: string; synonyms_used?: string[] };
    ai_variations_used?: boolean;
    fallback_used?: boolean;
  };
}

serve(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;
    return new Response(null, { headers: corsHeaders });
  }

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

    // Normalize location
    if (specs.location) {
      const locationResult = await normalizeLocation(supabaseClient, specs.location);
      if (locationResult.canonical) {
        normalized.standardized_location = locationResult.canonical;
        normalized.normalization_metadata.location_mapping = {
          original: specs.location,
          canonical: locationResult.canonical,
          synonyms_used: locationResult.synonyms_used
        };
      }
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Normalization error:', error);
    return new Response(
      JSON.stringify({ error: 'Normalization failed', details: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
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

async function normalizeLocation(supabaseClient: any, location: string) {
  console.log('🌍 Normalizing location:', location);
  
  // Check for remote indicators first
  const remoteKeywords = ['remote', 'wfh', 'work from home', 'distributed', 'anywhere', 'virtual'];
  if (remoteKeywords.some(keyword => location.toLowerCase().includes(keyword))) {
    return { original: location, canonical: 'Remote' };
  }

  // Try exact match
  const { data: exactMatch } = await supabaseClient
    .from('standard_locations')
    .select('canonical_name, synonyms')
    .eq('canonical_name', location)
    .single();

  if (exactMatch) {
    return { original: location, canonical: exactMatch.canonical_name };
  }

  // Try synonym match
  const { data: synonymMatches } = await supabaseClient
    .from('standard_locations')
    .select('canonical_name, synonyms')
    .contains('synonyms', [location.toLowerCase()]);

  if (synonymMatches && synonymMatches.length > 0) {
    const match = synonymMatches[0];
    return { 
      original: location, 
      canonical: match.canonical_name,
      synonyms_used: match.synonyms.filter((s: string) => s.toLowerCase().includes(location.toLowerCase()))
    };
  }

  // Try partial matching
  const { data: partialMatches } = await supabaseClient
    .from('standard_locations')
    .select('canonical_name, synonyms')
    .or(`canonical_name.ilike.%${location}%,synonyms.cs.{${location.toLowerCase()}}`);

  if (partialMatches && partialMatches.length > 0) {
    const match = partialMatches[0];
    return { 
      original: location, 
      canonical: match.canonical_name,
      synonyms_used: ['partial_match']
    };
  }

  console.log('⚠️ No standard location found for:', location);
  return { original: location, canonical: location }; // Keep original if no match
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