
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const corsHeaders = createSecureCorsHeaders();

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
- profileSummary: A concise professional profile in Spanish (max 150 words).
  Include: years of experience, key areas of expertise, notable achievements.
  Format: Use bold for headings, italics for emphasis. Keep it brief and professional.

Structure for profileSummary:
**Nombre Completo**

*Professional headline (short, separated by vertical bars)*

**Ubicación:** País, Estado, Ciudad (if available)

---

**RESUMEN PROFESIONAL**
Brief 2-3 paragraph summary highlighting experience, expertise, and achievements (max 150 words total).

---

**EXPERIENCIA PROFESIONAL**
Company — *Position* | Dates
- 2-3 key bullet points with quantifiable achievements

---

**EDUCACIÓN**
Institution, Degree, Years

---

**COMPETENCIAS CLAVE**
- 3-5 core skills

Style: Use bold for section titles, italics for roles, keep concise.
Do not include extra commentary. Only the formatted profile.

Return ONLY JSON. Do not include markdown fences or commentary.`;

  const user = `Follow the instructions precisely to produce a robust, complete formatted profile in Spanish in the \"profileSummary\" field.\n\nFilename: ${fileName || 'unknown.pdf'}\nResume text:\n${text.slice(0, 12000)}`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 1000,
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
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

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
