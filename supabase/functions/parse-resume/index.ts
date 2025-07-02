import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedResumeData {
  candidate_name: string;
  linkedin_url: string;
  location_country: string;
  location_state: string;
  location_city: string;
  salary_amount: number | null;
  salary_currency: string;
  profile_summary: string;
  notes: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { fileContent, fileName, fileType } = await req.json();
    
    if (!fileContent) {
      throw new Error('No file content provided');
    }

    console.log(`Processing resume: ${fileName} (${fileType})`);

    // Extract text based on file type
    let extractedText = '';
    
    if (fileType === 'text/plain') {
      // For plain text files, decode base64
      extractedText = new TextDecoder().decode(
        Uint8Array.from(atob(fileContent), c => c.charCodeAt(0))
      );
    } else if (fileType === 'application/pdf') {
      // For PDF files, we'll need to extract text
      // For now, let's assume the content is already extracted text
      extractedText = new TextDecoder().decode(
        Uint8Array.from(atob(fileContent), c => c.charCodeAt(0))
      );
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // For DOCX files, basic text extraction
      extractedText = new TextDecoder().decode(
        Uint8Array.from(atob(fileContent), c => c.charCodeAt(0))
      );
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    console.log(`Extracted text length: ${extractedText.length} characters`);

    // Use OpenAI to parse the resume
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
            content: `You are an expert resume parsing AI. Extract structured information from resumes and return ONLY valid JSON with no markdown formatting.

CRITICAL INSTRUCTIONS:

1. LOCATION EXTRACTION - Look for location clues in:
   - Header addresses (street, city, state, zip codes)
   - Phone number area codes (e.g., 415 = San Francisco, 212 = New York)
   - Email domain endings (e.g., .uk = United Kingdom)
   - Explicitly mentioned locations in work experience
   - Current residence statements
   - Extract full location hierarchy: Country > State/Province > City

2. PROFILE SUMMARY CREATION - Generate a 4-6 sentence professional summary that includes:
   - Years of experience and primary expertise area
   - Key technical skills and competencies
   - Notable achievements or career highlights
   - Industry focus or specialization
   - Professional strengths and value proposition
   - Base this on actual resume content, don't make assumptions

3. SALARY EXTRACTION - Look for:
   - Salary expectations or requirements
   - Previous compensation mentioned
   - Hourly rates or annual figures
   - Extract number only, identify currency

4. DATA VALIDATION:
   - Ensure LinkedIn URLs are properly formatted
   - Validate location data makes geographic sense
   - Create meaningful profile summaries, not generic statements

REQUIRED JSON FIELDS:
- candidate_name: Full name (First Last format)
- linkedin_url: Complete LinkedIn URL or empty string
- location_country: Full country name
- location_state: State/Province/Region name  
- location_city: City name
- salary_amount: Numeric value only (no symbols)
- salary_currency: ISO currency code (USD, EUR, GBP, etc.)
- profile_summary: Professional summary (4-6 sentences)
- notes: Additional relevant information for recruiting team

Return empty string for missing text fields, null for missing numbers.`
          },
          {
            role: 'user',
            content: `Parse this resume and extract the information as JSON:\n\n${extractedText}`
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const aiResponse = await response.json();
    const parsedContent = aiResponse.choices[0].message.content;

    console.log('AI Response:', parsedContent);

    // Parse the JSON response
    let parsedData: ParsedResumeData;
    try {
      parsedData = JSON.parse(parsedContent);
    } catch (error) {
      console.error('Failed to parse AI response as JSON:', parsedContent);
      throw new Error('Failed to parse resume data from AI response');
    }

    // Validate and clean the data
    const cleanedData: ParsedResumeData = {
      candidate_name: parsedData.candidate_name || '',
      linkedin_url: parsedData.linkedin_url || '',
      location_country: parsedData.location_country || '',
      location_state: parsedData.location_state || '',
      location_city: parsedData.location_city || '',
      salary_amount: parsedData.salary_amount || null,
      salary_currency: parsedData.salary_currency || 'USD',
      profile_summary: parsedData.profile_summary || '',
      notes: parsedData.notes || ''
    };

    console.log('Parsed resume data:', cleanedData);

    return new Response(JSON.stringify({ 
      success: true, 
      data: cleanedData,
      fileName: fileName
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in parse-resume function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});