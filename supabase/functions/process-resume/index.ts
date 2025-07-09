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

    // Step 2: For now, let's create a simple demo text extraction
    // This will help us verify the OpenAI part works first
    console.log("📝 Creating demo resume text for testing...");
    
    const resumeText = `John Doe
Software Engineer
Email: john.doe@example.com
Phone: (555) 123-4567
LinkedIn: https://linkedin.com/in/johndoe

SUMMARY
Experienced software engineer with 5+ years developing web applications using React, Node.js, and Python. 
Strong background in full-stack development and cloud technologies.

EXPERIENCE
Senior Software Engineer - Tech Corp (2021-Present)
• Developed and maintained React applications serving 10k+ users
• Built RESTful APIs using Node.js and Express
• Implemented CI/CD pipelines using Docker and AWS

Software Engineer - StartupXYZ (2019-2021)  
• Created web applications using React and Python Flask
• Collaborated with design team to implement responsive UI
• Optimized database queries improving performance by 40%

SKILLS
React, JavaScript, Python, Node.js, AWS, Docker, Git, SQL, MongoDB

EDUCATION
Bachelor of Science in Computer Science
University of Technology (2019)`;

    console.log(`📝 Demo text created: ${resumeText.length} characters`);

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