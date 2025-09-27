import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    console.log('Generating job spec for prompt:', prompt);

    // First, get market salary data to enhance AI recommendations
    let marketSalaryData = null;
    let salaryInsights = '';
    
    // Try to extract job title and location from prompt for salary research
    const jobTitleMatch = prompt.match(/(?:need|hire|looking for|want)\s+(?:a\s+)?([^,.!?]+?)(?:\s+(?:in|at|for|based))/i);
    const locationMatch = prompt.match(/(?:in|at|based in|located in)\s+([^,.!?]+?)(?:\.|,|!|\?|$)/i);
    
    if (jobTitleMatch && locationMatch) {
      const inferredJobTitle = jobTitleMatch[1].trim();
      const inferredLocation = locationMatch[1].trim();
      
      console.log(`🔍 Researching salary for: ${inferredJobTitle} in ${inferredLocation}`);
      
      try {
        // CoreSignal salary research removed
        const salaryResponse: any = null;
        const salaryError = 'CoreSignal integration removed';

        if (!salaryError && salaryResponse?.salaryData) {
          marketSalaryData = salaryResponse.salaryData;
          const currency = marketSalaryData.currency;
          const median = marketSalaryData.salary_median;
          const min = marketSalaryData.percentile_25;
          const max = marketSalaryData.percentile_75;
          
          salaryInsights = `

MARKET SALARY INTELLIGENCE:
- Role: ${inferredJobTitle} in ${inferredLocation}
- Market Median: ${currency} ${median?.toLocaleString()} 
- Market Range: ${currency} ${min?.toLocaleString()} - ${currency} ${max?.toLocaleString()}
- Market Competitiveness: ${marketSalaryData.market_competitiveness}
- Sample Size: ${marketSalaryData.sample_size} jobs analyzed
- Data Source: ${salaryResponse.source}

Use this market data to provide SPECIFIC salary recommendations instead of generic ranges. Compare any suggested salary range against this market data and provide insights about market positioning.`;
          
          console.log('✅ Market salary data obtained:', marketSalaryData);
        } else {
          console.log('❌ No market salary data available:', salaryError);
        }
      } catch (salaryError) {
        console.error('Error getting salary data:', salaryError);
      }
    }

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
            content: `You are a senior hiring strategist for an international recruiting platform with expertise in role interpretation, skill standardization, and GEOGRAPHICAL INTELLIGENCE.

A client has described their hiring need. Your task is to analyze this input and return a structured response that Virgilio's system can use to generate a high-quality job record.

CRITICAL GEOGRAPHICAL INTELLIGENCE:
🌍 REGIONAL MAPPING & INFERENCE:
- LATAM/Latin America: Mexico, Guatemala, Belize, El Salvador, Honduras, Nicaragua, Costa Rica, Panama, Colombia, Venezuela, Guyana, Suriname, French Guiana, Brazil, Ecuador, Peru, Bolivia, Paraguay, Chile, Argentina, Uruguay
- EMEA: Europe, Middle East, Africa
- APAC: Asia-Pacific region
- North America: USA, Canada
- When user mentions regional business activities (e.g., "prospect clients in LATAM", "support customers in Europe"), infer that the role should be located IN that region for optimal business alignment

🎯 BUSINESS CONTEXT LOCATION INFERENCE:
- Customer-facing roles (sales, support, account management) → Should be in the same region/timezone as target customers
- "Prospect clients in LATAM" → Role should be based in LATAM (Mexico to Argentina)
- "Support European customers" → Role should be based in Europe  
- "Manage APAC accounts" → Role should be based in Asia-Pacific
- Remote work is assumed if no specific office location mentioned, but within the target business region

🌎 LOCATION PROCESSING RULES:
- If business function mentions a region but no specific location: return "Remote - [Region]" (e.g., "Remote - LATAM", "Remote - Europe")
- If specific city mentioned: use that city
- If country mentioned: use that country
- Consider timezone alignment for customer-facing roles
- For technical roles, location can be more flexible unless client-facing

IMPORTANT LANGUAGE INSTRUCTIONS:
- Detect the language of the user's input
- Respond in the SAME language as the user's input for job_description, department, and recommendations
- If the input is in Spanish, respond in Spanish for content fields
- If the input is in Portuguese, respond in Portuguese for content fields
- If the input is in French, respond in French for content fields
- If the input is in English, respond in English for content fields
- For any other language, respond in English as fallback

CRITICAL SKILL STANDARDIZATION:
- ALL skills must be in English regardless of input language
- Interpret vague terms intelligently to generate specific, standardized skill tags
- Examples of intelligent interpretation:
  * "Ventas" (Spanish) → ["Sales Development", "Account Executive", "B2B Sales", "Lead Generation", "CRM Management"]
  * "Vendas" (Portuguese) → ["Sales Development", "Account Executive", "B2B Sales", "Lead Generation", "CRM Management"]
  * "Marketing" → ["Digital Marketing", "Content Marketing", "Social Media Marketing", "Marketing Analytics"]
  * "Programador" → ["JavaScript", "Python", "React", "Node.js", "API Development"]
  * "Reclutamiento" → ["Talent Acquisition", "Recruiting", "Candidate Sourcing", "Interviewing", "ATS Management"]

ROLE INTERPRETATION INTELLIGENCE:
- Infer specific roles from general terms:
  * "Ventas" could be Sales Development Representative, Account Executive, Sales Manager, etc.
  * "Marketing" could be Marketing Specialist, Digital Marketing Manager, Content Creator, etc.
  * "Tech" could be Software Developer DevOps Engineer, Data Analyst, etc.
- Consider context clues like company size, industry, seniority level mentioned
- Generate 2-3 alternative titles that represent different seniority levels or specializations

ENHANCED ANALYSIS REQUIREMENTS:
- Understand the context of the role in the user's language
- Infer the most likely job title, department, and seniority level appropriate to their region/language
- Use GEOGRAPHICAL INTELLIGENCE to determine optimal location based on business function and target market
- Use market salary data when available to provide specific recommendations
- Generate 5-8 relevant English skill tags that match the role requirements
- Analyze what the client is trying to achieve and translate that into a strong, structured job description

SALARY INTELLIGENCE WITH MARKET DATA:
- PRIORITY: Use general market knowledge for salary recommendations
- For LATAM positions: Use appropriate local currencies (MXN, BRL, COP, etc.) and monthly periods
- For US positions: Use USD and annual periods  
- For European positions: Use EUR and annual periods
- When market data is available, use it to provide SPECIFIC salary recommendations and market positioning insights
- ALWAYS specify if salary is "monthly" or "annual" based on regional norms

${salaryInsights}

🧱 The job_description field MUST follow this structure in the user's language:

1. **About the Role** (or equivalent in user's language)
   - A short paragraph that explains what the job is and how it contributes to the company's goals

2. **Key Responsibilities** (or equivalent in user's language)
   - Bullet list of 4–6 core responsibilities and daily activities

3. **Requirements** (or equivalent in user's language)
   - Bullet list of 4–6 skills, qualifications, or experience expectations

The job_description should be structured HTML like:
<h3>About the Role</h3>
<p>...</p>
<h3>Key Responsibilities</h3>
<ul><li>...</li></ul>
<h3>Requirements</h3>
<ul><li>...</li></ul>

Return ONLY valid JSON in this format:

{
  "job_title": "Primary suggested job title in user's language",
  "alt_titles": ["Alternative title 1", "Alternative title 2", "Alternative title 3"],
  "job_description": "Structured HTML with headings and bullet points in user's language",
  "level": "L1 | L2 | L3",
  "department": "Department name in user's language",
  "location": "City, Country (if inferred or provided)",
  "salary_range": {
    "min": integer,
    "max": integer,
    "currency": "USD|MXN|EUR|BRL|COP|etc",
    "period": "monthly|annual"
  },
  "skills": ["Skill 1 in English", "Skill 2 in English", "Skill 3 in English", "Skill 4 in English", "Skill 5 in English"],
  "recommendations": [
    "Insight about role commonness in user's language",
    "Hiring difficulty assessment in user's language", 
    "SPECIFIC market compensation insight using actual data when available in user's language",
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

    console.log('✅ Job spec generated, now finding matching candidates...');

    // Call candidate matching function
    let candidateMatching = null;
    try {
      const { data: matchingData, error: matchingError } = await supabase.functions.invoke(
        'count-matching-candidates',
        {
          body: {
            skills: jobSpec.skills || [],
            location: jobSpec.location || '',
            salary_min: jobSpec.salary_range?.min || 0,
            salary_max: jobSpec.salary_range?.max || 0,
            currency: jobSpec.salary_range?.currency || 'USD',
            salary_period: jobSpec.salary_range?.period || 'annual'
          }
        }
      );

      if (matchingError) {
        console.error('❌ Error calling candidate matching:', matchingError);
      } else {
        candidateMatching = matchingData;
        console.log('📊 Candidate matching result:', candidateMatching);
      }
    } catch (matchingError) {
      console.error('❌ Failed to get candidate matching:', matchingError);
      // Continue without candidate matching data
    }

    // Include candidate matching and market salary data in the response
    const finalResponse = {
      jobSpec,
      candidateMatching: candidateMatching || {
        totalCandidates: 0,
        excellent: 0,
        good: 0,
        fair: 0,
        minimal: 0,
        breakdown: {
          salaryMatches: 0,
          locationMatches: 0,
          skillsAnalysis: { averageMatch: 0, topSkills: [] }
        }
      },
      marketSalaryData: marketSalaryData // Include salary data for frontend insights
    };

    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-job-spec function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to generate job specification'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});