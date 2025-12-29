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
  department?: string;
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
    if (input.company_hint) {
      contextParts.push(`Company Reference: ${input.company_hint}`);
    }
    if (input.department) {
      contextParts.push(`Department: ${input.department}`);
    }

    const researchPrompt = `You are a recruiting research assistant specializing in talent sourcing. Given a job specification, research and provide enriched search criteria.

Context:
${contextParts.join('\n')}

Provide the following research outputs:

1. **Alternative Titles** (5-8 variations): Common variations of this job title that candidates might use on their profiles. Include both more senior and junior variations, as well as industry-specific variants.

2. **Target Companies** (10-20 companies): Real companies that would employ this role based on the industry/location context. Focus on:
   - Companies known for this type of role
   - Companies in the relevant industry/sector
   - Companies in or near the specified location (if provided)
   - Mix of large enterprises and notable startups/scale-ups

3. **Industry Classifications** (3-5 industries): Relevant industry tags that encompass companies hiring for this role.

4. **Search Keywords** (5-10 keywords): Terms that would commonly appear in ideal candidates' profiles, resumes, or LinkedIn headlines. Include:
   - Technical terms specific to the role
   - Industry jargon
   - Common achievements or metrics
   - Tools and methodologies

5. **Research Reasoning**: A brief 2-3 sentence explanation of your research logic, explaining why you selected these companies and how the enrichments will improve candidate discovery.

IMPORTANT GUIDELINES:
- Provide REAL, currently operating company names (not fictional)
- Consider the geographic context when suggesting companies
- Focus on companies actively hiring or known to employ this type of role
- Keywords should help find passive candidates, not just active job seekers
- Title variations should include what candidates actually put on their profiles`;

    console.log('🤖 Calling OpenAI for research...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a recruiting research expert. Always respond with valid JSON matching the requested schema.' },
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
                    description: 'Alternative job titles (5-8 variations)'
                  },
                  researched_companies: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Real company names to target (10-20 companies)'
                  },
                  researched_industries: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Industry classifications (3-5 industries)'
                  },
                  researched_keywords: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Search keywords for profiles (5-10 keywords)'
                  },
                  research_reasoning: {
                    type: 'string',
                    description: 'Brief explanation of research logic (2-3 sentences)'
                  }
                },
                required: ['researched_titles', 'researched_companies', 'researched_industries', 'researched_keywords', 'research_reasoning'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'provide_research_results' } },
        temperature: 0.7
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

    const researchResult: ResearchOutput = JSON.parse(toolCall.function.arguments);

    console.log('✅ Research complete:', {
      titles: researchResult.researched_titles.length,
      companies: researchResult.researched_companies.length,
      industries: researchResult.researched_industries.length,
      keywords: researchResult.researched_keywords.length
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
