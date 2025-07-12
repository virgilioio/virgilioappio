import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CandidateData {
  // CoreSignal format
  member_skills_collection?: Array<{ skill: string }>;
  experience?: Array<{ title: string }>;
  title?: string;
  country?: string;
  location?: string;
  // Internal DB format
  skills?: string[];
  role_current?: string;
  location_country?: string;
  location_city?: string;
}

interface EnrichmentRequest {
  candidates: CandidateData[];
  searchId?: string;
  searchCriteria?: any;
}

interface ExtractionResult {
  skills: string[];
  job_titles: string[];
  locations: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
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

    const startTime = Date.now();
    const { candidates, searchId, searchCriteria }: EnrichmentRequest = await req.json();
    
    console.log(`🧠 Starting library enrichment for ${candidates.length} candidates`);
    console.log('🔍 Search criteria:', searchCriteria);

    // Step 1: Extract terms from candidates
    const extracted = extractTermsFromCandidates(candidates);
    console.log('📊 Extracted terms:', {
      skills: extracted.skills.length,
      job_titles: extracted.job_titles.length,
      locations: extracted.locations.length
    });

    // Step 2: Get current library state for AI comparison
    const currentLibrary = await getCurrentLibrary(supabaseClient);
    console.log('📚 Current library size:', {
      skills: currentLibrary.skills.length,
      job_titles: currentLibrary.job_titles.length,
      locations: currentLibrary.locations.length
    });

    // Step 3: AI-driven clustering and suggestions
    const aiSuggestions = await generateAISuggestions(extracted, currentLibrary);
    console.log('🤖 AI suggestions generated:', aiSuggestions);

    // Step 4: Apply intelligent filtering and updates
    const enrichmentResults = await applyEnrichments(supabaseClient, aiSuggestions, extracted);
    console.log('✅ Enrichment applied:', enrichmentResults);

    // Step 5: Log the enrichment process
    const processingTime = Date.now() - startTime;
    await logEnrichment(supabaseClient, {
      searchId,
      extracted,
      aiSuggestions,
      enrichmentResults,
      candidates: candidates.length,
      processingTime
    });

    console.log(`🎯 Library enrichment completed in ${processingTime}ms`);

