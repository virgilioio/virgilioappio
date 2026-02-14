import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/mod.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Helper functions to extract hints from prompts
function extractIndustryHint(prompt: string, jobSpec: any): string | undefined {
  const lowerPrompt = prompt.toLowerCase();
  
  // Common industry keywords
  const industryPatterns = [
    { pattern: /\b(saas|software as a service)\b/i, industry: 'SaaS' },
    { pattern: /\b(fintech|financial technology)\b/i, industry: 'FinTech' },
    { pattern: /\b(healthtech|health tech|healthcare tech)\b/i, industry: 'HealthTech' },
    { pattern: /\b(edtech|education tech)\b/i, industry: 'EdTech' },
    { pattern: /\b(e-?commerce)\b/i, industry: 'E-commerce' },
    { pattern: /\b(cybersecurity|cyber security)\b/i, industry: 'Cybersecurity' },
    { pattern: /\b(ai|artificial intelligence|machine learning|ml)\b/i, industry: 'AI/ML' },
    { pattern: /\b(blockchain|crypto|web3)\b/i, industry: 'Blockchain/Crypto' },
    { pattern: /\b(gaming|game dev)\b/i, industry: 'Gaming' },
    { pattern: /\b(biotech|biotechnology)\b/i, industry: 'Biotech' },
    { pattern: /\b(cleantech|clean tech|renewable)\b/i, industry: 'CleanTech' },
    { pattern: /\b(b2b)\b/i, industry: 'B2B' },
    { pattern: /\b(b2c)\b/i, industry: 'B2C' },
    { pattern: /\b(enterprise)\b/i, industry: 'Enterprise Software' },
    { pattern: /\b(startup|scale-?up)\b/i, industry: 'Startup' },
    { pattern: /\b(consulting)\b/i, industry: 'Consulting' },
    { pattern: /\b(banking|bank)\b/i, industry: 'Banking' },
    { pattern: /\b(insurance)\b/i, industry: 'Insurance' },
    { pattern: /\b(retail)\b/i, industry: 'Retail' },
    { pattern: /\b(manufacturing)\b/i, industry: 'Manufacturing' },
    { pattern: /\b(logistics|supply chain)\b/i, industry: 'Logistics' },
    { pattern: /\b(real estate)\b/i, industry: 'Real Estate' },
    { pattern: /\b(media|advertising)\b/i, industry: 'Media/Advertising' },
    { pattern: /\b(telecommunications|telecom)\b/i, industry: 'Telecommunications' },
  ];

  for (const { pattern, industry } of industryPatterns) {
    if (pattern.test(prompt)) {
      return industry;
    }
  }

  // Use department from job spec as fallback hint
  if (jobSpec?.department) {
    return jobSpec.department;
  }

  return undefined;
}

