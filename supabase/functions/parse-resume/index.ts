
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const openAIApiKey = Deno.env.get('OPENAI_API_KEY')

// Simple PDF text extraction function
function extractPDFText(pdfBuffer: Uint8Array): string {
  try {
    // Convert buffer to string and look for text content
    const pdfString = new TextDecoder('latin1').decode(pdfBuffer)
    
    // Basic PDF text extraction - look for text between stream objects
    const textMatches = pdfString.match(/BT\s+.*?ET/gs) || []
    let extractedText = ""
    
    for (const match of textMatches) {
      // Extract text from PDF text objects
      const textContent = match.match(/\(([^)]+)\)/g) || []
      for (const text of textContent) {
        extractedText += text.replace(/[()]/g, "") + " "
      }
    }
    
    // If basic extraction fails, try alternative method
    if (!extractedText.trim()) {
      const streamMatches = pdfString.match(/stream\s+(.*?)\s+endstream/gs) || []
      for (const stream of streamMatches) {
        const cleanStream = stream.replace(/stream|endstream/g, "").trim()
        // Look for readable text patterns
        const readableText = cleanStream.match(/[A-Za-z0-9\s@.,;:()!?-]{10,}/g) || []
        extractedText += readableText.join(" ") + " "
      }
    }
    
    return extractedText.trim()
  } catch (error) {
    console.error('PDF extraction error:', error)
    return ""
  }
}

