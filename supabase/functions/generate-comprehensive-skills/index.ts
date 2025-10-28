import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const corsHeaders = createSecureCorsHeaders();

interface SkillItem {
  name: string; // localized label
  canonical?: string; // English canonical label for matching
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

function canonicalKey(skill: SkillItem): string {
  const key = sanitizeName(skill.canonical || skill.name).toLowerCase();
  return key;
}

function dedupeSkills(skills: SkillItem[]): SkillItem[] {
  const seen = new Set<string>();
  const out: SkillItem[] = [];
  for (const s of skills) {
    const key = canonicalKey(s);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...s, name: sanitizeName(s.name), canonical: s.canonical ? sanitizeName(s.canonical) : undefined, source: 'ai_generated' });
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
      { name: 'People Management', canonical: 'People Management', category: 'soft', confidence: 0.7 },
      { name: 'Team Leadership', canonical: 'Team Leadership', category: 'soft', confidence: 0.7 },
      { name: 'Stakeholder Management', canonical: 'Stakeholder Management', category: 'soft', confidence: 0.65 },
      { name: 'Project Management', canonical: 'Project Management', category: 'soft', confidence: 0.65 },
      { name: 'Hiring & Onboarding', canonical: 'Hiring & Onboarding', category: 'soft', confidence: 0.6 },
      { name: 'Coaching & Mentoring', canonical: 'Coaching & Mentoring', category: 'soft', confidence: 0.6 },
      { name: 'Performance Management', canonical: 'Performance Management', category: 'soft', confidence: 0.6 },
      { name: 'Cross-functional Collaboration', canonical: 'Cross-functional Collaboration', category: 'soft', confidence: 0.6 },
      { name: 'Strategic Planning', canonical: 'Strategic Planning', category: 'soft', confidence: 0.6 },
      { name: 'Budgeting', canonical: 'Budgeting', category: 'soft', confidence: 0.6 },
    ];
  }
  if (lvl.includes('director')) {
    return [
      { name: 'Strategic Leadership', canonical: 'Strategic Leadership', category: 'soft', confidence: 0.7 },
      { name: 'Org Design', canonical: 'Organizational Design', category: 'soft', confidence: 0.65 },
      { name: 'Portfolio Management', canonical: 'Portfolio Management', category: 'soft', confidence: 0.65 },
      { name: 'Budget Ownership', canonical: 'Budget Ownership', category: 'soft', confidence: 0.65 },
      { name: 'Executive Communication', canonical: 'Executive Communication', category: 'soft', confidence: 0.65 },
      { name: 'Change Management', canonical: 'Change Management', category: 'soft', confidence: 0.6 },
      { name: 'Roadmap Prioritization', canonical: 'Roadmap Prioritization', category: 'soft', confidence: 0.6 },
    ];
  }
  if (lvl.includes('vp') || lvl.includes('vice') || lvl.includes('cxo') || lvl.includes('chief') || lvl.includes('c-level')) {
    return [
      { name: 'Executive Leadership', canonical: 'Executive Leadership', category: 'soft', confidence: 0.7 },
      { name: 'Vision & Strategy', canonical: 'Vision & Strategy', category: 'soft', confidence: 0.7 },
      { name: 'Board Communication', canonical: 'Board Communication', category: 'soft', confidence: 0.65 },
      { name: 'P&L Management', canonical: 'P&L Management', category: 'soft', confidence: 0.65 },
      { name: 'Organizational Scaling', canonical: 'Organizational Scaling', category: 'soft', confidence: 0.6 },
    ];
  }
  if (lvl.includes('lead')) {
    return [
      { name: 'Technical Leadership', canonical: 'Technical Leadership', category: 'soft', confidence: 0.65 },
      { name: 'Mentoring', canonical: 'Mentoring', category: 'soft', confidence: 0.6 },
      { name: 'Sprint Planning', canonical: 'Sprint Planning', category: 'soft', confidence: 0.6 },
      { name: 'Code Review', canonical: 'Code Review', category: 'technical', confidence: 0.6 },
    ];
  }
  if (lvl.includes('intern') || lvl.includes('trainee')) {
    return [
      { name: 'Fast Learning', canonical: 'Fast Learning', category: 'soft', confidence: 0.6 },
      { name: 'Collaboration', canonical: 'Collaboration', category: 'soft', confidence: 0.6 },
      { name: 'Time Management', canonical: 'Time Management', category: 'soft', confidence: 0.6 },
      { name: 'Documentation', canonical: 'Documentation', category: 'soft', confidence: 0.6 },
    ];
  }
  if (lvl.includes('volunteer')) {
    return [
      { name: 'Community Engagement', canonical: 'Community Engagement', category: 'soft', confidence: 0.6 },
      { name: 'Event Coordination', canonical: 'Event Coordination', category: 'soft', confidence: 0.6 },
      { name: 'Fundraising', canonical: 'Fundraising', category: 'soft', confidence: 0.6 },
      { name: 'Outreach', canonical: 'Outreach', category: 'soft', confidence: 0.6 },
    ];
  }
  return [
    { name: 'Problem Solving', canonical: 'Problem Solving', category: 'soft', confidence: 0.6 },
    { name: 'Communication', canonical: 'Communication', category: 'soft', confidence: 0.6 },
    { name: 'Collaboration', canonical: 'Collaboration', category: 'soft', confidence: 0.6 },
    { name: 'Ownership', canonical: 'Ownership', category: 'soft', confidence: 0.6 },
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

    const sharedCategories = `Extract skills in these categories:
- technical: Programming languages, frameworks, methodologies, technical skills
- tools: Software, platforms, applications (Figma, Adobe, Salesforce, Greenhouse, Ashby, etc.)
- industries: Industry experience, domain knowledge, market sectors (e.g., SaaS, Fintech, Automotive)
- titles: Job roles, positions, career levels they've held or could fill
- soft: Leadership, communication, teamwork, problem-solving skills
- certifications: Professional certifications, degrees, credentials`;

    const candidateSystem = `You are an expert multilingual recruiter and skills analyst.
Detect the input language automatically and extract structured skills data.

${sharedCategories}

Return ONLY a valid JSON array of objects with this exact structure:
[
  {
    "name": "Gestión de Proyectos",
    "canonical": "Project Management",
    "category": "technical",
    "confidence": 0.95
  }
]

Guidelines:
- "name" must be in the source language (localized label).
- "canonical" must be English and standardized for matching.
- Include "industries" inline (do not separate them from other skills).
- Confidence should be 0.5-1.0 (only include skills you're confident about).
- Be specific and marketable; include explicit and implied skills.
- Aim to return between ${minCount} and ${desiredCount} total skills, blending technical, tools, industries, soft, and titles as appropriate.`;

    const jobSystem = `You are an expert multilingual recruiter and role classifier.
Detect the input language automatically and (1) infer the role level, and (2) extract level-appropriate skills, including industries inline.

Levels to choose from (pick the best fit): intern/trainee, individual contributor, senior ic, lead, manager, senior manager, director, senior director, vp, svp, c-level, volunteer.

${sharedCategories}

IMPORTANT: For management and leadership levels, prioritize leadership, management, stakeholder communication, hiring, mentoring, budgeting, and strategy. For IC levels, favor hands-on technical skills.

Return ONLY a valid JSON object with this exact structure:
{
  "role_level": { "level": "manager", "confidence": 0.85, "rationale": "..." },
  "skills": [
    { "name": "Gestión de Personas", "canonical": "People Management", "category": "soft", "confidence": 0.9 },
    { "name": "Planificación Estratégica", "canonical": "Strategic Planning", "category": "soft", "confidence": 0.85 }
  ]
}

Guidelines:
- "name" must be localized; "canonical" must be English.
- Include "industries" inline, sized for relevance to the role.
- Confidence should be 0.5-1.0.
- Return between ${minCount} and ${desiredCount} skills emphasizing the detected level.`;

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
        max_tokens: 1200,
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
      (aiSkills || []).filter((s) =>
        s &&
        s.name &&
        s.category &&
        typeof s.confidence === 'number' &&
        s.confidence >= baseThreshold
      ).map((s) => ({
        ...s,
        name: sanitizeName(s.name),
        canonical: s.canonical ? sanitizeName(s.canonical) : undefined,
      }))
    );

    // If under minCount, relax threshold and/or augment with fallbacks based on role level
    if (validated.length < minCount) {
      const relaxed = dedupeSkills(
        (aiSkills || []).filter((s) =>
          s && s.name && s.category && typeof s.confidence === 'number' && s.confidence >= 0.3
        ).map((s) => ({
          ...s,
          name: sanitizeName(s.name),
          canonical: s.canonical ? sanitizeName(s.canonical) : undefined,
        }))
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