// Extract user-mentioned companies with proper filtering
function extractUserCompanies(prompt: string): string[] {
  // Role words that should not be treated as company names
  const ROLE_STOPLIST = new Set([
    'manager', 'engineer', 'specialist', 'developer', 'executive', 'director',
    'coordinator', 'analyst', 'consultant', 'recruiter', 'marketer', 'designer',
    'founder', 'ceo', 'vp', 'lead', 'senior', 'junior', 'principal', 'head',
    'remote', 'contract', 'founding', 'part-time', 'full-time', 'freelance', 'intern',
    'assistant', 'associate', 'representative', 'administrator', 'technician'
  ]);
  
  // Location names that should not be treated as company names
  const LOCATION_STOPLIST = new Set([
    'san francisco', 'new york', 'los angeles', 'chicago', 'austin', 'seattle',
    'boston', 'denver', 'miami', 'atlanta', 'london', 'berlin', 'paris',
    'toronto', 'vancouver', 'sydney', 'mexico', 'brazil', 'latam', 'emea', 'apac',
    'united states', 'usa', 'uk', 'canada', 'germany', 'france', 'spain',
    'singapore', 'hong kong', 'tokyo', 'mumbai', 'bangalore', 'dublin',
    'amsterdam', 'stockholm', 'zurich', 'barcelona', 'madrid', 'lisbon'
  ]);
  
  // Corporate suffixes to filter out fragments
  const SUFFIX_STOPLIST = /^(inc|llc|ltd|gmbh|s\.?a\.?|plc|corp|co|ag|bv|nv|pty|lp)$/i;
  
  const patterns = [
    /(?:like|similar to|such as|at|from|ex-|worked at|experience at|alumni of|background from)\s+([A-Z][a-zA-Z0-9&]+(?:\s+[A-Z&][a-zA-Z0-9&]+)*)/gi,
    /(?:companies? like|competitors? of)\s+([A-Z][a-zA-Z0-9&]+(?:[,]?\s*(?:\s+and\s+|\s+or\s+|,)\s*[A-Z][a-zA-Z0-9&]+)*)/gi
  ];
  
  const candidates = new Set<string>();
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(prompt)) !== null) {
      const rawMatch = match[1].trim();
      
      // SPLIT multi-company lists on comma, " and ", " or " (with spaces to protect "Johnson & Johnson")
      const companyParts = rawMatch.split(/\s*(?:,|\s+and\s+|\s+or\s+)\s*/i);
      
      for (const part of companyParts) {
        const companyName = part.trim();
        if (!companyName) continue;
        
        const lowerName = companyName.toLowerCase();
        
        // Skip if too short or matches suffix stoplist (e.g., "Inc.", "LLC")
        if (companyName.length <= 2) continue;
        if (SUFFIX_STOPLIST.test(companyName)) continue;
        
        // Reject if matches role stoplist
        if (ROLE_STOPLIST.has(lowerName)) continue;
        if ([...ROLE_STOPLIST].some(word => lowerName.includes(word) && lowerName.length < word.length + 5)) continue;
        
        // Reject if matches location stoplist
        if (LOCATION_STOPLIST.has(lowerName)) continue;
        
        candidates.add(companyName);
      }
    }
  }
  
  return Array.from(candidates).slice(0, 5); // Max 5 user companies
}

