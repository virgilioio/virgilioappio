import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SkillItem {
  name: string;
  category: 'technical' | 'tools' | 'industries' | 'titles' | 'soft' | 'certifications';
  confidence: number;
  source: 'ai_generated';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileSummary, candidateName } = await req.json();

    if (!profileSummary || profileSummary.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Profile summary too short for skill extraction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating skills for candidate:', candidateName);

    const systemPrompt = `You are an expert recruiter and skills analyst. Analyze the candidate profile summary and extract structured skills data.

Extract skills in these categories:
- technical: Programming languages, frameworks, methodologies, technical skills
- tools: Software, platforms, applications (Figma, Adobe, Salesforce, Greenhouse, Ashby, etc.)
- industries: Industry experience, domain knowledge, market sectors
- titles: Job roles, positions, career levels they've held or could fill
- soft: Leadership, communication, teamwork, problem-solving skills
- certifications: Professional certifications, degrees, credentials

Return ONLY a valid JSON array of objects with this exact structure:
[
  {
    "name": "React",
    "category": "technical",
    "confidence": 0.95
  },
  {
    "name": "Figma",
    "category": "tools", 
    "confidence": 0.88
  }
]

Guidelines:
- Be specific and precise with skill names
- Confidence should be 0.6-1.0 (only include skills you're confident about)
- Include common variations (e.g., "JavaScript" and "JS")
- Focus on marketable, searchable skills
- Include both explicit and implied skills
- Limit to 20 most relevant skills total`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Candidate Profile:\n\n${profileSummary}` }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    console.log('Raw OpenAI response:', content);

    // Parse the JSON response
    let extractedSkills: SkillItem[];
    try {
      extractedSkills = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      // Try to extract JSON from the response if it's wrapped in markdown
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        extractedSkills = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Invalid JSON response from AI');
      }
    }

    // Validate and clean the extracted skills
    const validatedSkills = extractedSkills
      .filter(skill => 
        skill.name && 
        skill.category && 
        skill.confidence >= 0.6 && 
        skill.confidence <= 1.0
      )
      .map(skill => ({
        ...skill,
        source: 'ai_generated' as const,
        name: skill.name.trim()
      }))
      .slice(0, 20); // Limit to 20 skills

    console.log(`Generated ${validatedSkills.length} skills for candidate`);

    // Group skills by category for response
    const skillsByCategory = validatedSkills.reduce((acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = [];
      }
      acc[skill.category].push(skill);
      return acc;
    }, {} as Record<string, SkillItem[]>);

    return new Response(
      JSON.stringify({
        skills: validatedSkills,
        skillsByCategory,
        totalCount: validatedSkills.length,
        generatedAt: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in generate-comprehensive-skills function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to generate skills',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});