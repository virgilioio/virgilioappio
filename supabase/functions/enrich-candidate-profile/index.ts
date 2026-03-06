import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface EnrichRequest {
  candidateId: string;
  resumeText: string;
  candidateName?: string;
}

// ---------- OpenAI Tool-Calling Schema ----------

const EXTRACTION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'extract_candidate_profile',
    description: 'Extract structured candidate profile data from a resume. Return ALL fields you can infer.',
    parameters: {
      type: 'object',
      properties: {
        profile_summary: {
          type: 'string',
          description: 'Comprehensive professional profile in Spanish (200-300 words) with rich markdown formatting. Use **bold** for headings/key skills, *italic* for emphasis, bullet lists. Structure: opening statement, experience highlights, key competencies, notable achievements.'
        },
        current_job_title: { type: 'string', description: 'Most recent job title exactly as written on resume' },
        standardized_title: { type: 'string', description: 'Standardized English job title mapped to a common industry equivalent. Translate non-English titles, expand abbreviations. Examples: "Ingeniero de Calidad" → "Quality Engineer", "SDR" → "Sales Development Representative", "Gerente de Ventas" → "Sales Manager", "Jefe de Operaciones" → "Operations Manager"' },
        seniority_level: {
          type: 'string',
          enum: ['entry', 'junior', 'mid', 'senior', 'lead', 'director', 'vp', 'c_level'],
          description: 'Inferred seniority level based on titles and experience'
        },
        functional_area: { type: 'string', description: 'Primary functional area: Sales, Engineering, Marketing, Operations, Finance, HR, Product, Design, Legal, etc.' },
        specialization: { type: 'string', description: 'Specific specialization within functional area, e.g. "Frontend Development", "Enterprise Sales", "Content Marketing"' },
        total_years_experience: { type: 'number', description: 'Total years of professional experience' },
        years_in_specialization: { type: 'integer', description: 'Years in current specialization' },
        years_in_leadership: { type: 'integer', description: 'Years in management/leadership roles (Manager, Director, VP, C-level titles)' },
        work_experience: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              job_title: { type: 'string' },
              company_name: { type: 'string' },
              company_industry: { type: 'string', description: 'Industry of the company: Technology, Finance, Healthcare, Retail, etc.' },
              company_size_category: { type: 'string', enum: ['startup', 'smb', 'mid-market', 'enterprise'], description: 'Estimated company size category' },
              start_date: { type: 'string', description: 'ISO date YYYY-MM-DD or YYYY-MM-01 if only month/year' },
              end_date: { type: ['string', 'null'], description: 'ISO date or null if current' },
              is_current: { type: 'boolean' },
              location: { type: 'string' },
              description: { type: 'string', description: 'Key responsibilities and achievements' },
              skills_used: { type: 'array', items: { type: 'string' } },
              standardized_title: { type: 'string', description: 'Standardized English job title for this position. Translate non-English titles, expand abbreviations. E.g. "Coordinador de Producción" → "Production Coordinator"' }
            },
            required: ['job_title', 'company_name']
          }
        },
        education: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              institution_name: { type: 'string' },
              degree_type: { type: 'string', description: 'e.g. Bachelor of Science, MBA, Master of Arts' },
              field_of_study: { type: 'string' },
              education_level: { type: 'string', enum: ['high_school', 'associate', 'bachelors', 'masters', 'mba', 'phd', 'bootcamp', 'certification', 'diploma'] },
              start_date: { type: ['string', 'null'] },
              end_date: { type: ['string', 'null'] },
              grade: { type: ['string', 'null'] },
              description: { type: ['string', 'null'] }
            },
            required: ['institution_name']
          }
        },
        certifications: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              certification_name: { type: 'string' },
              issuing_organization: { type: 'string' },
              year_obtained: { type: ['integer', 'null'] },
              is_bootcamp: { type: 'boolean' }
            },
            required: ['certification_name']
          }
        },
        skills: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              category: { type: 'string', description: 'Category: Technical, Tool, Soft Skill, Domain, Language, Framework' },
              is_primary: { type: 'boolean', description: 'true if this is a core/primary skill for the candidate' }
            },
            required: ['name']
          }
        }
      },
      required: ['profile_summary', 'skills']
    }
  }
};

const SYSTEM_PROMPT = `You are an expert ATS resume parser. Extract ALL structured data from the resume.

For the profile_summary field: Write a comprehensive professional profile in Spanish (200-300 words) with rich markdown formatting.
Detailed Structure:
**Nombre Completo**
*Professional headline (short, separated by vertical bars)*
**Ubicación:** País, Estado, Ciudad (if available)
---
**RESUMEN PROFESIONAL** (150-200 words covering career overview, expertise, achievements, value propositions)
---
**EXPERIENCIA PROFESIONAL** (2-3 most recent/relevant positions with achievements)
---
**EDUCACIÓN** (Institution, Degree, Years)
---
**COMPETENCIAS CLAVE** (Technical, Domain, Soft skills)

For work_experience: Extract ALL positions. Infer company_industry and company_size_category when possible.
For skills: Extract 10-20 skills. Mark core skills as is_primary=true (max 5-7 primary).
For seniority_level: Infer from most recent title and years of experience.
For years_in_leadership: Count years where title contains Manager, Director, VP, Chief, Head, Lead.

Be thorough. Extract everything you can find.`;