// Simple DOCX text extraction function
function extractDOCXText(docxBuffer: Uint8Array): string {
  try {
    // Convert buffer to string and look for XML content
    const docxString = new TextDecoder('utf-8').decode(docxBuffer)
    
    // Basic DOCX text extraction - look for text in w:t elements
    const textMatches = docxString.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
    let extractedText = ""
    
    for (const match of textMatches) {
      const text = match.replace(/<[^>]*>/g, "")
      if (text.trim()) {
        extractedText += text + " "
      }
    }
    
    // Alternative extraction method if the first one fails
    if (!extractedText.trim()) {
      const paragraphMatches = docxString.match(/<w:p[^>]*>.*?<\/w:p>/gs) || []
      for (const paragraph of paragraphMatches) {
        const cleanText = paragraph.replace(/<[^>]*>/g, "").trim()
        if (cleanText && cleanText.length > 2) {
          extractedText += cleanText + " "
        }
      }
    }
    
    return extractedText.trim()
  } catch (error) {
    console.error('DOCX extraction error:', error)
    return ""
  }
}

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
          error: 'OpenAI API key not configured. Please configure the OPENAI_API_KEY secret.',
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
      console.log('Request body received:', { 
        hasFileContent: !!body.fileContent, 
        fileName: body.fileName,
        contentType: typeof body.fileContent,
        contentLength: body.fileContent?.length
      })
    } catch (error) {
      console.error('Failed to parse request body:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request body. Please ensure the request contains valid JSON.',
          data: null 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    const { fileContent, fileName } = body
    
    if (!fileContent) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No file content provided. Please select a file to upload.',
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
          error: 'No file name provided. Please ensure a valid file is selected.',
          data: null 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    const fileExtension = fileName.toLowerCase().split('.').pop()
    console.log('Processing file:', fileName, 'Extension:', fileExtension)

    let resumeText = ''
    
    try {
      if (fileExtension === 'txt') {
        // Handle text files
        if (fileContent.startsWith('data:')) {
          const base64Data = fileContent.split(',')[1]
          if (!base64Data) {
            throw new Error('Invalid data URL format')
          }
          resumeText = atob(base64Data)
        } else {
          // Assume it's already base64 encoded
          try {
            resumeText = atob(fileContent)
          } catch {
            // If atob fails, treat as plain text
            resumeText = fileContent
          }
        }
      } else if (fileExtension === 'pdf') {
        // Handle PDF files
        let base64Data = fileContent
        if (fileContent.startsWith('data:')) {
          base64Data = fileContent.split(',')[1]
        }
        
        if (!base64Data) {
          throw new Error('Invalid PDF data format')
        }
        
        // Convert base64 to binary buffer
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        
        console.log('Extracting text from PDF, size:', bytes.length, 'bytes')
        resumeText = extractPDFText(bytes)
        
      } else if (fileExtension === 'docx') {
        // Handle DOCX files
        let base64Data = fileContent
        if (fileContent.startsWith('data:')) {
          base64Data = fileContent.split(',')[1]
        }
        
        if (!base64Data) {
          throw new Error('Invalid DOCX data format')
        }
        
        // Convert base64 to binary buffer
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        
        console.log('Extracting text from DOCX, size:', bytes.length, 'bytes')
        resumeText = extractDOCXText(bytes)
        
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Unsupported file format: .${fileExtension}. Please upload PDF, DOCX, or TXT files.`,
            data: null 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      console.log('Extracted text length:', resumeText.length)
      console.log('Text preview:', resumeText.substring(0, 200))
      
      if (!resumeText.trim()) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'No readable text found in the file. Please ensure the file contains text content or try a different file format.',
            data: null 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      if (resumeText.length < 50) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'The extracted text appears to be too short. Please ensure the file contains a complete resume.',
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
          error: `File processing failed: ${error.message}. Please try a different file or format.`,
          data: null 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    console.log('Calling OpenAI API for text analysis...')

    const systemPrompt = `You are an expert resume parser. Extract key information from resumes and return it as structured JSON. 

Analyze the provided resume text and extract the following information. Return ONLY valid JSON in this exact format:

{
  "candidate_name": "Full name of the candidate",
  "location_country": "Country name only",
  "location_state": "State/Province name only", 
  "location_city": "City name only",
  "salary_amount": null,
  "salary_currency": "USD",
  "salary_period": "annually",
  "profile_summary": "Professional summary or bio based on resume content (2-3 sentences)",
  "linkedin_url": "LinkedIn profile URL if clearly stated",
  "extracted_skills": "Comma-separated list of key technical and professional skills",
  "years_experience": "Total years of professional experience as number"
}

Rules:
- Return null for fields not found or unclear (except defaults for currency/period)
- For location, extract current location or preferred work location
- Create a concise professional summary based on the resume content even if not explicitly stated
- Only include LinkedIn URLs that are clearly stated in the resume
- For skills, extract both technical skills and key professional competencies
- For years of experience, calculate based on work history dates
- Be conservative - if unsure about a field, return null
- Ensure all JSON is properly formatted and valid`

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
            { role: 'user', content: `Parse this resume text and extract the requested information:\n\n${resumeText.substring(0, 6000)}` }
          ],
          temperature: 0.1,
          max_tokens: 1500,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('OpenAI API error:', response.status, response.statusText, errorText)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `AI processing failed (${response.status}). Please try again or contact support.`,
            data: null 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }

      aiResponse = await response.json()
      console.log('OpenAI response received:', { 
        hasChoices: !!aiResponse.choices,
        choicesLength: aiResponse.choices?.length 
      })

    } catch (error) {
      console.error('Error calling OpenAI API:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `AI service connection failed: ${error.message}. Please try again.`,
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
      console.error('No response content from OpenAI')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'AI parsing service returned no response. Please try again.',
          data: null 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    console.log('AI response content:', parsedContent.substring(0, 500))

    let extractedData
    try {
      // Clean the response to ensure it's valid JSON
      const cleanedContent = parsedContent.trim()
      extractedData = JSON.parse(cleanedContent)
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', parsedContent)
      console.error('JSON parse error:', e)
      
      // Try to extract JSON from the response if it's wrapped in other text
      const jsonMatch = parsedContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          extractedData = JSON.parse(jsonMatch[0])
        } catch (e2) {
          console.error('Failed to parse extracted JSON:', e2)
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'AI returned invalid data format. Please try again with a different resume.',
              data: null 
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500 
            }
          )
        }
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'AI parsing failed to return structured data. Please try again.',
            data: null 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
    }

    // Validate and clean the extracted data
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

    console.log('Successfully parsed resume data:', {
      hasName: !!cleanedData.candidate_name,
      hasLocation: !!(cleanedData.location_country || cleanedData.location_city),
      hasSkills: !!cleanedData.extracted_skills,
      hasExperience: !!cleanedData.years_experience
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: cleanedData,
        message: 'Resume parsed successfully!' 
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
        error: `Server error: ${error.message}. Please try again or contact support.`,
        data: null 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