// Legacy function for backward compatibility
function extractCompanyHint(prompt: string): string | undefined {
  const companies = extractUserCompanies(prompt);
  return companies.length > 0 ? companies[0] : undefined;
}
serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const { prompt, conversationId } = await req.json();

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's tenant_id for validation
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('user_status', 'active')
      .single();

    if (memberError || !memberData) {
      throw new Error('User membership not found');
    }

    console.log(`Generating job spec for tenant: ${memberData.tenant_id}`);
    
    let conversationMessages: Array<{ role: string; content: string }> = [];
    let hasConversation = false;
    
    // If conversationId provided, fetch and VALIDATE conversation
    if (conversationId) {
      // CRITICAL: Validate conversation belongs to user's tenant
      const { data: conversation, error: convError } = await supabase
        .from('ai_conversations')
        .select('id, tenant_id, status, created_by')
        .eq('id', conversationId)
        .eq('tenant_id', memberData.tenant_id)
        .eq('status', 'draft')
        .single();
      
      if (convError || !conversation) {
        console.error('🚨 SECURITY: Unauthorized conversation access attempt | User:', user.id, '| Conversation:', conversationId, '| Tenant:', memberData.tenant_id);
        throw new Error('Conversation not found, already used, or access denied');
      }

      console.log(`✅ Conversation validated: ${conversationId} | Tenant: ${conversation.tenant_id} | User: ${user.id}`);
      
      // Now fetch messages - already tenant-safe due to conversation validation
      const { data: messages, error: msgError } = await supabase
        .from('conversation_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (!msgError && messages && messages.length > 0) {
        // CRITICAL FIX: Store conversation messages as proper OpenAI message objects
        // This ensures the AI properly understands the conversation context
        conversationMessages = messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }));
        hasConversation = true;
        console.log('Including conversation history from', messages.length, 'messages as proper message objects');
      }
    }

    // Detect weak prompts that won't provide good synthesis
    const weakPromptPatterns = /^(yes|yeah|yep|ok|okay|sure|create|generate|do it|proceed)!?$/i;
    const isWeakPrompt = conversationId && weakPromptPatterns.test(prompt.trim());
    
    if (isWeakPrompt) {
      console.log('Weak prompt detected, replacing with synthesis instruction');
    }
    
    const effectivePrompt = isWeakPrompt 
      ? "Generate a comprehensive job specification based on the detailed conversation history provided above. Synthesize all requirements discussed."
      : prompt;

    console.log('Generating job spec with prompt:', effectivePrompt);
    console.log('First 100 chars of prompt:', effectivePrompt.substring(0, 100));
    
    // Robust language detection using exclusive discriminators (not overlapping words)
    function detectPromptLanguage(text: string): string {
      const lowerText = text.toLowerCase();
      
      // STEP 1: Character-based detection (most reliable)
      // Portuguese-only characters/patterns
      if (/[ãõ]|ção|ções|ões|ão\b/.test(text)) {
        console.log('Language detected via Portuguese characters: ã/õ/ção/ões/ão');
        return 'Portuguese';
      }
      // Spanish-only character
      if (/ñ/.test(text)) {
        console.log('Language detected via Spanish character: ñ');
        return 'Spanish';
      }
      // Portuguese digraphs (lh, nh are Portuguese-specific, ll is Spanish)
      if (/\b\w*[ln]h\w*\b/.test(lowerText)) {
        console.log('Language detected via Portuguese digraphs: lh/nh');
        return 'Portuguese';
      }
      // Spanish double-l pattern (ll followed by vowel)
      if (/ll[aeiou]/.test(lowerText)) {
        console.log('Language detected via Spanish pattern: ll+vowel');
        return 'Spanish';
      }
      
      // STEP 2: Exclusive word detection (words that exist in one language but not the other)
      // Spanish-ONLY words (do NOT exist in Portuguese)
      const spanishOnlyWords = [
        'necesito', 'busco', 'quiero', 'tengo', 'puedo', 'donde', 'cuando', 
        'aunque', 'pero', 'sin', 'hacia', 'hasta', 'muy', 'también', 'ahora',
        'siempre', 'nunca', 'trabajo', 'empresa', 'equipo', 'años', 'experiencia',
        'desarrollador', 'ingeniero', 'gerente', 'ventas', 'cliente', 'somos',
        'buscamos', 'queremos', 'nuestro', 'nuestra'
      ];
      
      // Portuguese-ONLY words (do NOT exist in Spanish)
      const portugueseOnlyWords = [
        'preciso', 'procuro', 'tenho', 'posso', 'onde', 'quando',
        'embora', 'mas', 'sem', 'até', 'muito', 'também', 'agora',
        'sempre', 'nunca', 'trabalho', 'empresa', 'equipe', 'você', 'não', 'sim',
        'desenvolvedor', 'engenheiro', 'gerente', 'vendas', 'cliente', 'somos',
        'procuramos', 'queremos', 'nosso', 'nossa', 'anos', 'experiência'
      ];
      
      // French-ONLY words
      const frenchOnlyWords = [
        'besoin', 'cherche', 'veux', 'nous', 'vous', 'avec', 'dans', 'sont',
        'être', 'avoir', 'faire', 'pour', 'cette', 'cette', 'développeur',
        'ingénieur', 'responsable', 'équipe', 'années', 'expérience'
      ];
      
      // English indicators
      const englishWords = [
        'need', 'looking', 'want', 'with', 'that', 'who', 'help', 'the', 'and',
        'for', 'are', 'have', 'this', 'will', 'your', 'from', 'they', 'been',
        'experience', 'years', 'team', 'company', 'developer', 'engineer', 'manager'
      ];
      
      // Count matches using word boundaries to avoid partial matches
      const countMatches = (words: string[]) => 
        words.filter(word => new RegExp(`\\b${word}\\b`, 'i').test(lowerText)).length;
      
      const spanishCount = countMatches(spanishOnlyWords);
      const portugueseCount = countMatches(portugueseOnlyWords);
      const frenchCount = countMatches(frenchOnlyWords);
      const englishCount = countMatches(englishWords);
      
      console.log(`Language detection scores - ES: ${spanishCount}, PT: ${portugueseCount}, FR: ${frenchCount}, EN: ${englishCount}`);
      
      const maxCount = Math.max(spanishCount, portugueseCount, frenchCount, englishCount);
      
      if (maxCount === 0) return 'English'; // Default if no matches
      
      // Require at least 2 matches for non-English to avoid false positives
      if (spanishCount === maxCount && spanishCount >= 2) {
        console.log('Language detected: Spanish (exclusive word match)');
        return 'Spanish';
      }
      if (portugueseCount === maxCount && portugueseCount >= 2) {
        console.log('Language detected: Portuguese (exclusive word match)');
        return 'Portuguese';
      }
      if (frenchCount === maxCount && frenchCount >= 2) {
        console.log('Language detected: French (exclusive word match)');
        return 'French';
      }
      if (englishCount === maxCount && englishCount >= 1) {
        return 'English';
      }
      
      // Fallback: if only 1 match in Spanish/Portuguese, still use it (better than wrong default)
      if (spanishCount === 1 && portugueseCount === 0) return 'Spanish';
      if (portugueseCount === 1 && spanishCount === 0) return 'Portuguese';
      
      return 'English'; // Default
    }
    
    const detectedLanguage = detectPromptLanguage(prompt);
    console.log('Detected prompt language:', detectedLanguage);

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

