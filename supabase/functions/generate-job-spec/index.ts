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
            content: `You are a senior hiring strategist for an international recruiting platform that works globally in multiple languages.

A client has described their hiring need. Your task is to analyze the text and return a fully structured response that Virgilio's system can use to create a job automatically.

IMPORTANT LANGUAGE INSTRUCTIONS:
- Detect the language of the user's input
- Respond in the SAME language as the user's input
- If the input is in Spanish, respond in Spanish
- If the input is in Portuguese, respond in Portuguese  
- If the input is in French, respond in French
- If the input is in English, respond in English
- For any other language, respond in English as fallback

You MUST:
- Understand the context of the role in the user's language
- Infer the job title, department, and level appropriate to their region/language
- Parse the job description from the user's language and respond in the same language
- Extract skills and keywords that describe the core competencies required
- Detect any mention of **city, country, or region** to infer the correct **currency** (e.g., USD, MXN, EUR, BRL, etc.)
- Estimate a reasonable salary range (min and max) based on the described role and region
- If salary or location are not mentioned, use conservative defaults based on detected language/region
- Use appropriate job levels: "L1" (Entry/Junior), "L2" (Mid/Senior), "L3" (Lead/Executive)

Return ONLY valid JSON in this format (with content in the same language as the input):

{
  "job_title": "Primary suggested job title in user's language",
  "alt_titles": ["Alternative title 1", "Alternative title 2"],
  "job_description": "Comprehensive job description in user's language",
  "level": "L1 | L2 | L3",
  "department": "Department name in user's language",
  "location": "City, Country (if inferred or provided)",
  "salary_range": {
    "min": integer,
    "max": integer,
    "currency": "USD|MXN|EUR|BRL|etc"
  },
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "recommendations": [
    "Insight about role commonness in user's language",
    "Hiring difficulty assessment in user's language", 
    "Market compensation note in user's language",
    "Time-to-hire implication in user's language"
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