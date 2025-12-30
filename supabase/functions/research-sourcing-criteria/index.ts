import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/mod.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface ResearchInput {
  job_title: string;
  industry_hint?: string;
  location?: string;
  skills?: string[];
  company_hint?: string;
  user_companies?: string[];  // User-mentioned companies (hard constraint)
  department?: string;
  detected_language?: string; // Language detected from user prompt
}

interface ResearchOutput {
  researched_titles: string[];
  researched_companies: string[];
  researched_industries: string[];
  researched_keywords: string[];
  research_reasoning: string;
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const input: ResearchInput = await req.json();
    
    console.log('🔍 Research input:', JSON.stringify(input, null, 2));

    if (!input.job_title) {
      return new Response(
        JSON.stringify({ error: 'job_title is required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already specified companies - if so, don't suggest more
    const userSpecifiedCompanies = (input.user_companies && input.user_companies.length > 0) || 
                                    (input.company_hint && input.company_hint.length > 0);

    // Build context for the AI
    const contextParts: string[] = [];
    contextParts.push(`Job Title: ${input.job_title}`);
    
    if (input.industry_hint) {
      contextParts.push(`Industry Context: ${input.industry_hint}`);
    }
    if (input.location) {
      contextParts.push(`Location: ${input.location}`);
    }
    if (input.skills && input.skills.length > 0) {
      contextParts.push(`Required Skills: ${input.skills.join(', ')}`);
    }
    if (input.user_companies && input.user_companies.length > 0) {
      contextParts.push(`User-Specified Target Companies: ${input.user_companies.join(', ')}`);
    } else if (input.company_hint) {
      contextParts.push(`Company Reference: ${input.company_hint}`);
    }
    if (input.department) {
      contextParts.push(`Department: ${input.department}`);
    }

    // Language instruction for research outputs
    const languageInstruction = input.detected_language && input.detected_language !== 'English'
      ? `\n\n🌐 LANGUAGE REQUIREMENT: The user's prompt is in ${input.detected_language}. Generate all alternative titles and keywords in ${input.detected_language} to match how candidates in that language market describe themselves.`
      : '';

    // Updated prompt with reduced caps
    const researchPrompt = `You are a recruiting research assistant specializing in talent sourcing. Given a job specification, research and provide enriched search criteria.

Context:
${contextParts.join('\n')}${languageInstruction}

Provide the following research outputs with STRICT LIMITS:

1. **Alternative Titles** (2-3 max): ONLY the most commonly used direct synonyms for this job title. Do NOT include seniority variations or niche variations. Focus on titles candidates actually use on their profiles.${input.detected_language && input.detected_language !== 'English' ? ` Generate titles in ${input.detected_language}.` : ''}

2. **Target Companies** (0-3 max): ${userSpecifiedCompanies ? 
  'The user has already specified target companies. Return an EMPTY array [] since we should focus on their specified companies.' : 
  'Suggest 0-3 highly relevant companies ONLY if they are directly known for this specific role type. If unsure, return an empty array. Quality over quantity - fewer is better.'}

3. **Industry Classifications**: Return an EMPTY array []. Industry filtering is handled separately and causes over-filtering.

4. **Search Keywords** (3-5 max): High-signal terms that would appear in ideal candidates' profiles. Focus on:
   - Specific tools, technologies, or methodologies
   - Key achievements or metrics (e.g., "quota attainment", "revenue growth")
   - Industry-specific terminology${input.detected_language && input.detected_language !== 'English' ? `\n   Generate keywords in ${input.detected_language} where appropriate.` : ''}
   Do NOT include generic terms.

5. **Research Reasoning**: A brief 1-2 sentence explanation of your research logic.

CRITICAL CONSTRAINTS:
- FEWER IS BETTER - over-filtering returns zero results
- Only suggest what you're highly confident about
- Alternative titles must be what candidates ACTUALLY use, not theoretical variations
- If user specified companies, return empty array for researched_companies
- Industries must always be empty array
- Keywords should be specific and actionable`;

    console.log('🤖 Calling OpenAI for research with reduced caps...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a recruiting research expert. Always respond with valid JSON matching the requested schema. Prioritize precision over recall - fewer, higher-quality suggestions are better than many low-quality ones.' },
          { role: 'user', content: researchPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'provide_research_results',
              description: 'Provide the research results for enriching sourcing search criteria',
              parameters: {
                type: 'object',
                properties: {
                  researched_titles: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Alternative job titles (2-3 max, only most common synonyms)',
                    maxItems: 3
                  },
                  researched_companies: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Target company names (0-3 max, only if user did not specify companies)',
                    maxItems: 3
                  },
                  researched_industries: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Industry classifications - ALWAYS return empty array []',
                    maxItems: 0
                  },
                  researched_keywords: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Search keywords for profiles (3-5 max, high-signal terms only)',
                    maxItems: 5
                  },
                  research_reasoning: {
                    type: 'string',
                    description: 'Brief explanation of research logic (1-2 sentences)'
                  }
                },
                required: ['researched_titles', 'researched_companies', 'researched_industries', 'researched_keywords', 'research_reasoning'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'provide_research_results' } },
        temperature: 0.5  // Lower temperature for more consistent, focused results
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'provide_research_results') {
      console.error('❌ Unexpected response format:', JSON.stringify(data, null, 2));
      throw new Error('Unexpected response format from OpenAI');
    }

    let researchResult: ResearchOutput = JSON.parse(toolCall.function.arguments);

    // ENFORCE CAPS even if LLM ignores them
    researchResult.researched_titles = (researchResult.researched_titles || []).slice(0, 3);
    researchResult.researched_companies = userSpecifiedCompanies ? [] : (researchResult.researched_companies || []).slice(0, 3);
    researchResult.researched_industries = []; // Always empty
    researchResult.researched_keywords = (researchResult.researched_keywords || []).slice(0, 5);

    console.log('✅ Research complete (with caps enforced):', {
      titles: researchResult.researched_titles.length,
      companies: researchResult.researched_companies.length,
      industries: researchResult.researched_industries.length,
      keywords: researchResult.researched_keywords.length,
      userSpecifiedCompanies
    });

    return new Response(JSON.stringify(researchResult), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in research-sourcing-criteria:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        // Return empty results on error to allow graceful degradation
        researched_titles: [],
        researched_companies: [],
        researched_industries: [],
        researched_keywords: [],
        research_reasoning: 'Research unavailable'
      }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