A client has described their hiring need. Your task is to analyze this input and return a structured response that GoGio's system can use to generate a high-quality job record.

${hasConversation ? 
  '🗨️ **CRITICAL - CONVERSATION CONTEXT PROVIDED:**\n\nIMPORTANT: The conversation messages are included as separate messages in this chat. You MUST synthesize ALL information from the ENTIRE conversation to create a comprehensive job specification.\n\n⚠️ The user\'s final message may be a simple confirmation like "Yes!" or "Create it!" - synthesize from the FULL conversation.\n\nUse the conversation to understand:\n- The job title and role requirements\n- Required skills and qualifications\n- Salary expectations and budget\n- Location and work arrangement preferences\n- Any other details discussed\n\nNEVER return placeholder values like "Job Title Not Specified" - synthesize concrete information from the conversation.' 
  : 
  'Generate a job specification based on the user\'s prompt.'
}

Now here are your capabilities:

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

TITLE GENERATION RULES (CRITICAL - AFFECTS SEARCH QUALITY):
- Generate exactly 1-2 alternative titles (NOT 3+)
- Focus on the MOST COMMON variations that recruiters search for
- Example: For "Account Executive" → ["Sales Executive"] (just one clear alternative)
- Example: For "Software Engineer" → ["Software Developer"] (just one)
- Only add a second title if it's significantly different and commonly used
- Fewer, more precise titles = better search results

ENHANCED ANALYSIS REQUIREMENTS:
- Understand the context of the role
- Infer the most likely job title, department, and seniority level appropriate to their region
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

🧱 The job_description field MUST follow this structure in the detected prompt language:

1. **About the Role** (or equivalent in the detected language)
   - A short paragraph that explains what the job is and how it contributes to the company's goals

2. **Key Responsibilities** (or equivalent in the detected language)
   - Bullet list of 4–6 core responsibilities and daily activities

