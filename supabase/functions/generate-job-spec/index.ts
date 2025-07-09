import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    console.log('Generating job spec for prompt:', prompt);

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
            content: `You are a senior hiring strategist for an international recruiting platform.

A client has described their hiring need as follows:
"{{user_prompt}}"

Your task is to analyze the text and return a fully structured response that Virgilio's system can use to create a job automatically.  

You MUST:
- Understand the context of the role
- Infer the job title, department, and level
- Parse the job description from the user's language
- Extract skills and keywords that describe the core competencies required
- Detect any mention of **city, country, or region** to infer the correct **currency** (e.g., USD, MXN, EUR)
- Estimate a reasonable salary range (min and max) based on the described role and region
- If salary or location are not mentioned, use conservative defaults

Return ONLY valid JSON in this format:

{
  "job_title": "Primary suggested job title",
  "alt_titles": ["Alternative title 1", "Alternative title 2"],
  "job_description": "Comprehensive job description based on the input",
  "level": "L1 | L2 | L3",
  "department": "e.g. Sales, Engineering, Marketing",
  "location": "City, Country (if inferred or provided)",
  "salary_range": {
    "min": integer,
    "max": integer,
    "currency": "USD"
  },
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "recommendations": [
    "Insight about role commonness",
    "Hiring difficulty assessment",
    "Market compensation note",
    "Time-to-hire implication"
  ]
}`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    console.log('OpenAI response:', generatedContent);

    // Parse the JSON response from OpenAI
    let jobSpec;
    try {
      jobSpec = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      throw new Error('Invalid response format from AI');
    }

    return new Response(JSON.stringify({ jobSpec }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-job-spec function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to generate job specification'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});