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

interface EnrichResult {
  profileSummary?: string;
  skills?: string[];
}

async function generateProfileSummary(resumeText: string, candidateName?: string): Promise<string | undefined> {
  if (!OPENAI_API_KEY) {
    console.log('No OpenAI API key, skipping profile summary generation');
    return undefined;
  }

  const system = `You are an expert ATS resume parser.
Return ONLY a comprehensive, detailed professional profile in Spanish (aim for 200-300 words).
Use rich markdown formatting: **bold** for headings/key skills, *italic* for emphasis, bullet lists for achievements.
Structure with clear sections: opening statement, experience highlights, key competencies, notable achievements.
Include quantifiable achievements where possible and unique value propositions.

Detailed Structure (200-300 words):
**Nombre Completo**

*Professional headline with key expertise areas (short, separated by vertical bars)*

**Ubicación:** País, Estado, Ciudad (if available)

---

**RESUMEN PROFESIONAL**
Comprehensive 2-3 paragraph summary covering:
- Career overview with years of experience
- Core areas of expertise and specializations
- Notable achievements with quantifiable impact
- Unique value propositions and strengths
Aim for depth and detail (150-200 words for this section).

---

**EXPERIENCIA PROFESIONAL**
Most recent/relevant positions (2-3):
**Company Name** — *Position Title* | Dates
- Key achievement with quantifiable results
- Major responsibility or project
- Impact or contribution to organization

---

**EDUCACIÓN**
Institution, Degree/Certification, Years
Include relevant certifications

---

**COMPETENCIAS CLAVE**
- Technical skills
- Domain expertise
- Soft skills
- Specialized knowledge areas

Style: Use **bold** for section titles and key roles, *italics* for emphasis, keep professional but detailed.
Do not include extra commentary. Only the formatted profile in Spanish with markdown.`;

  const user = `Generate a comprehensive professional profile in Spanish (200-300 words) with rich markdown formatting for this candidate${candidateName ? ` named ${candidateName}` : ''}:\n\n${resumeText.slice(0, 12000)}`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!resp.ok) {
      console.error('OpenAI error for profile summary:', resp.status, await resp.text());
      return undefined;
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim();
  } catch (err) {
    console.error('Error generating profile summary:', err);
    return undefined;
  }
}

async function generateSkills(resumeText: string, candidateName?: string): Promise<string[]> {
  if (!OPENAI_API_KEY) {
    console.log('No OpenAI API key, skipping skills generation');
    return [];
  }

  const system = `You are an expert at extracting skills from resumes.
Extract 10-15 relevant professional skills from the resume.
Return ONLY a JSON array of skill strings, nothing else.
Example: ["JavaScript", "React", "Project Management", "Team Leadership"]
Focus on:
- Technical skills and technologies
- Tools and platforms
- Soft skills and competencies
- Domain expertise`;

  const user = `Extract skills from this resume${candidateName ? ` for ${candidateName}` : ''}:\n\n${resumeText.slice(0, 8000)}`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!resp.ok) {
      console.error('OpenAI error for skills:', resp.status, await resp.text());
      return [];
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '[]';

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.filter((s: unknown) => typeof s === 'string' && s.trim()).map((s: string) => s.trim());
      }
    } catch {
      // Try to extract from markdown code block
      const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed)) {
            return parsed.filter((s: unknown) => typeof s === 'string' && s.trim()).map((s: string) => s.trim());
          }
        } catch {}
      }
    }

    return [];
  } catch (err) {
    console.error('Error generating skills:', err);
    return [];
  }
}

async function enrichCandidateProfile(candidateId: string, resumeText: string, candidateName?: string): Promise<EnrichResult> {
  console.log(`[enrich-candidate-profile] Starting enrichment for candidate ${candidateId}`);
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Update status to processing
  await supabase
    .from('candidates')
    .update({ enrichment_status: 'processing' })
    .eq('id', candidateId);

  try {
    // Run profile summary and skills generation in parallel
    const [profileSummary, skills] = await Promise.all([
      generateProfileSummary(resumeText, candidateName),
      generateSkills(resumeText, candidateName),
    ]);

    console.log(`[enrich-candidate-profile] Generated profile: ${profileSummary ? 'yes' : 'no'}, skills: ${skills.length}`);

    // Build update object only with non-empty values
    const update: Record<string, unknown> = {
      enrichment_status: 'complete',
      enriched_at: new Date().toISOString(),
    };

    if (profileSummary) {
      update.profile_summary = profileSummary;
    }

    if (skills.length > 0) {
      update.skills = skills;
    }

    // Update candidate record
    const { error: updateError } = await supabase
      .from('candidates')
      .update(update)
      .eq('id', candidateId);

    if (updateError) {
      console.error(`[enrich-candidate-profile] Failed to update candidate:`, updateError);
      // Mark as failed
      await supabase
        .from('candidates')
        .update({ enrichment_status: 'failed' })
        .eq('id', candidateId);
    } else {
      console.log(`[enrich-candidate-profile] Successfully enriched candidate ${candidateId}`);
    }

    return { profileSummary, skills };
  } catch (err) {
    console.error(`[enrich-candidate-profile] Error:`, err);
    
    // Mark as failed
    await supabase
      .from('candidates')
      .update({ enrichment_status: 'failed' })
      .eq('id', candidateId);

    return {};
  }
}

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

    console.log(`[enrich-candidate-profile] Received request for candidate ${body.candidateId}`);

    // Return immediately with 202 Accepted
    const response = new Response(JSON.stringify({ 
      queued: true, 
      candidateId: body.candidateId 
    }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    // Process enrichment in background using waitUntil
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(enrichCandidateProfile(body.candidateId, body.resumeText, body.candidateName));
    } else {
      // Fallback for environments without waitUntil - run async without awaiting
      enrichCandidateProfile(body.candidateId, body.resumeText, body.candidateName).catch(console.error);
    }

    return response;
  } catch (err) {
    console.error('[enrich-candidate-profile] Error:', err);
    return new Response(JSON.stringify({ error: 'Failed to queue enrichment' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
