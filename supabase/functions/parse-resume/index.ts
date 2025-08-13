
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ParseRequest = {
  textContent?: string;
  fileName?: string;
  mimeType?: string;
};

type ParseResult = {
  name?: string;
  email?: string;
  phone?: string;
  profileSummary?: string;
};

function extractEmail(text: string): string | undefined {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : undefined;
}

function extractPhone(text: string): string | undefined {
  // Flexible, international-ish phone detection
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}/g;
  const matches = text.match(phoneRegex);
  if (!matches || matches.length === 0) return undefined;
  // Prefer a longer number
  return matches.sort((a, b) => b.replace(/\D/g, '').length - a.replace(/\D/g, '').length)[0];
}

async function aiExtract(text: string, fileName?: string): Promise<ParseResult> {
  if (!OPENAI_API_KEY) {
    // Without an API key, return basic regex-based fields only
    return {
      email: extractEmail(text),
      phone: extractPhone(text),
    };
  }

  const system = `You are an expert ATS resume parser.
Return ONLY valid JSON with these exact fields:
{name: string|optional, email: string|optional, phone: string|optional, profileSummary: string|optional}
- name: the candidate's full name if confidently found; otherwise omit.
- email: a primary contact email if present.
- phone: a primary phone in international format if possible.
- profileSummary: MUST be a professionally formatted candidate profile in Spanish, following EXACTLY the instructions below. The value must be a single string containing the full formatted profile (with line breaks).

Instructions for profileSummary (must follow EXACTLY):
You are an expert CV writer. Based on the resume provided, create a professionally formatted candidate profile in Spanish, following exactly this structure and style:

Full name (Title case, bold)

Professional headline (bold, short, separated by vertical bars)

Location (País, Estado, Ciudad, in bold after “Ubicación:”) 

Phone number 

Email (in markdown link format)

Salary expectation (in MXN, PEN, COP, CLP, or ARS, depending on candidate’s market, with “+ comisiones” if applicable)

LinkedIn link (markdown link format)

Then create these sections in order:

Perfil Profesional – A 2–3 paragraph summary (max 180 words) describing years of experience, regions worked (LATAM, NAM, EMEA if applicable), areas of expertise, tools mastered, sales methodologies applied, and professional strengths. The tone should be results-oriented, highlighting quantifiable achievements when possible.

Experiencia Profesional – Reverse chronological list of roles, each with:

Company name — Position title | Start month/year – End month/year

3 bullet points starting with action verbs, summarizing main achievements and responsibilities, with specific metrics where possible.

Educación – Institution name, degree, and years attended.

Competencias Clave – 5–6 bullet points with core skills relevant to the role, written in concise form.

Important style rules:
- Use “—” (em dash) between company and role.
- Use italics for role title.
- Use bold for dates and institution names.
- Keep a professional, concise tone.
- All section titles in bold and uppercase.
- Separate sections with a line break (“---”).
- Do not include any extra commentary, notes, or introductions. Only the formatted profile.

Now, using the resume provided, produce the final formatted profile exactly in this style and layout.

Return ONLY JSON. Do not include markdown fences or commentary.`;

  const user = `Follow the instructions precisely to produce a robust, complete formatted profile in Spanish in the \"profileSummary\" field.\n\nFilename: ${fileName || 'unknown.pdf'}\nResume text:\n${text.slice(0, 20000)}`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 1400,
    }),
  });

  if (!resp.ok) {
    console.error('OpenAI error status:', resp.status, await resp.text());
    // Fallback to regex-only
    return {
      email: extractEmail(text),
      phone: extractPhone(text),
    };
  }

  const data = await resp.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';

  let parsed: ParseResult = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch {
        parsed = {};
      }
    }
  }

  // Ensure email/phone if missing, using regex
  if (!parsed.email) parsed.email = extractEmail(text);
  if (!parsed.phone) parsed.phone = extractPhone(text);

  // Minimal cleanup
  if (parsed.name) parsed.name = parsed.name.trim();
  if (parsed.profileSummary) parsed.profileSummary = parsed.profileSummary.trim();

  return parsed;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ParseRequest;

    const text = (body.textContent || '').trim();
    if (!text || text.length < 30) {
      return new Response(JSON.stringify({ error: 'Text content is empty or too short to parse' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Parsing resume text. Approx length:', text.length, 'fileName:', body.fileName);

    const result = await aiExtract(text, body.fileName);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('parse-resume error:', err);
    return new Response(JSON.stringify({ error: 'Failed to parse resume' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