3. **Requirements** (or equivalent in the detected language)
   - Bullet list of 4–6 skills, qualifications, or experience expectations

The job_description should be structured HTML like:
<h3>About the Role</h3>
<p>...</p>
<h3>Key Responsibilities</h3>
<ul><li>...</li></ul>
<h3>Requirements</h3>
<ul><li>...</li></ul>

🔍 CRITICAL - LOCATION FORMAT FOR CORESIGNAL COMPATIBILITY:
Your location output MUST be in a format that can be mapped to CoreSignal's expected structure.

LOCATION OUTPUT RULES:
1. For specific cities: Use format "City, State/Province, Country" (e.g., "Mexico City, CDMX, Mexico", "San Francisco, California, United States")
2. For countries only: Use the full country name (e.g., "Mexico", "United States", "Colombia")
3. For regions with remote: Use "Remote - REGION" format (e.g., "Remote - LATAM", "Remote - EMEA", "Remote - APAC", "Remote - North America")
4. For pure remote (global): Use "Remote"
5. NEVER use ambiguous formats like "Mexico City, Mexico" without state - always include state/province when specifying a city

REGION DEFINITIONS FOR LOCATION:
- LATAM: Mexico, Guatemala, El Salvador, Honduras, Nicaragua, Costa Rica, Panama, Colombia, Venezuela, Ecuador, Peru, Bolivia, Brazil, Paraguay, Uruguay, Argentina, Chile
- EMEA: UK, Germany, France, Spain, Italy, Netherlands, Poland, UAE, Saudi Arabia, Egypt, South Africa, Kenya
- APAC: India, China, Japan, Singapore, Australia, South Korea, Indonesia, Thailand, Vietnam, Philippines, Malaysia, New Zealand
- North America: United States, Canada

CRITICAL LOCATION GROUNDING RULE:
If the job description or prompt explicitly names specific countries (e.g., "India or the Philippines", "Mexico and Colombia"),
you MUST list ONLY those countries in the "country_codes" array. Do NOT generalize to a region.
Only use "region" when the prompt itself uses regional language ("LATAM", "APAC", "Europe", etc.)
or gives no specific country constraints. Explicit country mentions ALWAYS override regional inference.

Return ONLY valid JSON in this format:

{
  "job_title": "Primary suggested job title in detected prompt language",
  "alt_titles": ["Most common alternative title", "Second alternative (only if significantly different)"],
  "job_description": "Structured HTML with headings and bullet points in detected prompt language",
  "level": "L1 | L2 | L3",
  "department": "Department name in detected prompt language",
  "location": "City, State, Country OR Country OR Remote - REGION OR Remote",
  "location_details": {
    "type": "city | state | country | region | remote",
    "city": "City name if applicable or null",
    "state": "State/Province name if applicable or null",
    "country": "Full country name",
    "country_code": "Two-letter ISO code (US, MX, CO, AR, BR, etc.) — use for SINGLE country only",
    "country_codes": ["ISO codes"] or null — "USE THIS when multiple specific countries are mentioned (e.g., ['IN', 'PH']). Set country_code to null when using this.",
    "region": "LATAM | EMEA | APAC | NORTH_AMERICA if regional, else null",
    "is_remote": true | false
  },
  "salary_range": {
    "min": integer,
    "max": integer,
    "currency": "USD|MXN|EUR|BRL|COP|etc",
    "period": "monthly|annual"
  },
  "skills": ["Skill 1 in English", "Skill 2 in English", "Skill 3 in English", "Skill 4 in English", "Skill 5 in English"],
  "recommendations": [
    "Insight about role commonness",
    "Hiring difficulty assessment", 
    "SPECIFIC market compensation insight using actual data when available",
    "Time-to-hire implication"
  ]
}

