import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../../utils/createSecureEdgeFunction.ts";

const corsHeaders = createSecureCorsHeaders();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface SkillExtractionRequest {
  candidateId?: string;
  batchSize?: number;
  dryRun?: boolean;
}

interface SkillExtractionResult {
  processedCount: number;
  updatedCount: number;
  errors: string[];
  candidates: Array<{
    id: string;
    name: string;
    extractedSkills: string[];
    previousSkills: string[] | null;
    standardizedSkills?: string[];
  }>;
}

type Category = 'technical' | 'tools' | 'industries' | 'titles' | 'soft' | 'certifications';

interface ExtractedSkill {
  name: string;        // localized
  canonical?: string;  // English canonical
  category: Category;
  confidence: number;
}

async function extractSkillsFromProfile(profileSummary: string, candidateName: string): Promise<ExtractedSkill[]> {
  if (!openAIApiKey) {
    console.error('OpenAI API key not configured');
    return [];
  }

  try {
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
            content: `You are a professional, multilingual skill extraction assistant.
Detect the input language automatically and extract relevant professional skills and industries.

Return ONLY a JSON array of objects, e.g.:
[
  { "name": "Ventas B2B", "canonical": "B2B Sales", "category": "technical", "confidence": 0.95 },
  { "name": "CRM (Salesforce)", "canonical": "Salesforce", "category": "tools", "confidence": 0.9 },
  { "name": "SaaS", "canonical": "SaaS", "category": "industries", "confidence": 0.85 }
]

Rules:
- "name" must be the localized label; "canonical" must be English.
- Include "industries" inline with other skills.
- Include only high-confidence items (0.5-1.0).
- Keep the list focused and marketable, up to 15 items.`
          },
          {
            role: 'user',
            content: `Extract skills from this candidate profile for ${candidateName}:\n\n${profileSummary}`
          }
        ],
        temperature: 0.1,
        max_tokens: 700
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const extractedText = (data.choices?.[0]?.message?.content || '').trim();

    try {
      let parsed: any;
      try {
        parsed = JSON.parse(extractedText);
      } catch {
        const jsonMatch = extractedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[1]);
      }
      if (!Array.isArray(parsed)) return [];

      const items: ExtractedSkill[] = parsed
        .filter((s: any) => s && s.name && s.category && typeof s.confidence === 'number')
        .map((s: any) => ({
          name: String(s.name).trim(),
          canonical: s.canonical ? String(s.canonical).trim() : undefined,
          category: s.category as Category,
          confidence: Number(s.confidence),
        }));

      return items.slice(0, 15);
    } catch (parseError) {
      console.error('Failed to parse skills JSON:', extractedText);
      return [];
    }
  } catch (error) {
    console.error('Error extracting skills with AI:', error);
    return [];
  }
}

function uniquePreserveOrder(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of arr) {
    const k = a.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(a.trim());
  }
  return out;
}