// ---------- Standardization helpers ----------

async function standardizeTitle(supabase: any, title: string): Promise<string | null> {
  if (!title) return null;
  
  const { data: exact } = await supabase
    .from('standard_job_titles')
    .select('canonical_title')
    .eq('canonical_title', title)
    .single();
  if (exact) return exact.canonical_title;

  const { data: synonymMatch } = await supabase
    .from('standard_job_titles')
    .select('canonical_title')
    .contains('synonyms', [title.toLowerCase()]);
  if (synonymMatch?.length) return synonymMatch[0].canonical_title;

  const { data: partial } = await supabase
    .from('standard_job_titles')
    .select('canonical_title')
    .or(`canonical_title.ilike.%${title}%,synonyms.cs.{${title.toLowerCase()}}`);
  if (partial?.length) return partial[0].canonical_title;

  return null;
}

async function standardizeSkills(supabase: any, skills: string[]): Promise<string[]> {
  if (!skills.length) return [];
  
  const standardized: string[] = [];
  
  // Batch: try exact match for all
  const { data: exactMatches } = await supabase
    .from('standard_skills')
    .select('canonical_name')
    .in('canonical_name', skills);
  const exactSet = new Set((exactMatches || []).map((r: any) => r.canonical_name.toLowerCase()));
  
  // Batch: try synonym overlap
  const lowerSkills = skills.map(s => s.toLowerCase());
  const { data: synonymMatches } = await supabase
    .from('standard_skills')
    .select('canonical_name, synonyms')
    .overlaps('synonyms', lowerSkills);
  
  const synonymMap = new Map<string, string>();
  for (const row of (synonymMatches || [])) {
    for (const syn of (row.synonyms || [])) {
      synonymMap.set(syn.toLowerCase(), row.canonical_name);
    }
  }

  for (const skill of skills) {
    const lower = skill.toLowerCase();
    if (exactSet.has(lower)) {
      standardized.push(skill);
    } else if (synonymMap.has(lower)) {
      standardized.push(synonymMap.get(lower)!);
    } else {
      standardized.push(skill); // Keep original if no standard found
    }
  }
  
  return [...new Set(standardized)];
}

// ---------- Compute derived metrics ----------

function computeMetrics(workExperience: any[]): { companyCount: number; avgTenureMonths: number } {
  if (!workExperience?.length) return { companyCount: 0, avgTenureMonths: 0 };
  
  const companies = new Set(workExperience.map(w => w.company_name?.toLowerCase()).filter(Boolean));
  const durations = workExperience.map(w => w.duration_months).filter((d: number) => d > 0);
  const avgTenure = durations.length ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : 0;
  
  return { companyCount: companies.size, avgTenureMonths: avgTenure };
}

function calculateDurationMonths(startDate?: string | null, endDate?: string | null): number {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
}

// ---------- Main enrichment ----------

