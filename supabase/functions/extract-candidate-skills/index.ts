import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  }>;
}

async function extractSkillsFromProfile(profileSummary: string, candidateName: string): Promise<string[]> {
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
            content: `You are a professional skill extraction assistant. Analyze the candidate profile and extract relevant professional skills. Focus on:
- Technical skills (programming languages, tools, software)
- Business skills (sales, marketing, project management)
- Industry-specific skills (HR, finance, operations)
- Soft skills only if they're prominently mentioned
- Certifications and methodologies

Return ONLY a JSON array of skills as strings, no explanation. Example: ["JavaScript", "Sales", "Project Management"]`
          },
          {
            role: 'user',
            content: `Extract skills from this candidate profile for ${candidateName}:\n\n${profileSummary}`
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const extractedText = data.choices[0].message.content.trim();
    
    try {
      const skills = JSON.parse(extractedText);
      return Array.isArray(skills) ? skills.slice(0, 15) : []; // Limit to 15 skills
    } catch (parseError) {
      console.error('Failed to parse skills JSON:', extractedText);
      return [];
    }
  } catch (error) {
    console.error('Error extracting skills with AI:', error);
    return [];
  }
}

function extractSkillsFromSummaryFallback(summary: string): string[] {
  if (!summary) return [];
  
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
  
  const cleanSummary = summary.toLowerCase().replace(/<[^>]*>/g, ' ').replace(/[^\w\s]/g, ' ');
  const extractedSkills: string[] = [];
  
  for (const keyword of skillKeywords) {
    if (cleanSummary.includes(keyword)) {
      extractedSkills.push(keyword);
    }
  }
  
  return [...new Set(extractedSkills)]; // Remove duplicates
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidateId, batchSize = 10, dryRun = false }: SkillExtractionRequest = await req.json();
    
    console.log(`🔍 Starting skill extraction - Candidate: ${candidateId || 'ALL'}, Batch: ${batchSize}, DryRun: ${dryRun}`);

    // Fetch candidates without skills
    let query = supabase
      .from('candidates')
      .select('id, candidate_name, profile_summary, skills')
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

    for (const candidate of candidates) {
      result.processedCount++;
      
      try {
        console.log(`\n🧑‍💼 Processing: ${candidate.candidate_name}`);
        
        let extractedSkills: string[] = [];
        
        // Try AI extraction first if API key is available
        if (openAIApiKey && candidate.profile_summary) {
          extractedSkills = await extractSkillsFromProfile(candidate.profile_summary, candidate.candidate_name);
        }
        
        // Fallback to keyword extraction if AI fails or no API key
        if (extractedSkills.length === 0 && candidate.profile_summary) {
          extractedSkills = extractSkillsFromSummaryFallback(candidate.profile_summary);
        }
        
        if (extractedSkills.length === 0) {
          console.log(`⚠️ No skills extracted for ${candidate.candidate_name}`);
          continue;
        }
        
        console.log(`✅ Extracted ${extractedSkills.length} skills: [${extractedSkills.join(', ')}]`);
        
        result.candidates.push({
          id: candidate.id,
          name: candidate.candidate_name,
          extractedSkills,
          previousSkills: candidate.skills
        });
        
        // Update candidate with extracted skills (unless dry run)
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('candidates')
            .update({
              skills: extractedSkills,
              updated_at: new Date().toISOString()
            })
            .eq('id', candidate.id);
          
          if (updateError) {
            const errorMsg = `Failed to update candidate ${candidate.candidate_name}: ${updateError.message}`;
            console.error(errorMsg);
            result.errors.push(errorMsg);
          } else {
            result.updatedCount++;
            console.log(`💾 Updated ${candidate.candidate_name} with ${extractedSkills.length} skills`);
          }
        } else {
          console.log(`🔍 [DRY RUN] Would update ${candidate.candidate_name} with ${extractedSkills.length} skills`);
        }
        
      } catch (error) {
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

  } catch (error) {
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