async function canonicalizeWithStandardSkills(namesLocalized: string[], namesCanonical: string[]) {
  // Try to map using standard_skills by canonical_name and synonyms overlap
  const allLower = Array.from(new Set([...namesLocalized, ...namesCanonical].map(s => s.toLowerCase())));
  const canonicalCandidates = uniquePreserveOrder(namesCanonical);

  const results = new Map<string, string>(); // key: lower input -> canonical_name

  // 1) match by canonical_name
  if (canonicalCandidates.length > 0) {
    const { data: rows1, error: e1 } = await supabase
      .from('standard_skills')
      .select('canonical_name')
      .in('canonical_name', canonicalCandidates);
    if (!e1 && rows1) {
      for (const r of rows1 as { canonical_name: string }[]) {
        const key = r.canonical_name.toLowerCase();
        results.set(key, r.canonical_name);
      }
    }
  }

  // 2) match by synonyms overlap
  if (allLower.length > 0) {
    const { data: rows2, error: e2 } = await supabase
      .from('standard_skills')
      .select('canonical_name,synonyms')
      .overlaps('synonyms', allLower);
    if (!e2 && rows2) {
      for (const r of rows2 as { canonical_name: string; synonyms: string[] }[]) {
        if (Array.isArray(r.synonyms)) {
          for (const syn of r.synonyms) {
            results.set(String(syn).toLowerCase(), r.canonical_name);
          }
        }
        results.set(String(r.canonical_name).toLowerCase(), r.canonical_name);
      }
    }
  }

  // Build final canonical set, favoring mapped canonical_name, else fallback to provided canonical/name
  const outSet = new Set<string>();
  for (const c of canonicalCandidates) {
    const key = c.toLowerCase();
    outSet.add(results.get(key) || c);
  }
  for (const l of namesLocalized) {
    const key = l.toLowerCase();
    outSet.add(results.get(key) || l);
  }

  return Array.from(outSet);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidateId, batchSize = 10, dryRun = false }: SkillExtractionRequest = await req.json();

    console.log(`🔍 Starting skill extraction - Candidate: ${candidateId || 'ALL'}, Batch: ${batchSize}, DryRun: ${dryRun}`);

    // Fetch candidates without skills (keep same filter logic)
    let query = supabase
      .from('candidates')
      .select('id, candidate_name, profile_summary, skills, standardized_skills, skills_metadata')
      .or('skills.is.null,skills.eq.{}');

    if (candidateId) {
      query = query.eq('id', candidateId);
    } else {
      query = query.limit(batchSize);
    }

    const { data: candidates, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({
        processedCount: 0,
        updatedCount: 0,
        errors: [],
        candidates: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📊 Found ${candidates.length} candidates to process`);

    const result: SkillExtractionResult = {
      processedCount: 0,
      updatedCount: 0,
      errors: [],
      candidates: []
    };

    for (const candidate of candidates as any[]) {
      result.processedCount++;

      try {
        console.log(`\n🧑‍💼 Processing: ${candidate.candidate_name}`);

        let extracted: ExtractedSkill[] = [];

        if (openAIApiKey && candidate.profile_summary) {
          extracted = await extractSkillsFromProfile(candidate.profile_summary, candidate.candidate_name);
        }

        // Fallback keyword extraction (preserve existing behavior) if AI fails
        if (extracted.length === 0 && candidate.profile_summary) {
          const skillKeywords = [
            'sales development representative', 'sdr', 'business development', 'bdr',
            'sales', 'marketing', 'management', 'engineer', 'developer', 'designer', 'analyst',
            'javascript', 'python', 'react', 'node', 'sql', 'aws', 'google', 'microsoft',
            'crm', 'salesforce', 'hubspot', 'excel', 'powerbi', 'tableau', 'jira',
            'recruiting', 'hr', 'human resources', 'onboarding', 'training', 'payroll',
            'customer service', 'support', 'account management', 'cold calling',
            'project management', 'agile', 'scrum', 'digital marketing', 'seo', 'sem',
            'accounting', 'finance', 'operations', 'logistics', 'supply chain',
            'lead generation', 'prospecting', 'outbound', 'inbound', 'qualification'
          ];
          const cleanSummary = String(candidate.profile_summary || '').toLowerCase().replace(/<[^>]*>/g, ' ').replace(/[^\w\s]/g, ' ');
          const extractedSkills: string[] = [];
          for (const keyword of skillKeywords) {
            if (cleanSummary.includes(keyword)) {
              extractedSkills.push(keyword);
            }
          }
          const uniq = Array.from(new Set(extractedSkills));
          extracted = uniq.map((s) => ({ name: s, canonical: s, category: 'technical', confidence: 0.6 }));
        }

        if (extracted.length === 0) {
          console.log(`⚠️ No skills extracted for ${candidate.candidate_name}`);
          continue;
        }

        const localized = uniquePreserveOrder(extracted.map(s => s.name));
        const aiCanonical = uniquePreserveOrder(extracted.map(s => s.canonical || s.name));

        // Canonicalize via standard_skills mapping
        const standardized = await canonicalizeWithStandardSkills(localized, aiCanonical);

        console.log(`✅ Extracted ${localized.length} skills; standardized to ${standardized.length}`);

        result.candidates.push({
          id: candidate.id,
          name: candidate.candidate_name,
          extractedSkills: localized,
          previousSkills: candidate.skills,
          standardizedSkills: standardized
        });

        if (!dryRun) {
          const nowIso = new Date().toISOString();
          const { error: updateError } = await supabase
            .from('candidates')
            .update({
              skills: localized,
              standardized_skills: standardized,
              skills_metadata: extracted,
              auto_generated_skills: extracted,
              last_skills_generation: nowIso,
              updated_at: nowIso
            })
            .eq('id', candidate.id);

          if (updateError) {
            const errorMsg = `Failed to update candidate ${candidate.candidate_name}: ${updateError.message}`;
            console.error(errorMsg);
            result.errors.push(errorMsg);
          } else {
            result.updatedCount++;
            console.log(`💾 Updated ${candidate.candidate_name} (skills + standardized_skills)`);
          }
        } else {
          console.log(`🔍 [DRY RUN] Would update ${candidate.candidate_name} with ${localized.length} skills and ${standardized.length} standardized`);
        }

      } catch (error: any) {
        const errorMsg = `Error processing candidate ${candidate.candidate_name}: ${error.message}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    console.log(`\n📈 Skill extraction complete:
- Processed: ${result.processedCount}
- Updated: ${result.updatedCount}
- Errors: ${result.errors.length}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Error in extract-candidate-skills function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      processedCount: 0,
      updatedCount: 0,
      errors: [error.message],
      candidates: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
