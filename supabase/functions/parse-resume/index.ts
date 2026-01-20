
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const corsHeaders = createSecureCorsHeaders();

type ParseRequest = {
  textContent?: string;
  fileName?: string;
  mimeType?: string;
  mode?: 'quick' | 'full'; // 'quick' = regex only, 'full' = AI-powered (default)
};

type ParseResult = {
  name?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  location?: string;
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

function extractLinkedIn(text: string): string | undefined {
  // Try multiple patterns for better LinkedIn URL detection
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/gi,
    /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/gi,
    /linkedin\.com\/pub\/[a-zA-Z0-9_-]+/gi,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  
  return undefined;
}

function extractLocation(text: string): string | undefined {
  // Look for common location patterns in the resume text
  const patterns = [
    // "Location: City, State, Country" or similar
    /(?:^|\n)(?:Location|Ubicación|Address|Dirección):\s*([A-Z][^,\n]+(?:,\s*[A-Z][^,\n]+){1,2})/i,
    // In contact section
    /(?:City|Ciudad|Location):\s*([A-Z][a-zA-Z\s]+(?:,\s*[A-Z][a-zA-Z\s]+){0,2})/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  
  return undefined;
}

function quickExtract(text: string): ParseResult {
  // Fast regex-only extraction for quick mode
  const result: ParseResult = {
    email: extractEmail(text),
    phone: extractPhone(text),
    linkedinUrl: extractLinkedIn(text),
    location: extractLocation(text),
  };

  // More robust name extraction patterns
  const namePatterns = [
    // Spanish/Latin names with accents (e.g., "José García López")
    /^([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+(?:\s+[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+){1,4})\s*$/m,
    
    // ALL CAPS names at start (e.g., "JOHN SMITH")
    /^([A-ZÁÉÍÓÚÑÜ]{2,}(?:\s+[A-ZÁÉÍÓÚÑÜ]{2,}){1,3})\s*$/m,
    
    // Name followed by contact info or separator
    /^([A-Za-záéíóúñüÁÉÍÓÚÑÜ]+(?:\s+[A-Za-záéíóúñüÁÉÍÓÚÑÜ]+){1,4})[\s\n]*(?:[|\-–—]|Email|Correo|Phone|Tel|LinkedIn)/im,
    
    // Name at very first line (before any special chars)
    /^([A-Za-záéíóúñüÁÉÍÓÚÑÜ]{2,}(?:\s+[A-Za-záéíóúñüÁÉÍÓÚÑÜ]{2,}){1,3})\s*\n/,
    
    // Labeled name field
    /(?:Name|Nombre|Full Name|Nombre Completo):\s*([A-Za-záéíóúñüÁÉÍÓÚÑÜ]+(?:\s+[A-Za-záéíóúñüÁÉÍÓÚÑÜ]+){1,4})/i,
    
    // Simple mixed case name at start of line
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*$/m,
  ];

  // Search in first 800 characters for name
  const searchText = text.slice(0, 800);
  for (const pattern of namePatterns) {
    const match = searchText.match(pattern);
    if (match && match[1]) {
      // Normalize: Title Case if all caps
      let name = match[1].trim();
      if (name === name.toUpperCase()) {
        name = name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      }
      result.name = name;
      break;
    }
  }

  return result;
}

async function aiExtract(text: string, fileName?: string): Promise<ParseResult> {
  if (!OPENAI_API_KEY) {
    // Without an API key, return basic regex-based fields only
    return quickExtract(text);
  }

  const system = `You are an expert ATS resume parser.
Return ONLY valid JSON with these exact fields:
{name: string|optional, email: string|optional, phone: string|optional, linkedinUrl: string|optional, location: string|optional, profileSummary: string|optional}

CRITICAL: Extract ALL available fields. Do not omit fields even if confidence is medium.

- name: the candidate's full name if confidently found; otherwise omit.
- email: a primary contact email if present.
- phone: a primary phone in international format if possible.
- linkedinUrl: IMPORTANT - Full LinkedIn profile URL if present anywhere in the resume (e.g., https://linkedin.com/in/username). Check headers, contact sections, and links carefully.
- location: IMPORTANT - Current location formatted as "City, State/Province, Country" (e.g., "Mexico City, CDMX, Mexico" or "San Francisco, CA, United States"). Extract from any location field in the resume.
- profileSummary: A comprehensive, detailed professional profile in Spanish (aim for 200-300 words).
  Use rich markdown formatting: **bold** for headings/key skills, *italic* for emphasis, bullet lists for achievements.
  Structure with clear sections: opening statement, experience highlights, key competencies, notable achievements.
  Include quantifiable achievements where possible and unique value propositions.

Detailed Structure for profileSummary (200-300 words):
**Nombre Completo**

*Professional headline with key expertise areas (short, separated by vertical bars)*

**Ubicación:** País, Estado, Ciudad (if available)

---

**RESUMEN PROFESIONAL**
Comprehensive 2-3 paragraph summary covering:
- Career overview with years of experience
- Core areas of expertise and specializations
- Notable achievements with quantifiable impact
- Unique value propositions and strengths
Aim for depth and detail (150-200 words for this section).

---

**EXPERIENCIA PROFESIONAL**
Most recent/relevant positions (2-3):
**Company Name** — *Position Title* | Dates
- Key achievement with quantifiable results
- Major responsibility or project
- Impact or contribution to organization

---

**EDUCACIÓN**
Institution, Degree/Certification, Years
Include relevant certifications

---

**COMPETENCIAS CLAVE**
- Technical skills
- Domain expertise
- Soft skills
- Specialized knowledge areas

Style: Use **bold** for section titles and key roles, *italics* for emphasis, keep professional but detailed.
Do not include extra commentary. Only the formatted profile in Spanish with markdown.

REMEMBER: Always include linkedinUrl and location if found anywhere in the resume text.
Return ONLY JSON. Do not include markdown fences or commentary.`;

  const user = `Follow the instructions precisely to produce a robust, comprehensive formatted profile in Spanish (200-300 words) with rich markdown formatting in the \"profileSummary\" field.\n\nFilename: ${fileName || 'unknown.pdf'}\nResume text:\n${text.slice(0, 12000)}`;

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
      max_tokens: 2500,
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

  console.log('OpenAI raw response:', content);

  let parsed: ParseResult = {};
  try {
    parsed = JSON.parse(content);
    console.log('Parsed result:', JSON.stringify(parsed, null, 2));
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

  // Ensure email/phone/linkedinUrl/location if missing, using regex
  if (!parsed.email) parsed.email = extractEmail(text);
  if (!parsed.phone) parsed.phone = extractPhone(text);
  if (!parsed.linkedinUrl) parsed.linkedinUrl = extractLinkedIn(text);
  if (!parsed.location) parsed.location = extractLocation(text);

  // Minimal cleanup
  if (parsed.name) parsed.name = parsed.name.trim();
  if (parsed.linkedinUrl) parsed.linkedinUrl = parsed.linkedinUrl.trim();
  if (parsed.location) parsed.location = parsed.location.trim();
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

    const mode = body.mode || 'full';
    console.log('Parsing resume text. Mode:', mode, 'Approx length:', text.length, 'fileName:', body.fileName);

    // Quick mode: regex-only extraction (instant)
    if (mode === 'quick') {
      const result = quickExtract(text);
      console.log('Quick parse result:', JSON.stringify(result, null, 2));
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Full mode: AI-powered extraction
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
