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

async function getAdobeAccessToken(): Promise<string> {
  const clientId = Deno.env.get('ADOBE_CLIENT_ID');
  const clientSecret = Deno.env.get('ADOBE_CLIENT_SECRET');
  
  console.log('=== Adobe Authentication Start ===');
  console.log('Client ID exists:', !!clientId);
  console.log('Client Secret exists:', !!clientSecret);
  
  if (!clientId || !clientSecret) {
    console.error('Missing Adobe credentials');
    throw new Error('Adobe OAuth credentials not configured. Need ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET');
  }

  try {
    console.log('Making Adobe OAuth request...');
    
    const requestBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'openid,AdobeID,DCAPI'
    });
    
    console.log('Request body:', requestBody.toString());
    
    const response = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody,
    });

    console.log('Adobe auth response status:', response.status);
    console.log('Adobe auth response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Adobe auth response text:', responseText);
    
    if (!response.ok) {
      console.error('Adobe auth failed with status:', response.status);
      throw new Error(`Adobe authentication failed: ${response.status} - ${responseText}`);
    }

    const tokenData = JSON.parse(responseText);
    console.log('Adobe authentication successful');
    console.log('Token type:', tokenData.token_type);
    console.log('Access token length:', tokenData.access_token?.length || 0);
    console.log('=== Adobe Authentication End ===');
    
    return tokenData.access_token;
  } catch (error) {
    console.error('Adobe authentication error:', error);
    throw error;
  }
}

