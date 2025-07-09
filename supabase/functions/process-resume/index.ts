import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple PDF text extraction using basic pattern matching
async function extractPDFText(uint8Array: Uint8Array, fileName: string): Promise<string> {
  try {
    console.log("📄 Starting PDF text extraction...");
    
    // Convert PDF bytes to string for pattern matching
    const pdfString = new TextDecoder('latin1').decode(uint8Array);
    
    // Extract text patterns from PDF structure
    const textPatterns = [
      // Text objects in PDF format: (text content)
      /\(((?:[^()\\]|\\.|\\[0-7]{1,3})*)\)/g,
      // Bracket text: [text content]
      /\[((?:[^\[\]\\]|\\.|\\[0-7]{1,3})*)\]/g,
      // Direct text streams
      /BT\s+.*?ET/gs,
    ];
    
    let extractedText = '';
    
    // Try each pattern
    for (const pattern of textPatterns) {
      const matches = [...pdfString.matchAll(pattern)];
      if (matches.length > 0) {
        const texts = matches
          .map(match => match[1] || match[0])
          .filter(text => text && text.length > 1)
          .map(text => text
            .replace(/\\[nr]/g, ' ')
            .replace(/\\[t]/g, ' ')
            .replace(/\\(.)/g, '$1')
            .trim()
          )
          .filter(text => /[a-zA-Z]/.test(text) && text.length > 2);
        
        if (texts.length > 0) {
          extractedText = texts.join(' ').replace(/\s+/g, ' ').trim();
          break;
        }
      }
    }
    
    // Fallback: extract any readable strings
    if (!extractedText || extractedText.length < 50) {
      console.log("🔍 Trying fallback string extraction...");
      const readableStrings = pdfString
        .split(/[\x00-\x1F\x7F-\xFF]/)
        .filter(str => str.length > 3 && /[a-zA-Z]/.test(str))
        .map(str => str.trim())
        .filter(str => str.length > 3);
      
      extractedText = readableStrings.slice(0, 100).join(' ').replace(/\s+/g, ' ').trim();
    }
    
    console.log(`📝 Extracted ${extractedText.length} characters from PDF`);
    
    // Quality check
    if (extractedText.length > 50) {
      const wordCount = extractedText.split(/\s+/).length;
      const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(extractedText);
      const hasPhone = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(extractedText);
      
      if (wordCount > 10 && (hasEmail || hasPhone || wordCount > 20)) {
        return extractedText;
      }
    }
    
    // If extraction failed or quality is poor
    return `Resume: ${fileName}

Basic text extraction completed but content appears limited. This may be:
• An image-based or scanned PDF
• A PDF with complex formatting
• A password-protected document

File size: ${(uint8Array.length / 1024).toFixed(1)} KB

Please ensure the PDF contains selectable text, or consider converting it to a text-based format.`;
    
  } catch (error) {
    console.error("❌ PDF text extraction failed:", error);
    return `Resume: ${fileName}

Text extraction failed due to: ${error.message}

This may be due to:
• Corrupted PDF file
• Unsupported PDF format
• Complex document structure

Please try re-uploading or using a different PDF format.`;
  }
}

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
      return new Response(JSON.stringify({ 
        error: "No file provided",
        success: false 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!file.type.includes("pdf")) {
      console.error("❌ File is not a PDF:", file.type);
      return new Response(JSON.stringify({ 
        error: "Only PDF files are allowed",
        success: false 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`📄 Processing file: ${file.name} (${file.size} bytes)`);

    // Step 2: Simple PDF text extraction
    console.log("📝 Starting PDF text extraction...");
    
    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);
    
    const resumeText = await extractPDFText(uint8Array, file.name);
    console.log(`📝 Text extraction completed: ${resumeText.length} characters`);


    // Step 3: Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error("❌ OpenAI API key not configured");
      return new Response(JSON.stringify({
        error: "OpenAI API key not configured",
        success: false
      }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Step 4: Send to OpenAI for structured extraction
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
      return new Response(JSON.stringify({
        error: "OpenAI API failed",
        details: openAIError,
        success: false
      }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const openAIData = await openAIRes.json();
    const aiContent = openAIData.choices[0].message.content;

    let structuredProfile;
    try {
      structuredProfile = JSON.parse(aiContent);
      console.log("✅ OpenAI returned structured profile");
    } catch (parseError) {
      console.error("❌ OpenAI failed to respond with valid JSON:", parseError);
      console.error("❌ AI Response:", aiContent);
      return new Response(JSON.stringify({
        error: "Failed to parse AI response",
        details: parseError.message,
        success: false
      }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Step 5: Return final structured profile
    console.log("✅ Resume processing completed successfully");
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
    console.error("❌ Error stack:", error.stack);
    return new Response(
      JSON.stringify({
        error: `Unexpected error: ${error.message}`,
        success: false
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});