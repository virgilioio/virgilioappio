
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { fileContent, fileName } = await req.json()
    
    if (!fileContent) {
      throw new Error('No file content provided')
    }

    console.log(`Processing resume: ${fileName}`)

    // Extract text from different file types
    let resumeText = ''
    
    if (fileName.toLowerCase().endsWith('.txt')) {
      // For text files, decode base64
      resumeText = atob(fileContent.split(',')[1] || fileContent)
    } else if (fileName.toLowerCase().endsWith('.pdf') || fileName.toLowerCase().endsWith('.docx')) {
      // For PDF/DOCX, we'll treat the content as extracted text for now
      // In a production environment, you'd use proper PDF/DOCX parsing libraries
      resumeText = atob(fileContent.split(',')[1] || fileContent)
    } else {
      throw new Error('Unsupported file format. Please upload PDF, DOCX, or TXT files.')
    }

    if (!resumeText.trim()) {
      throw new Error('No text content found in the resume')
    }

    console.log('Extracted text length:', resumeText.length)

    // Use OpenAI to parse the resume
    const systemPrompt = `You are an expert resume parser. Extract key information from resumes and return it as structured JSON. 

Return ONLY valid JSON in this exact format:
{
  "candidate_name": "Full name of the candidate",
  "location_country": "Country name",
  "location_state": "State/Province name", 
  "location_city": "City name",
  "salary_amount": "Annual salary as number (no currency symbols)",
  "salary_currency": "Currency code like USD, EUR, etc",
  "salary_period": "annually, monthly, or hourly",
  "profile_summary": "Professional summary or bio (2-3 sentences)",
  "linkedin_url": "LinkedIn profile URL if found",
  "extracted_skills": "Comma-separated list of key skills",
  "years_experience": "Total years of experience as number"
}

Rules:
- Return null for fields not found or unclear
- For salary, extract any mentioned compensation
- For location, extract current location or preferred location
- For profile_summary, create a concise professional summary based on the resume content
- Only include LinkedIn URLs that are clearly stated
- Be conservative - if unsure, return null`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Parse this resume:\n\n${resumeText}` }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenAI API error:', errorData)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const aiResponse = await response.json()
    const parsedContent = aiResponse.choices[0]?.message?.content

    if (!parsedContent) {
      throw new Error('No response from AI parser')
    }

    console.log('AI response:', parsedContent)

    // Parse the JSON response
    let extractedData
    try {
      extractedData = JSON.parse(parsedContent)
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', parsedContent)
      throw new Error('AI returned invalid JSON format')
    }

    // Clean and validate the extracted data
    const cleanedData = {
      candidate_name: extractedData.candidate_name || null,
      location_country: extractedData.location_country || null,
      location_state: extractedData.location_state || null,
      location_city: extractedData.location_city || null,
      salary_amount: extractedData.salary_amount ? Number(extractedData.salary_amount) : null,
      salary_currency: extractedData.salary_currency || 'USD',
      salary_period: extractedData.salary_period || 'annually',
      profile_summary: extractedData.profile_summary || null,
      linkedin_url: extractedData.linkedin_url || null,
      extracted_skills: extractedData.extracted_skills || null,
      years_experience: extractedData.years_experience ? Number(extractedData.years_experience) : null,
      notes: extractedData.extracted_skills ? `Skills: ${extractedData.extracted_skills}${extractedData.years_experience ? `\nExperience: ${extractedData.years_experience} years` : ''}` : null
    }

    console.log('Cleaned extracted data:', cleanedData)

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: cleanedData,
        message: 'Resume parsed successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error parsing resume:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to parse resume',
        data: null 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
