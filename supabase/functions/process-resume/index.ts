import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedProfile {
  candidate_name: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  location_city?: string;
  location_state?: string;
  location_country?: string;
  salary_amount?: number;
  salary_currency?: string;
  salary_period?: string;
  skills: string[];
  profile_summary: {
    about_me?: string;
    experience_highlights: string[];
    key_competencies: string[];
  };
}

// JWT helper function for Adobe authentication
async function createJWT(): Promise<string> {
  const apiKey = Deno.env.get('ADOBE_API_KEY');
  const technicalAccountId = Deno.env.get('ADOBE_TECHNICAL_ACCOUNT_ID');
  const orgId = Deno.env.get('ADOBE_IMS_ORG');
  const clientSecret = Deno.env.get('ADOBE_CLIENT_SECRET');
  
  if (!apiKey || !technicalAccountId || !orgId || !clientSecret) {
    throw new Error('Adobe credentials not properly configured');
  }

  // Create JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: orgId,
    sub: technicalAccountId,
    aud: `https://ims-na1.adobelogin.com/c/${apiKey}`,
    exp: now + 300, // 5 minutes
    iat: now,
    'https://ims-na1.adobelogin.com/s/ent_documentservices_sdk': true
  };

  // For simplicity, we'll use a basic JWT implementation
  // In production, you'd want to use proper JWT signing with RS256
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadStr = btoa(JSON.stringify(payload));
  
  // Create signature (simplified - in production use proper RS256 with private key)
  const signature = btoa(clientSecret);
  
  return `${header}.${payloadStr}.${signature}`;
}

async function getAdobeAccessToken(): Promise<string> {
  const apiKey = Deno.env.get('ADOBE_API_KEY');
  const clientSecret = Deno.env.get('ADOBE_CLIENT_SECRET');
  
  console.log('Adobe credentials check:', {
    hasApiKey: !!apiKey,
    hasClientSecret: !!clientSecret,
    apiKeyLength: apiKey?.length || 0
  });
  
  if (!apiKey || !clientSecret) {
    throw new Error('Adobe API credentials not configured');
  }

  try {
    console.log('Attempting Adobe authentication...');
    
    // Use a simpler OAuth2 approach for now since JWT requires private key setup
    const response = await fetch('https://ims-na1.adobelogin.com/ims/token/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: apiKey,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'openid,AdobeID,DCAPI'
      }),
    });

    console.log('Adobe auth response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Adobe auth response error:', errorText);
      throw new Error(`Adobe authentication failed: ${response.statusText} - ${errorText}`);
    }

    const tokenData = await response.json();
    console.log('Adobe authentication successful, token received');
    return tokenData.access_token;
  } catch (error) {
    console.error('Adobe authentication error:', error);
    throw error;
  }
}

async function extractPDFText(pdfFile: File): Promise<string> {
  try {
    const accessToken = await getAdobeAccessToken();
    
    // Create FormData for Adobe PDF Services API
    const formData = new FormData();
    formData.append('file', pdfFile);

    // Adobe PDF Extract API call
    const extractResponse = await fetch('https://pdf-services.adobe.io/operation/extractpdf', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': Deno.env.get('ADOBE_API_KEY') || '',
      },
      body: formData,
    });

    if (!extractResponse.ok) {
      throw new Error(`Adobe PDF Extract failed: ${extractResponse.statusText}`);
    }

    const extractResult = await extractResponse.json();
    
    // Extract text content from Adobe's response
    // Note: Adobe's response structure may vary, adjust based on actual API response
    const textContent = extractResult.elements
      ?.filter((el: any) => el.Text)
      ?.map((el: any) => el.Text)
      ?.join(' ') || '';

    return textContent;
  } catch (error) {
    console.error('PDF extraction failed:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

async function structureProfileWithAI(resumeText: string): Promise<ExtractedProfile> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = `You are an expert in resume analysis and hiring systems.

Below is the text extracted from a candidate's resume. Please extract structured profile data and return it in this format:

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
  "salary_period": "annually",
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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that extracts structured data from resumes. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API failed: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    console.error('Failed to parse OpenAI response:', content);
    throw new Error('Invalid response format from AI');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('resume') as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No resume file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type and size
    if (file.type !== 'application/pdf') {
      return new Response(
        JSON.stringify({ error: 'Only PDF files are supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      return new Response(
        JSON.stringify({ error: 'File size must be less than 5MB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Extract text from PDF using Adobe
    console.log('Extracting text from PDF...');
    const extractedText = await extractPDFText(file);

    if (!extractedText.trim()) {
      return new Response(
        JSON.stringify({ error: 'Could not extract text from PDF' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Structure the data using OpenAI
    console.log('Structuring profile data with AI...');
    const structuredProfile = await structureProfileWithAI(extractedText);

    // Format profile summary as HTML
    let profileSummaryHtml = '';
    if (structuredProfile.profile_summary.about_me) {
      profileSummaryHtml += `<p>${structuredProfile.profile_summary.about_me}</p>`;
    }
    
    if (structuredProfile.profile_summary.experience_highlights.length > 0) {
      profileSummaryHtml += '<h4>Experience Highlights</h4><ul>';
      structuredProfile.profile_summary.experience_highlights.forEach(exp => {
        profileSummaryHtml += `<li>${exp}</li>`;
      });
      profileSummaryHtml += '</ul>';
    }

    if (structuredProfile.profile_summary.key_competencies.length > 0) {
      profileSummaryHtml += '<h4>Key Competencies</h4><ul>';
      structuredProfile.profile_summary.key_competencies.forEach(comp => {
        profileSummaryHtml += `<li>${comp}</li>`;
      });
      profileSummaryHtml += '</ul>';
    }

    const response = {
      success: true,
      extracted_data: {
        candidate_name: structuredProfile.candidate_name,
        email: structuredProfile.email || '',
        phone: structuredProfile.phone || '',
        linkedin_url: structuredProfile.linkedin_url || '',
        location_city: structuredProfile.location_city || '',
        location_state: structuredProfile.location_state || '',
        location_country: structuredProfile.location_country || '',
        salary_amount: structuredProfile.salary_amount,
        salary_currency: structuredProfile.salary_currency || 'USD',
        salary_period: structuredProfile.salary_period || 'annually',
        skills: structuredProfile.skills || [],
        profile_summary: profileSummaryHtml,
      }
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing resume:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to process resume' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});