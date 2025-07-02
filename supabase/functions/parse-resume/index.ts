
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const openAIApiKey = Deno.env.get('OPENAI_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Parse resume function called')
    
    if (!openAIApiKey) {
      console.error('OpenAI API key not found')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'OpenAI API key not configured',
          data: null 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    let body
    try {
      body = await req.json()
    } catch (error) {
      console.error('Failed to parse request body:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request body',
          data: null 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    const { fileContent, fileName } = body
    
    console.log(`Processing resume: ${fileName}`)
    console.log(`File content type: ${typeof fileContent}`)
    console.log(`File content length: ${fileContent?.length || 0}`)
    
    if (!fileContent) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No file content provided',
          data: null 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    if (!fileName) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No file name provided',
          data: null 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Extract text from different file types
    let resumeText = ''
    
    try {
      if (fileName.toLowerCase().endsWith('.txt')) {
        // For text files, decode base64 if it's data URL format
        if (typeof fileContent === 'string' && fileContent.includes('data:')) {
          const base64Data = fileContent.split(',')[1]
          if (base64Data) {
            resumeText = atob(base64Data)
          } else {
            resumeText = fileContent
          }
        } else {
          // Try to decode as base64 first, if that fails treat as plain text
          try {
            resumeText = atob(fileContent)
          } catch {
            resumeText = fileContent
          }
        }
      } else if (fileName.toLowerCase().endsWith('.pdf') || fileName.toLowerCase().endsWith('.docx')) {
        // For PDF/DOCX, we'll treat the content as extracted text for now
        if (typeof fileContent === 'string' && fileContent.includes('data:')) {
          const base64Data = fileContent.split(',')[1]
          if (base64Data) {
            try {
              resumeText = atob(base64Data)
            } catch (e) {
              console.error('Failed to decode base64:', e)
              return new Response(
                JSON.stringify({ 
                  success: false, 
                  error: 'Unable to decode file content. Please ensure the file is properly formatted.',
                  data: null 
                }),
                { 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 400 
                }
              )
            }
          } else {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Invalid file format - no base64 data found',
                data: null 
              }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400 
              }
            )
          }
        } else {
          try {
            resumeText = atob(fileContent)
          } catch (e) {
            console.error('Failed to decode file content:', e)
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Unable to decode file content. Please try uploading a text file instead.',
                data: null 
              }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400 
              }
            )
          }
        }
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Unsupported file format. Please upload PDF, DOCX, or TXT files.',
            data: null 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      console.log(`Extracted text preview: ${resumeText.substring(0, 200)}...`)
      
      if (!resumeText.trim()) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'No text content found in the resume. Please ensure the file contains readable text.',
            data: null 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      if (resumeText.length < 10) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'File appears to be too short or may not contain readable text content.',
            data: null 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

    } catch (error) {
      console.error('Error processing file:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `File processing failed: ${error.message}`,
          data: null 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    console.log('Calling OpenAI API...')

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

    let aiResponse
    try {
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
            { role: 'user', content: `Parse this resume:\n\n${resumeText.substring(0, 4000)}` }
          ],
          temperature: 0.1,
          max_tokens: 1000,
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('OpenAI API error:', response.status, errorData)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `OpenAI API error: ${response.status}`,
            data: null 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }

      aiResponse = await response.json()
    } catch (error) {
      console.error('Error calling OpenAI API:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to call OpenAI API: ${error.message}`,
          data: null 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    const parsedContent = aiResponse.choices?.[0]?.message?.content

    if (!parsedContent) {
      console.error('No response from OpenAI')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No response from AI parser',
          data: null 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    console.log('AI response:', parsedContent)

    // Parse the JSON response
    let extractedData
    try {
      extractedData = JSON.parse(parsedContent)
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', parsedContent)
      console.error('JSON parse error:', e)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'AI returned invalid JSON format. Please try again.',
          data: null 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
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
    console.error('Unexpected error in parse-resume function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${error.message}`,
        data: null 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
