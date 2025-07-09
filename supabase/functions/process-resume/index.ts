import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("🚀 Resume processing started");

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Step 1: Extract file from form data
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.error("❌ No file provided");
      return new Response("No file provided", { status: 400, headers: corsHeaders });
    }

    if (!file.type.includes("pdf")) {
      console.error("❌ File is not a PDF:", file.type);
      return new Response("Only PDF files are allowed", { status: 400, headers: corsHeaders });
    }

    console.log(`📄 Processing file: ${file.name} (${file.size} bytes)`);

    // Step 2: Extract text from PDF using pdf-parse
    console.log("📝 Extracting text from PDF...");
    
    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);
    
    // Import pdf-parse dynamically
    const { default: pdfParse } = await import("https://deno.land/x/pdf_parse@1.1.9/mod.ts");
    
    let resumeText = "";
    try {
      const pdfData = await pdfParse(uint8Array);
      resumeText = pdfData.text;
      console.log(`📝 Text extracted successfully: ${resumeText.length} characters`);
    } catch (pdfError) {
      console.error("❌ PDF parsing failed:", pdfError);
      return new Response("Failed to extract text from PDF", { status: 500, headers: corsHeaders });
    }

    if (!resumeText.trim()) {
      console.error("❌ No text content extracted from PDF");
      return new Response("No text content found in PDF", { status: 400, headers: corsHeaders });
    }

    // Step 10: Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error("❌ OpenAI API key not configured");
      return new Response("OpenAI API key not configured", { status: 500, headers: corsHeaders });
    }

    // Step 11: Send to OpenAI for structured extraction
    console.log("🧠 Sending prompt to OpenAI");

    const openAIPrompt = `You are an expert in resume analysis and hiring systems.

Below is the full extracted text of a candidate's resume. Please extract and return structured profile data.

RESUME:
"""
${resumeText}
"""

Respond with valid JSON:
{
  "candidate_name": "Full name of candidate",
  "email": "Email if available",
  "phone": "Phone number if available",
  "linkedin_url": "LinkedIn profile URL if available",
  "location_city": "City",
  "location_state": "State or region",
  "location_country": "Country",
  "salary_amount": null,
  "salary_currency": "USD",
  "salary_period": "monthly | yearly | hourly",
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "profile_summary": {
    "about_me": "Short paragraph from resume intro",
    "experience_highlights": [
      "Company A - Role - Dates - 1-sentence summary",
      "Company B - Role - Dates - 1-sentence summary"
    ],
    "key_competencies": ["Competency 1", "Competency 2"]
  }
}`;

    const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that extracts structured data from resumes. Always respond with valid JSON only.' },
          { role: 'user', content: openAIPrompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!openAIRes.ok) {
      const openAIError = await openAIRes.text();
      console.error("❌ OpenAI API failed:", openAIRes.status, openAIError);
      return new Response("OpenAI API failed", { status: 500, headers: corsHeaders });
    }

    const openAIData = await openAIRes.json();
    const aiContent = openAIData.choices[0].message.content;

    let structuredProfile;
    try {
      structuredProfile = JSON.parse(aiContent);
      console.log("✅ OpenAI returned structured profile");
    } catch (parseError) {
      console.error("❌ OpenAI failed to respond or returned malformed JSON:", parseError);
      return new Response("Failed to parse AI response", { status: 500, headers: corsHeaders });
    }

    // Step 12: Return final structured profile
    return new Response(
      JSON.stringify({
        success: true,
        structured_profile: structuredProfile
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        }, 
        status: 200 
      }
    );

  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
    return new Response(
      `Unexpected error: ${error.message}`, 
      { status: 500, headers: corsHeaders }
    );
  }
});