===== ABSOLUTE LANGUAGE RULE (OVERRIDES EVERYTHING ABOVE) =====
The user's prompt is written in ${detectedLanguage}.
ALL text fields (job_title, alt_titles, job_description, department, recommendations) MUST be in ${detectedLanguage}.
The job LOCATION does NOT determine the response language. A job in Mexico prompted in English = English output.
Skills are ALWAYS in English regardless of prompt language.
DO NOT translate, adapt, or localize text fields to match the geographic location.
=============================================================`
          },
          // CRITICAL: Include conversation messages as proper OpenAI messages
          // This ensures the AI properly understands the full conversation context
          ...conversationMessages,
          // Language enforcement sandwich: extra user message before the actual prompt
          { role: 'user', content: `LANGUAGE RULE: Your ENTIRE response MUST be in ${detectedLanguage}. Do NOT use ${detectedLanguage === 'English' ? 'Spanish, Portuguese, French, or any other language' : 'any language other than ' + detectedLanguage} for text fields. Skills stay in English.` },
          { role: 'user', content: effectivePrompt }
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

    console.log('✅ Job spec generated, now researching enrichments...');

    // Call research-sourcing-criteria for enriched search data
    let researchData = null;
    try {
      console.log('🔍 Calling research-sourcing-criteria for enrichments...');
      
      // Extract industry/company hints from the prompt or job spec
      const industryHint = extractIndustryHint(prompt, jobSpec);
      const companyHint = extractCompanyHint(prompt);
      
      const { data: researchResult, error: researchError } = await supabase.functions.invoke(
        'research-sourcing-criteria',
        {
          body: {
            job_title: jobSpec.job_title,
            industry_hint: industryHint,
            location: jobSpec.location,
            skills: jobSpec.skills,
            company_hint: companyHint,
            department: jobSpec.department,
            detected_language: detectedLanguage  // Pass language for consistent outputs
          }
        }
      );

      if (researchError) {
        console.error('❌ Research function error:', researchError);
      } else if (researchResult && !researchResult.error) {
        researchData = researchResult;
        console.log('✅ Research enrichment complete:', {
          titles: researchData.researched_titles?.length || 0,
          companies: researchData.researched_companies?.length || 0,
          industries: researchData.researched_industries?.length || 0,
          keywords: researchData.researched_keywords?.length || 0
        });
      } else {
        console.warn('⚠️ Research returned empty or error:', researchResult);
      }
    } catch (researchError) {
      console.error('❌ Failed to get research enrichment:', researchError);
      // Continue without research data - graceful degradation
    }

    // Merge research data into job spec
    if (researchData) {
      // Add researched titles to alt_titles (deduplicated)
      if (researchData.researched_titles && researchData.researched_titles.length > 0) {
        const existingTitles = new Set((jobSpec.alt_titles || []).map((t: string) => t.toLowerCase()));
        const newTitles = researchData.researched_titles.filter(
          (t: string) => !existingTitles.has(t.toLowerCase()) && t.toLowerCase() !== jobSpec.job_title.toLowerCase()
        );
        jobSpec.alt_titles = [...(jobSpec.alt_titles || []), ...newTitles];
      }
      
      // Attach research metadata for transparency
      jobSpec.research_metadata = {
        researched_titles: researchData.researched_titles || [],
        researched_companies: researchData.researched_companies || [],
        researched_industries: researchData.researched_industries || [],
        researched_keywords: researchData.researched_keywords || [],
        research_reasoning: researchData.research_reasoning || '',
        research_timestamp: new Date().toISOString()
      };
    }

    console.log('📊 Finding matching candidates...');

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

    // Mark conversation as 'used' to prevent reuse
    if (conversationId && memberData) {
      await supabase
        .from('ai_conversations')
        .update({ 
          status: 'used',
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)
        .eq('tenant_id', memberData.tenant_id);
      
      console.log(`✅ Conversation marked as used: ${conversationId} | Tenant: ${memberData.tenant_id}`);
    }

    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (error) {
    console.error('Error in generate-job-spec function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to generate job specification'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
});