async function enrichCandidateProfile(candidateId: string, resumeText: string, candidateName?: string): Promise<void> {
  console.log(`[enrich] Starting enrichment for candidate ${candidateId}`);
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  await supabase.from('candidates').update({ enrichment_status: 'processing' }).eq('id', candidateId);

  try {
    if (!OPENAI_API_KEY) {
      console.log('[enrich] No OpenAI API key, skipping');
      await supabase.from('candidates').update({ enrichment_status: 'failed' }).eq('id', candidateId);
      return;
    }

    // 1. AI Extraction via tool calling
    const userPrompt = `Extract the full structured profile from this resume${candidateName ? ` for ${candidateName}` : ''}:\n\n${resumeText.slice(0, 14000)}`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'function', function: { name: 'extract_candidate_profile' } },
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[enrich] OpenAI error:', resp.status, errText);
      await supabase.from('candidates').update({ enrichment_status: 'failed' }).eq('id', candidateId);
      return;
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error('[enrich] No tool call returned');
      await supabase.from('candidates').update({ enrichment_status: 'failed' }).eq('id', candidateId);
      return;
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    console.log(`[enrich] Extracted: ${extracted.work_experience?.length || 0} jobs, ${extracted.education?.length || 0} edu, ${extracted.certifications?.length || 0} certs, ${extracted.skills?.length || 0} skills`);

    // 2. Standardize title
    const standardizedTitle = extracted.current_job_title 
      ? await standardizeTitle(supabase, extracted.current_job_title)
      : null;

    // 3. Standardize skills
    const rawSkillNames = (extracted.skills || []).map((s: any) => s.name).filter(Boolean);
    const standardizedSkills = await standardizeSkills(supabase, rawSkillNames);
    const primarySkills = (extracted.skills || []).filter((s: any) => s.is_primary).map((s: any) => s.name);

    // 4. Process work experience with durations
    const workExperience = (extracted.work_experience || []).map((w: any) => ({
      ...w,
      duration_months: calculateDurationMonths(w.start_date, w.end_date),
    }));

    // 5. Standardize work experience titles (batch)
    for (const w of workExperience) {
      w.standardized_title = await standardizeTitle(supabase, w.job_title);
    }

    // 6. Compute derived metrics
    const { companyCount, avgTenureMonths } = computeMetrics(workExperience);

    // 7. Update candidates table
    const candidateUpdate: Record<string, unknown> = {
      enrichment_status: 'complete',
      enriched_at: new Date().toISOString(),
      profile_summary: extracted.profile_summary,
      skills: rawSkillNames,
      standardized_skills: standardizedSkills,
      current_job_title: extracted.current_job_title || null,
      standardized_title: standardizedTitle,
      seniority_level: extracted.seniority_level || null,
      functional_area: extracted.functional_area || null,
      specialization: extracted.specialization || null,
      years_experience: extracted.total_years_experience || null,
      years_in_specialization: extracted.years_in_specialization || null,
      years_in_leadership: extracted.years_in_leadership || null,
      company_count: companyCount || null,
      avg_tenure_months: avgTenureMonths || null,
      role_current: extracted.current_job_title || null,
      company_current: workExperience.find((w: any) => w.is_current)?.company_name || null,
    };

    // Also store skills metadata (categories, primary flags)
    if (extracted.skills?.length) {
      candidateUpdate.skills_metadata = extracted.skills;
    }

    const { error: updateError } = await supabase
      .from('candidates')
      .update(candidateUpdate)
      .eq('id', candidateId);

    if (updateError) {
      console.error('[enrich] Failed to update candidate:', updateError);
      await supabase.from('candidates').update({ enrichment_status: 'failed' }).eq('id', candidateId);
      return;
    }

    // 8. Upsert work experience (delete old, insert new)
    if (workExperience.length > 0) {
      await supabase.from('candidate_work_experience').delete().eq('candidate_id', candidateId);
      
      const expRows = workExperience.map((w: any) => ({
        candidate_id: candidateId,
        job_title: w.job_title,
        company_name: w.company_name,
        company_industry: w.company_industry || null,
        company_size_category: w.company_size_category || null,
        start_date: w.start_date || null,
        end_date: w.end_date || null,
        is_current: w.is_current || false,
        location: w.location || null,
        description: w.description || null,
        skills_used: w.skills_used || null,
        standardized_title: w.standardized_title || null,
        duration_months: w.duration_months || null,
      }));

      const { error: expError } = await supabase.from('candidate_work_experience').insert(expRows);
      if (expError) console.error('[enrich] Work experience insert error:', expError);
    }

    // 9. Upsert education
    if (extracted.education?.length) {
      await supabase.from('candidate_education').delete().eq('candidate_id', candidateId);
      
      const eduRows = (extracted.education as any[]).map((e: any) => ({
        candidate_id: candidateId,
        institution_name: e.institution_name,
        degree_type: e.degree_type || null,
        field_of_study: e.field_of_study || null,
        education_level: e.education_level || null,
        start_date: e.start_date || null,
        end_date: e.end_date || null,
        grade: e.grade || null,
        description: e.description || null,
      }));

      const { error: eduError } = await supabase.from('candidate_education').insert(eduRows);
      if (eduError) console.error('[enrich] Education insert error:', eduError);
    }

    // 10. Upsert certifications
    if (extracted.certifications?.length) {
      await supabase.from('candidate_certifications').delete().eq('candidate_id', candidateId);
      
      const certRows = (extracted.certifications as any[]).map((c: any) => ({
        candidate_id: candidateId,
        certification_name: c.certification_name,
        issuing_organization: c.issuing_organization || null,
        year_obtained: c.year_obtained || null,
        is_bootcamp: c.is_bootcamp || false,
      }));

      const { error: certError } = await supabase.from('candidate_certifications').insert(certRows);
      if (certError) console.error('[enrich] Certifications insert error:', certError);
    }

    console.log(`[enrich] Successfully enriched candidate ${candidateId}`);
  } catch (err) {
    console.error(`[enrich] Error:`, err);
    await supabase.from('candidates').update({ enrichment_status: 'failed' }).eq('id', candidateId);
  }
}

// ---------- HTTP Handler ----------

serve(async (req) => {
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const corsHeaders = corsHeadersFor(origin);

  const preflightResponse = handlePreflight(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as EnrichRequest;

    if (!body.candidateId || !body.resumeText) {
      return new Response(JSON.stringify({ error: 'candidateId and resumeText are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[enrich] Received request for candidate ${body.candidateId}`);

    const response = new Response(JSON.stringify({ 
      queued: true, 
      candidateId: body.candidateId 
    }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(enrichCandidateProfile(body.candidateId, body.resumeText, body.candidateName));
    } else {
      enrichCandidateProfile(body.candidateId, body.resumeText, body.candidateName).catch(console.error);
    }

    return response;
  } catch (err) {
    console.error('[enrich] Error:', err);
    return new Response(JSON.stringify({ error: 'Failed to queue enrichment' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