    return new Response(JSON.stringify({
      success: true,
      enrichmentResults,
      processingTime,
      candidatesAnalyzed: candidates.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Library enrichment error:', error);
    return new Response(
      JSON.stringify({ error: 'Enrichment failed', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function extractTermsFromCandidates(candidates: CandidateData[]): ExtractionResult {
  console.log('🔍 Extracting terms from candidates...');
  
  const skillsSet = new Set<string>();
  const jobTitlesSet = new Set<string>();
  const locationsSet = new Set<string>();

  candidates.forEach(candidate => {
    // Extract skills
    if (candidate.member_skills_collection) {
      candidate.member_skills_collection.forEach(skillObj => {
        if (skillObj.skill && skillObj.skill.trim()) {
          skillsSet.add(cleanTerm(skillObj.skill));
        }
      });
    }
    if (candidate.skills) {
      candidate.skills.forEach(skill => {
        if (skill && skill.trim()) {
          skillsSet.add(cleanTerm(skill));
        }
      });
    }

    // Extract job titles
    if (candidate.experience) {
      candidate.experience.forEach(exp => {
        if (exp.title && exp.title.trim()) {
          jobTitlesSet.add(cleanTerm(exp.title));
        }
      });
    }
    if (candidate.title && candidate.title.trim()) {
      jobTitlesSet.add(cleanTerm(candidate.title));
    }
    if (candidate.role_current && candidate.role_current.trim()) {
      jobTitlesSet.add(cleanTerm(candidate.role_current));
    }

    // Extract locations
    if (candidate.country && candidate.country.trim()) {
      locationsSet.add(cleanTerm(candidate.country));
    }
    if (candidate.location && candidate.location.trim()) {
      locationsSet.add(cleanTerm(candidate.location));
    }
    if (candidate.location_country && candidate.location_country.trim()) {
      locationsSet.add(cleanTerm(candidate.location_country));
    }
    if (candidate.location_city && candidate.location_city.trim()) {
      locationsSet.add(cleanTerm(candidate.location_city));
    }
  });

  return {
    skills: Array.from(skillsSet).filter(term => term.length > 1),
    job_titles: Array.from(jobTitlesSet).filter(term => term.length > 2),
    locations: Array.from(locationsSet).filter(term => term.length > 1)
  };
}

function cleanTerm(term: string): string {
  return term.trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

async function getCurrentLibrary(supabaseClient: any) {
  console.log('📚 Fetching current library state...');
  
  const [skillsRes, titlesRes, locationsRes] = await Promise.all([
    supabaseClient.from('standard_skills').select('canonical_name, synonyms'),
    supabaseClient.from('standard_job_titles').select('canonical_title, synonyms'),
    supabaseClient.from('standard_locations').select('canonical_name, synonyms')
  ]);

  return {
    skills: skillsRes.data || [],
    job_titles: titlesRes.data || [],
    locations: locationsRes.data || []
  };
}

async function generateAISuggestions(extracted: ExtractionResult, currentLibrary: any) {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    console.warn('⚠️ OpenAI API key not configured, skipping AI suggestions');
    return { skills: [], job_titles: [], locations: [] };
  }

  try {
    console.log('🤖 Generating AI suggestions for library enrichment...');
    
    const prompt = `Analyze extracted candidate terms and suggest library enrichments.

CURRENT LIBRARY SAMPLE:
Skills: ${currentLibrary.skills.slice(0, 10).map((s: any) => `"${s.canonical_name}" (synonyms: ${s.synonyms?.join(', ') || 'none'})`).join('; ')}
Job Titles: ${currentLibrary.job_titles.slice(0, 10).map((t: any) => `"${t.canonical_title}" (synonyms: ${t.synonyms?.join(', ') || 'none'})`).join('; ')}
Locations: ${currentLibrary.locations.slice(0, 10).map((l: any) => `"${l.canonical_name}" (synonyms: ${l.synonyms?.join(', ') || 'none'})`).join('; ')}

EXTRACTED TERMS:
Skills: ${extracted.skills.slice(0, 20).join(', ')}
Job Titles: ${extracted.job_titles.slice(0, 20).join(', ')}
Locations: ${extracted.locations.slice(0, 20).join(', ')}

RULES:
1. Only suggest if extracted term has 80%+ similarity to existing canonical term OR appears novel but valuable
2. Focus on meaningful business terms, avoid noise (typos, fragments)
3. Group variations under existing canonical terms when possible
4. Suggest new canonical terms only if truly distinct and professional

Return ONLY valid JSON:
{
  "skills": [
    {
      "action": "add_synonym|new_canonical",
      "canonical": "existing or new canonical name",
      "synonym": "extracted term to add as synonym",
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation"
    }
  ],
  "job_titles": [...same format...],
  "locations": [...same format...]
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
          { 
            role: 'system', 
            content: 'You are an expert data analyst specializing in skills taxonomies and job market terminology. Respond with valid JSON only.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    
    // Clean up response
    if (content.startsWith('```json')) {
      content = content.replace(/```json\n?/, '').replace(/\n?```$/, '');
    }
    
    const suggestions = JSON.parse(content);
    console.log('🤖 AI suggestions parsed successfully');
    return suggestions;

  } catch (error) {
    console.warn('⚠️ AI suggestions failed:', error.message);
    return { skills: [], job_titles: [], locations: [] };
  }
}

async function applyEnrichments(supabaseClient: any, aiSuggestions: any, extracted: ExtractionResult) {
  console.log('💾 Applying enrichments to library...');
  
  const results = {
    skills: { added: 0, synonyms_added: 0 },
    job_titles: { added: 0, synonyms_added: 0 },
    locations: { added: 0, synonyms_added: 0 },
    additions_made: [] as any[]
  };

  // Apply skills enrichments
  if (aiSuggestions.skills) {
    for (const suggestion of aiSuggestions.skills) {
      if (suggestion.confidence >= 0.8) {
        try {
          if (suggestion.action === 'add_synonym') {
            await addSynonymToLibrary(supabaseClient, 'skills', suggestion.canonical, suggestion.synonym);
            results.skills.synonyms_added++;
            results.additions_made.push({
              type: 'skill_synonym',
              canonical: suggestion.canonical,
              synonym: suggestion.synonym,
              confidence: suggestion.confidence
            });
          } else if (suggestion.action === 'new_canonical') {
            await addCanonicalToLibrary(supabaseClient, 'skills', suggestion.canonical, [suggestion.synonym]);
            results.skills.added++;
            results.additions_made.push({
              type: 'skill_canonical',
              canonical: suggestion.canonical,
              confidence: suggestion.confidence
            });
          }
        } catch (error) {
          console.warn(`Failed to apply skill suggestion:`, error.message);
        }
      }
    }
  }

  // Apply job titles enrichments
  if (aiSuggestions.job_titles) {
    for (const suggestion of aiSuggestions.job_titles) {
      if (suggestion.confidence >= 0.8) {
        try {
          if (suggestion.action === 'add_synonym') {
            await addSynonymToLibrary(supabaseClient, 'job_titles', suggestion.canonical, suggestion.synonym);
            results.job_titles.synonyms_added++;
            results.additions_made.push({
              type: 'title_synonym',
              canonical: suggestion.canonical,
              synonym: suggestion.synonym,
              confidence: suggestion.confidence
            });
          } else if (suggestion.action === 'new_canonical') {
            await addCanonicalToLibrary(supabaseClient, 'job_titles', suggestion.canonical, [suggestion.synonym]);
            results.job_titles.added++;
            results.additions_made.push({
              type: 'title_canonical',
              canonical: suggestion.canonical,
              confidence: suggestion.confidence
            });
          }
        } catch (error) {
          console.warn(`Failed to apply job title suggestion:`, error.message);
        }
      }
    }
  }

  // Apply locations enrichments
  if (aiSuggestions.locations) {
    for (const suggestion of aiSuggestions.locations) {
      if (suggestion.confidence >= 0.8) {
        try {
          if (suggestion.action === 'add_synonym') {
            await addSynonymToLibrary(supabaseClient, 'locations', suggestion.canonical, suggestion.synonym);
            results.locations.synonyms_added++;
            results.additions_made.push({
              type: 'location_synonym',
              canonical: suggestion.canonical,
              synonym: suggestion.synonym,
              confidence: suggestion.confidence
            });
          } else if (suggestion.action === 'new_canonical') {
            await addCanonicalToLibrary(supabaseClient, 'locations', suggestion.canonical, [suggestion.synonym]);
            results.locations.added++;
            results.additions_made.push({
              type: 'location_canonical',
              canonical: suggestion.canonical,
              confidence: suggestion.confidence
            });
          }
        } catch (error) {
          console.warn(`Failed to apply location suggestion:`, error.message);
        }
      }
    }
  }

  console.log('✅ Enrichments applied:', results);
  return results;
}

async function addSynonymToLibrary(supabaseClient: any, type: string, canonical: string, synonym: string) {
  const tables = {
    skills: 'standard_skills',
    job_titles: 'standard_job_titles', 
    locations: 'standard_locations'
  };
  
  const canonicalFields = {
    skills: 'canonical_name',
    job_titles: 'canonical_title',
    locations: 'canonical_name'
  };

  const table = tables[type as keyof typeof tables];
  const canonicalField = canonicalFields[type as keyof typeof canonicalFields];
  
  // First get current synonyms
  const { data: current } = await supabaseClient
    .from(table)
    .select('synonyms')
    .eq(canonicalField, canonical)
    .single();
    
  if (current) {
    const updatedSynonyms = [...(current.synonyms || []), synonym];
    await supabaseClient
      .from(table)
      .update({ 
        synonyms: updatedSynonyms,
        source: 'enriched',
        last_seen: new Date().toISOString()
      })
      .eq(canonicalField, canonical);
  }
}

async function addCanonicalToLibrary(supabaseClient: any, type: string, canonical: string, synonyms: string[]) {
  const insertData: any = {
    synonyms,
    source: 'enriched',
    confidence_score: 0.8,
    usage_count: 1
  };

  if (type === 'skills') {
    insertData.canonical_name = canonical;
    insertData.category = 'General';
    await supabaseClient.from('standard_skills').insert(insertData);
  } else if (type === 'job_titles') {
    insertData.canonical_title = canonical;
    insertData.category = 'General';
    await supabaseClient.from('standard_job_titles').insert(insertData);
  } else if (type === 'locations') {
    insertData.canonical_name = canonical;
    await supabaseClient.from('standard_locations').insert(insertData);
  }
}

async function logEnrichment(supabaseClient: any, logData: any) {
  try {
    await supabaseClient.from('library_enrichment_logs').insert({
      enrichment_type: 'combined',
      source_search_id: logData.searchId,
      extracted_terms: logData.extracted,
      ai_suggestions: logData.aiSuggestions,
      additions_made: logData.enrichmentResults.additions_made,
      candidates_analyzed: logData.candidates,
      terms_added: (logData.enrichmentResults.skills?.added || 0) + 
                   (logData.enrichmentResults.job_titles?.added || 0) + 
                   (logData.enrichmentResults.locations?.added || 0),
      synonyms_added: (logData.enrichmentResults.skills?.synonyms_added || 0) + 
                      (logData.enrichmentResults.job_titles?.synonyms_added || 0) + 
                      (logData.enrichmentResults.locations?.synonyms_added || 0),
      processing_time_ms: logData.processingTime
    });
  } catch (error) {
    console.warn('⚠️ Failed to log enrichment:', error.message);
  }
}