async function extractPDFText(pdfFile: File): Promise<string> {
  console.log('=== PDF Extraction Start ===');
  console.log('File name:', pdfFile.name);
  console.log('File size:', pdfFile.size);
  console.log('File type:', pdfFile.type);
  
  try {
    const accessToken = await getAdobeAccessToken();
    const clientId = Deno.env.get('ADOBE_CLIENT_ID');
    const orgId = Deno.env.get('ADOBE_IMS_ORG');
    
    console.log('Adobe credentials for API calls:');
    console.log('Client ID exists:', !!clientId);
    console.log('Org ID exists:', !!orgId);
    
    if (!clientId || !orgId) {
      throw new Error('Adobe Client ID and Organization ID are required');
    }

    // Step 1: Upload the PDF file to Adobe
    console.log('=== Step 1: Uploading PDF to Adobe ===');
    const uploadFormData = new FormData();
    uploadFormData.append('file', pdfFile);

    const uploadResponse = await fetch('https://pdf-services.adobe.io/assets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': clientId,
        'x-gw-ims-org-id': orgId,
      },
      body: uploadFormData,
    });

    console.log('Upload response status:', uploadResponse.status);
    console.log('Upload response headers:', Object.fromEntries(uploadResponse.headers.entries()));
    
    const uploadResponseText = await uploadResponse.text();
    console.log('Upload response body:', uploadResponseText);
    
    if (!uploadResponse.ok) {
      console.error('Adobe file upload failed');
      throw new Error(`Adobe PDF upload failed: ${uploadResponse.status} - ${uploadResponseText}`);
    }

    const uploadResult = JSON.parse(uploadResponseText);
    const assetID = uploadResult.assetID;
    
    if (!assetID) {
      console.error('No asset ID received from Adobe');
      throw new Error('Adobe did not return an asset ID');
    }

    console.log('Asset uploaded successfully with ID:', assetID);

    // Step 2: Create PDF Extract job
    console.log('=== Step 2: Creating PDF Extract Job ===');
    const extractJobPayload = {
      assetID: assetID,
      getCharBounds: false,
      getStylingInfo: false,
      includeStyling: false,
      renderSharedTableElements: false
    };
    
    console.log('Extract job payload:', JSON.stringify(extractJobPayload, null, 2));
    
    const createJobResponse = await fetch('https://pdf-services.adobe.io/operation/extractpdf', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': clientId,
        'x-gw-ims-org-id': orgId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(extractJobPayload),
    });

    console.log('Create job response status:', createJobResponse.status);
    console.log('Create job response headers:', Object.fromEntries(createJobResponse.headers.entries()));
    
    const createJobResponseText = await createJobResponse.text();
    console.log('Create job response body:', createJobResponseText);
    
    if (!createJobResponse.ok) {
      console.error('Adobe job creation failed');
      throw new Error(`Adobe job creation failed: ${createJobResponse.status} - ${createJobResponseText}`);
    }

    const jobLocation = createJobResponse.headers.get('location');
    
    if (!jobLocation) {
      console.error('No job location received from Adobe');
      throw new Error('Adobe did not return a job location header');
    }

    console.log('Extract job created at:', jobLocation);

    // Step 3: Poll for job completion
    console.log('=== Step 3: Polling for Job Completion ===');
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    let finalJobResult: any;

    while (!jobCompleted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      attempts++;

      console.log(`Polling attempt ${attempts}/${maxAttempts}...`);

      const statusResponse = await fetch(jobLocation, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': clientId,
          'x-gw-ims-org-id': orgId,
        },
      });

      console.log(`Status check ${attempts} - Response status:`, statusResponse.status);

      if (!statusResponse.ok) {
        const statusErrorText = await statusResponse.text();
        console.error(`Failed to check job status (attempt ${attempts}):`, statusErrorText);
        continue;
      }

      const statusResponseText = await statusResponse.text();
      finalJobResult = JSON.parse(statusResponseText);
      console.log(`Job status (attempt ${attempts}):`, finalJobResult.status);

      if (finalJobResult.status === 'done') {
        jobCompleted = true;
        console.log('Job completed successfully!');
      } else if (finalJobResult.status === 'failed') {
        console.error('Job failed:', finalJobResult);
        throw new Error(`Adobe job failed: ${JSON.stringify(finalJobResult)}`);
      }
    }

    if (!jobCompleted) {
      console.error('Job timed out after', maxAttempts, 'attempts');
      throw new Error(`Adobe job timed out after ${maxAttempts} seconds`);
    }

    // Step 4: Download and parse results
    console.log('=== Step 4: Downloading Results ===');
    if (!finalJobResult.asset || !finalJobResult.asset.downloadUri) {
      console.error('No download URL in job result:', finalJobResult);
      throw new Error('No download URL received from Adobe job result');
    }

    const downloadUrl = finalJobResult.asset.downloadUri;
    console.log('Downloading from:', downloadUrl);

    const downloadResponse = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    console.log('Download response status:', downloadResponse.status);

    if (!downloadResponse.ok) {
      const downloadErrorText = await downloadResponse.text();
      console.error('Download failed:', downloadErrorText);
      throw new Error(`Failed to download extraction results: ${downloadResponse.status} - ${downloadErrorText}`);
    }

    const extractionResult = await downloadResponse.json();
    console.log('Extraction result structure:', Object.keys(extractionResult));

    // Step 5: Extract text from the results
    console.log('=== Step 5: Extracting Text Content ===');
    let extractedText = '';
    
    if (extractionResult.elements && Array.isArray(extractionResult.elements)) {
      console.log('Found elements array with', extractionResult.elements.length, 'items');
      extractedText = extractionResult.elements
        .filter((element: any) => element.Text)
        .map((element: any) => element.Text)
        .join(' ');
    } else if (extractionResult.content && Array.isArray(extractionResult.content)) {
      console.log('Found content array with', extractionResult.content.length, 'items');
      extractedText = extractionResult.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.value || item.text)
        .join(' ');
    } else if (typeof extractionResult === 'string') {
      console.log('Extraction result is a string');
      extractedText = extractionResult;
    } else {
      console.log('Trying to extract from unknown structure:', typeof extractionResult);
      extractedText = JSON.stringify(extractionResult);
    }

    console.log('Extracted text length:', extractedText.length);
    console.log('First 200 chars:', extractedText.substring(0, 200));
    console.log('=== PDF Extraction End ===');
    
    if (!extractedText.trim()) {
      throw new Error('No text content found in the extracted results');
    }

    return extractedText;
  } catch (error) {
    console.error('=== PDF Extraction Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

async function structureProfileWithAI(resumeText: string): Promise<ExtractedProfile> {
  console.log('=== OpenAI Processing Start ===');
  console.log('Resume text length:', resumeText.length);
  
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    console.error('OpenAI API key not configured');
    throw new Error('OpenAI API key not configured');
  }

  console.log('OpenAI API key exists:', !!openAIApiKey);

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

  try {
    console.log('Making OpenAI API request...');
    
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

    console.log('OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response received');
    
    const content = data.choices[0].message.content;
    console.log('OpenAI content length:', content?.length || 0);
    console.log('OpenAI content preview:', content?.substring(0, 200));
    
    try {
      const parsed = JSON.parse(content);
      console.log('Successfully parsed OpenAI response');
      console.log('=== OpenAI Processing End ===');
      return parsed;
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      console.error('Raw content:', content);
      throw new Error('Invalid JSON response format from AI');
    }
  } catch (error) {
    console.error('=== OpenAI Processing Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

serve(async (req) => {
  console.log('=== Resume Processing Function Called ===');
  console.log('Method:', req.method);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Request Processing Start ===');
    
    const formData = await req.formData();
    console.log('FormData entries:', Array.from(formData.keys()));
    
    const file = formData.get('resume') as File;

    if (!file) {
      console.error('No file provided in request');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No resume file provided' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Validate file type and size
    if (file.type !== 'application/pdf') {
      console.error('Invalid file type:', file.type);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Only PDF files are supported' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      console.error('File too large:', file.size);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'File size must be less than 5MB' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Extract text from PDF using Adobe
    console.log('=== Starting PDF Text Extraction ===');
    const extractedText = await extractPDFText(file);

    if (!extractedText.trim()) {
      console.error('No text extracted from PDF');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Could not extract text from PDF' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('PDF text extraction successful, text length:', extractedText.length);

    // Step 2: Structure the data using OpenAI
    console.log('=== Starting AI Data Structuring ===');
    const structuredProfile = await structureProfileWithAI(extractedText);

    console.log('AI structuring successful');

    // Format profile summary as HTML
    let profileSummaryHtml = '';
    if (structuredProfile.profile_summary?.about_me) {
      profileSummaryHtml += `<p>${structuredProfile.profile_summary.about_me}</p>`;
    }
    
    if (structuredProfile.profile_summary?.experience_highlights?.length > 0) {
      profileSummaryHtml += '<h4>Experience Highlights</h4><ul>';
      structuredProfile.profile_summary.experience_highlights.forEach(exp => {
        profileSummaryHtml += `<li>${exp}</li>`;
      });
      profileSummaryHtml += '</ul>';
    }

    if (structuredProfile.profile_summary?.key_competencies?.length > 0) {
      profileSummaryHtml += '<h4>Key Competencies</h4><ul>';
      structuredProfile.profile_summary.key_competencies.forEach(comp => {
        profileSummaryHtml += `<li>${comp}</li>`;
      });
      profileSummaryHtml += '</ul>';
    }

    const response = {
      success: true,
      extracted_data: {
        candidate_name: structuredProfile.candidate_name || '',
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

    console.log('=== Resume Processing Successful ===');
    console.log('Response data:', JSON.stringify(response, null, 2));

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== Resume Processing Error ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to process resume',
        details: error.stack || 'No stack trace available'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});