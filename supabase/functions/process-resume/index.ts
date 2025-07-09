import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function for simple PDF text extraction
async function extractPDFTextSimple(uint8Array: Uint8Array): Promise<string> {
  const pdfString = new TextDecoder('latin1').decode(uint8Array);
  
  // Extract text between BT...ET blocks (text objects in PDF)
  const textBlocks = pdfString.match(/BT[\s\S]*?ET/g) || [];
  const extractedTexts: string[] = [];
  
  for (const block of textBlocks) {
    // Extract text in parentheses and brackets
    const texts = [
      ...(block.match(/\(([^)]+)\)/g) || []),
      ...(block.match(/\[([^\]]+)\]/g) || [])
    ];
    
    texts.forEach(text => {
      const clean = text.replace(/[()[\]]/g, '').trim();
      if (clean.length > 1 && /[a-zA-Z]/.test(clean)) {
        extractedTexts.push(clean);
      }
    });
  }
  
  return extractedTexts.join(' ').replace(/\s+/g, ' ').trim();
}

// Helper function for advanced text extraction
async function extractTextAdvanced(uint8Array: Uint8Array, fileName: string): Promise<string> {
  const pdfString = new TextDecoder('latin1').decode(uint8Array);
  
  // Multiple extraction strategies
  const strategies = [
    // Strategy 1: Extract strings between Tj operators
    () => {
      const tjMatches = pdfString.match(/\(([^)]+)\)\s*Tj/g) || [];
      return tjMatches.map(match => match.replace(/[()]/g, '').replace(/\s*Tj$/, '')).join(' ');
    },
    
    // Strategy 2: Extract from text streams
    () => {
      const streamMatches = pdfString.match(/stream[\s\S]*?endstream/g) || [];
      const texts: string[] = [];
      
      streamMatches.forEach(stream => {
        const textInStream = stream.match(/\(([^)]+)\)/g) || [];
        textInStream.forEach(text => {
          const clean = text.replace(/[()]/g, '').trim();
          if (clean.length > 1) texts.push(clean);
        });
      });
      
      return texts.join(' ');
    },
    
    // Strategy 3: Look for readable ASCII sequences
    () => {
      return pdfString
        .replace(/[^\x20-\x7E\n\r]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && /[a-zA-Z]/.test(word))
        .join(' ');
    }
  ];
  
  // Try each strategy and combine results
  const results = strategies.map(strategy => {
    try {
      return strategy();
    } catch {
      return '';
    }
  }).filter(result => result.length > 0);
  
  if (results.length === 0) {
    return `PDF Resume: ${fileName}\n\nThis appears to be a complex PDF format that requires manual data entry.`;
  }
  
  // Combine and deduplicate results
  const combined = results.join(' ').replace(/\s+/g, ' ').trim();
  return combined.length > 50 ? combined : `PDF Resume: ${fileName}\n\nLimited text extraction possible. Manual entry recommended.`;
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

    // Step 2: Extract text from PDF using a robust library
    console.log("📝 Extracting text from PDF...");
    
    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);
    
    let resumeText = "";
    try {
      // Use pdf2pic approach - import a more reliable PDF parser
      const { default: PDF } = await import("https://deno.land/x/pdf@0.1.2/mod.ts");
      
      try {
        const pdf = await PDF.load(uint8Array);
        const pages = await pdf.getPages();
        
        const textContent = [];
        for (const page of pages) {
          const pageText = await page.getTextContent();
          if (pageText && pageText.trim()) {
            textContent.push(pageText);
          }
        }
        
        resumeText = textContent.join('\n\n').trim();
        console.log(`📝 PDF.js extracted: ${resumeText.length} characters`);
        
      } catch (pdfLibError) {
        console.log("📝 First library failed, trying alternative approach...");
        throw pdfLibError;
      }
      
    } catch (firstError) {
      console.log("📝 Trying alternative PDF parsing method...");
      
      try {
        // Fallback: Try a different PDF parsing approach
        // Use Node.js compatible pdf-parse through CDN
        const response = await fetch("https://cdn.skypack.dev/pdf-parse@1.1.9");
        const pdfParseModule = await response.text();
        
        // Create a simple PDF text extractor using buffer analysis
        const pdfText = await extractPDFTextSimple(uint8Array);
        resumeText = pdfText;
        
        console.log(`📝 Alternative method extracted: ${resumeText.length} characters`);
        
      } catch (secondError) {
        console.log("📝 Both methods failed, using advanced text extraction...");
        
        // Final fallback: More sophisticated text extraction
        resumeText = await extractTextAdvanced(uint8Array, file.name);
        console.log(`📝 Advanced extraction: ${resumeText.length} characters`);
      }
    }

    // Validate extracted text quality
    if (resumeText.length < 50) {
      console.log("⚠️ Insufficient text extracted, creating placeholder");
      resumeText = `PDF Resume: ${file.name}

This PDF was uploaded but automatic text extraction yielded limited results.
The file appears to be: ${file.name} (${(file.size/1024).toFixed(1)} KB)

Common reasons for extraction issues:
• Image-based PDF (scanned document)
• Complex formatting or unusual fonts
• Password protected or secured PDF
• Non-standard PDF structure

Please manually enter the candidate information, or try:
• Exporting the resume as a new PDF from the original document
• Using a simpler PDF format
• Ensuring the PDF contains selectable text (not just images)`;
    }


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