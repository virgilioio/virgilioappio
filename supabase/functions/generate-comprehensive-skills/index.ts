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
  source?: 'ai_generated';
}

interface RoleLevel {
  level: string;
  confidence: number;
  rationale?: string;
}

type ContextKind = 'candidate' | 'job';

function sanitizeName(name: string): string {
  return (name || '').trim();
}

function dedupeSkills(skills: SkillItem[]): SkillItem[] {
  const seen = new Set<string>();
  const out: SkillItem[] = [];
  for (const s of skills) {
    const key = sanitizeName(s.name).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...s, name: sanitizeName(s.name), source: 'ai_generated' });
  }
  return out;
}

function groupByCategory(skills: SkillItem[]): Record<string, SkillItem[]> {
  return skills.reduce((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {} as Record<string, SkillItem[]>);
}

function fallbackSkillsForLevel(level: string): SkillItem[] {
  const lvl = (level || '').toLowerCase();
  if (lvl.includes('manager')) {
    return [
      { name: 'People Management', category: 'soft', confidence: 0.7 },
      { name: 'Team Leadership', category: 'soft', confidence: 0.7 },
      { name: 'Stakeholder Management', category: 'soft', confidence: 0.65 },
      { name: 'Project Management', category: 'soft', confidence: 0.65 },
      { name: 'Hiring & Onboarding', category: 'soft', confidence: 0.6 },
      { name: 'Coaching & Mentoring', category: 'soft', confidence: 0.6 },
      { name: 'Performance Management', category: 'soft', confidence: 0.6 },
      { name: 'Cross-functional Collaboration', category: 'soft', confidence: 0.6 },
      { name: 'Strategic Planning', category: 'soft', confidence: 0.6 },
      { name: 'Budgeting', category: 'soft', confidence: 0.6 },
    ];
  }
  if (lvl.includes('director')) {
    return [
      { name: 'Strategic Leadership', category: 'soft', confidence: 0.7 },
      { name: 'Org Design', category: 'soft', confidence: 0.65 },
      { name: 'Portfolio Management', category: 'soft', confidence: 0.65 },
      { name: 'Budget Ownership', category: 'soft', confidence: 0.65 },
      { name: 'Executive Communication', category: 'soft', confidence: 0.65 },
      { name: 'Change Management', category: 'soft', confidence: 0.6 },
      { name: 'Roadmap Prioritization', category: 'soft', confidence: 0.6 },
    ];
  }
  if (lvl.includes('vp') || lvl.includes('vice') || lvl.includes('cxo') || lvl.includes('chief') || lvl.includes('c-level')) {
    return [
      { name: 'Executive Leadership', category: 'soft', confidence: 0.7 },
      { name: 'Vision & Strategy', category: 'soft', confidence: 0.7 },
      { name: 'Board Communication', category: 'soft', confidence: 0.65 },
      { name: 'P&L Management', category: 'soft', confidence: 0.65 },
      { name: 'Organizational Scaling', category: 'soft', confidence: 0.6 },
    ];
  }
  if (lvl.includes('lead')) {
    return [
      { name: 'Technical Leadership', category: 'soft', confidence: 0.65 },
      { name: 'Mentoring', category: 'soft', confidence: 0.6 },
      { name: 'Sprint Planning', category: 'soft', confidence: 0.6 },
      { name: 'Code Review', category: 'technical', confidence: 0.6 },
    ];
  }
  if (lvl.includes('intern') || lvl.includes('trainee')) {
    return [
      { name: 'Fast Learning', category: 'soft', confidence: 0.6 },
      { name: 'Collaboration', category: 'soft', confidence: 0.6 },
      { name: 'Time Management', category: 'soft', confidence: 0.6 },
      { name: 'Documentation', category: 'soft', confidence: 0.6 },
    ];
  }
  if (lvl.includes('volunteer')) {
    return [
      { name: 'Community Engagement', category: 'soft', confidence: 0.6 },
      { name: 'Event Coordination', category: 'soft', confidence: 0.6 },
      { name: 'Fundraising', category: 'soft', confidence: 0.6 },
      { name: 'Outreach', category: 'soft', confidence: 0.6 },
    ];
  }
  // Default IC-oriented fallbacks
  return [
    { name: 'Problem Solving', category: 'soft', confidence: 0.6 },
    { name: 'Communication', category: 'soft', confidence: 0.6 },
    { name: 'Collaboration', category: 'soft', confidence: 0.6 },
    { name: 'Ownership', category: 'soft', confidence: 0.6 },
  ];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!openAIApiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing OPENAI_API_KEY' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const {
      profileSummary,
      candidateName,
      jobTitle,
      context = 'candidate',
      desiredCount = 20,
      minCount = 15,
    }: {
      profileSummary: string;
      candidateName?: string;
      jobTitle?: string;
      context?: ContextKind;
      desiredCount?: number;
      minCount?: number;
    } = await req.json();

    if (!profileSummary || profileSummary.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Input text too short for skill extraction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating skills', { context, desiredCount, minCount, name: candidateName, title: jobTitle });

    const sharedCategories = `Extract skills in these categories:\n- technical: Programming languages, frameworks, methodologies, technical skills\n- tools: Software, platforms, applications (Figma, Adobe, Salesforce, Greenhouse, Ashby, etc.)\n- industries: Industry experience, domain knowledge, market sectors\n- titles: Job roles, positions, career levels they've held or could fill\n- soft: Leadership, communication, teamwork, problem-solving skills\n- certifications: Professional certifications, degrees, credentials`;

    const candidateSystem = `You are an expert recruiter and skills analyst. Analyze the candidate profile summary and extract structured skills data.\n\n${sharedCategories}\n\nReturn ONLY a valid JSON array of objects with this exact structure:\n[\n  {\n    "name": "React",\n    "category": "technical",\n    "confidence": 0.95\n  }\n]\n\nGuidelines:\n- Be specific and precise with skill names\n- Confidence should be 0.5-1.0 (only include skills you're confident about)\n- Focus on marketable, searchable skills\n- Include both explicit and implied skills\n- Aim to return between ${minCount} and ${desiredCount} of the most relevant skills total`;

    const jobSystem = `You are an expert recruiter and role classifier. Analyze the job title and description to (1) infer the role level, and (2) extract level-appropriate skills.\n\nLevels to choose from (pick the best fit): intern/trainee, individual contributor, senior ic, lead, manager, senior manager, director, senior director, vp, svp, c-level, volunteer.\n\n${sharedCategories}\n\nIMPORTANT: For management and leadership levels, prioritize leadership, management, stakeholder communication, hiring, mentoring, budgeting, and strategy. For IC levels, favor hands-on technical skills.\n\nReturn ONLY a valid JSON object with this exact structure:\n{\n  "role_level": { "level": "manager", "confidence": 0.85, "rationale": "..." },\n  "skills": [\n    { "name": "People Management", "category": "soft", "confidence": 0.9 },\n    { "name": "Strategic Planning", "category": "soft", "confidence": 0.85 }\n  ]\n}\n\nGuidelines:\n- Be specific and precise with skill names\n- Confidence should be 0.5-1.0 (only include skills you're confident about)\n- Focus on marketable, searchable skills\n- Include both explicit and implied skills\n- Return between ${minCount} and ${desiredCount} total skills, emphasizing the detected level`;

    const systemPrompt = context === 'job' ? jobSystem : candidateSystem;
    const userPrompt = context === 'job'
      ? `Job Title: ${jobTitle || 'Unknown'}\n\nJob Description:\n${profileSummary}`
      : `Candidate Profile: ${candidateName || 'Unknown'}\n\n${profileSummary}`;

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
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1400,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content?.trim?.() ?? '';
    console.log('Raw OpenAI response (truncated):', content.slice(0, 500));

    // Parse JSON; handle both array and object shapes and markdown code fences
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Invalid JSON response from AI');
      }
    }

    let aiSkills: SkillItem[] = [];
    let roleLevel: RoleLevel | undefined;

    if (Array.isArray(parsed)) {
      aiSkills = parsed as SkillItem[];
    } else if (parsed && typeof parsed === 'object') {
      aiSkills = (parsed.skills || []) as SkillItem[];
      roleLevel = parsed.role_level || parsed.roleLevel;
    }

    // Validate, clean, and filter
    const baseThreshold = context === 'job' ? 0.5 : 0.6;
    let validated = dedupeSkills(
      (aiSkills || [])
        .filter((s) => s && s.name && s.category && typeof s.confidence === 'number' && s.confidence >= baseThreshold)
    );

    // If under minCount, relax threshold and/or augment with fallbacks based on role level
    if (validated.length < minCount) {
      const relaxed = dedupeSkills(
        (aiSkills || []).filter((s) => s && s.name && s.category && typeof s.confidence === 'number' && s.confidence >= 0.3)
      );
      validated = dedupeSkills([...validated, ...relaxed]);
    }

    if (validated.length < minCount && context === 'job') {
      const fallbacks = fallbackSkillsForLevel(roleLevel?.level || (jobTitle || ''));
      validated = dedupeSkills([...validated, ...fallbacks]);
    }

    // Cap to desiredCount
    const limited = validated.slice(0, Math.max(minCount, desiredCount));

    const skillsByCategory = groupByCategory(limited);

    return new Response(
      JSON.stringify({
        skills: limited,
        skillsByCategory,
        totalCount: limited.length,
        generatedAt: new Date().toISOString(),
        ...(roleLevel ? { role_level: roleLevel } : {}),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in generate-comprehensive-skills function:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to generate skills', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
