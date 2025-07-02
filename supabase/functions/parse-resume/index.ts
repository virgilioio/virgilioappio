import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Adobe PDF Extract API configuration
const ADOBE_CLIENT_ID = "f967569106064a058e31ab0b7cc2de16";
const ADOBE_CLIENT_SECRET = "p8e-CIaYSuaRp1FLanFEZ53oeKu819srBewS";
const ADOBE_ORG_ID = "E9F023CF686570760A495E7E@AdobeOrg";

// Enhanced parsed resume interface
interface ParsedResume {
  rawText: string;
  sections: {
    contact?: {
      name?: string;
      email?: string;
      phone?: string;
      location?: string;
      linkedin?: string;
    };
    experience?: string[];
    education?: string[];
    skills?: string[];
  };
  urls: string[];
}

interface AdobeElement {
  type: string;
  text?: string;
  path?: string;
  bounds?: any;
}

// Get Adobe access token
async function getAdobeAccessToken(): Promise<string> {
  try {
    const response = await fetch('https://pdf-services.adobe.io/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'client_id': ADOBE_CLIENT_ID,
        'client_secret': ADOBE_CLIENT_SECRET
      })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Failed to get Adobe access token:', error);
    throw new Error('Adobe authentication failed');
  }
}

// Extract text using Adobe PDF Extract API
async function extractTextWithAdobe(base64Content: string): Promise<ParsedResume> {
  try {
    console.log('Starting Adobe PDF extraction...');
    const accessToken = await getAdobeAccessToken();
    
    const assetID = await uploadToAdobe(base64Content, accessToken);
    
    // Create extraction job
    const extractResponse = await fetch('https://pdf-services.adobe.io/operation/extractpdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-API-Key': ADOBE_CLIENT_ID
      },
      body: JSON.stringify({
        assetID: assetID,
        elementsToExtract: ["text", "tables"],
        renditionsToExtract: ["tables", "figures"]
      })
    });

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      throw new Error(`Adobe extraction job creation failed: ${extractResponse.status} - ${errorText}`);
    }

    const extractJob = await extractResponse.json();
    const jobLocation = extractResponse.headers.get('location');
    console.log('Adobe extraction job created:', { jobId: jobLocation, response: extractJob });

    // Poll for completion using the location header
    let result;
    for (let i = 0; i < 30; i++) { // 30 attempts, 2 seconds each = 60 seconds max
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(jobLocation, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-API-Key': ADOBE_CLIENT_ID
        }
      });

      if (!statusResponse.ok) {
        throw new Error(`Failed to check job status: ${statusResponse.statusText}`);
      }

      result = await statusResponse.json();
      console.log(`Adobe job status: ${result.status}`);

      if (result.status === 'done') {
        break;
      } else if (result.status === 'failed') {
        throw new Error('Adobe extraction job failed');
      }
    }

    if (result?.status !== 'done') {
      throw new Error('Adobe extraction timed out');
    }

    // Download the result using the asset downloadUri
    const downloadResponse = await fetch(result.asset.downloadUri);

    if (!downloadResponse.ok) {
      throw new Error('Failed to download Adobe result');
    }

    // Extract ZIP and parse JSON
    const zipBuffer = await downloadResponse.arrayBuffer();
    const structuredData = await parseAdobeZip(zipBuffer);
    
    return processAdobeStructuredData(structuredData);

  } catch (error) {
    console.error('Adobe extraction failed:', error);
    // Fallback to basic text extraction
    return await extractTextFallback(base64Content);
  }
}

// Upload file to Adobe using proper 2-step process
async function uploadToAdobe(base64Content: string, accessToken: string): Promise<string> {
  // Step 1: Get upload pre-signed URI
  const createAssetResponse = await fetch('https://pdf-services.adobe.io/assets', {
    method: 'POST',
    headers: {
      'X-API-Key': ADOBE_CLIENT_ID,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      mediaType: 'application/pdf'
    })
  });

  if (!createAssetResponse.ok) {
    throw new Error(`Adobe create asset failed: ${createAssetResponse.statusText}`);
  }

  const createAssetResult = await createAssetResponse.json();
  const { uploadUri, assetID } = createAssetResult;

  // Step 2: Upload file to pre-signed URI
  const fileBytes = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
  
  const uploadResponse = await fetch(uploadUri, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf'
    },
    body: fileBytes
  });

  if (!uploadResponse.ok) {
    throw new Error(`Adobe file upload failed: ${uploadResponse.statusText}`);
  }

  return assetID;
}

// Parse Adobe ZIP response to extract structuredData.json
async function parseAdobeZip(zipBuffer: ArrayBuffer): Promise<any> {
  try {
    console.log('Parsing Adobe ZIP response...');
    
    // Import JSZip for ZIP parsing
    const JSZip = (await import('https://deno.land/x/jszip@0.11.0/mod.ts')).default;
    
    const zip = await JSZip.loadAsync(zipBuffer);
    console.log('ZIP files found:', Object.keys(zip.files));
    
    // Extract structuredData.json from the ZIP
    const structuredDataFile = zip.file('structuredData.json');
    if (!structuredDataFile) {
      console.warn('structuredData.json not found in ZIP, checking for other JSON files...');
      // Look for any JSON file that might contain the structured data
      const jsonFiles = Object.keys(zip.files).filter(name => name.endsWith('.json'));
      console.log('JSON files found:', jsonFiles);
      
      if (jsonFiles.length > 0) {
        const firstJsonFile = zip.file(jsonFiles[0]);
        if (firstJsonFile) {
          const jsonContent = await firstJsonFile.async('text');
          return JSON.parse(jsonContent);
        }
      }
      
      console.warn('No structured data found in Adobe ZIP response');
      return { elements: [] };
    }
    
    const structuredDataText = await structuredDataFile.async('text');
    const structuredData = JSON.parse(structuredDataText);
    
    console.log('Adobe structured data parsed successfully:', {
      elementsCount: structuredData.elements?.length || 0,
      hasElements: !!structuredData.elements
    });
    
    return structuredData;
  } catch (error) {
    console.error('Failed to parse Adobe ZIP:', error);
    return { elements: [] };
  }
}

// Process Adobe structured data into our format
function processAdobeStructuredData(structuredData: any): ParsedResume {
  const elements: AdobeElement[] = structuredData.elements || [];
  const textElements = elements.filter(el => el.type === 'text' && el.text);
  
  const rawText = textElements.map(el => el.text).join(' ');
  const urls = extractURLsFromText(rawText);
  
  // Enhanced section detection using Adobe elements
  const sections = detectSectionsFromElements(textElements);
  
  return {
    rawText: rawText,
    sections,
    urls
  };
}

// Enhanced section detection using Adobe structured elements
function detectSectionsFromElements(elements: AdobeElement[]): ParsedResume['sections'] {
  const texts = elements.map(el => el.text || '').filter(text => text.length > 1);
  const fullText = texts.join('\n');
  
  console.log('Detecting sections from Adobe elements...');
  
  const sections: ParsedResume['sections'] = {};
  
  // 1. Contact Section Detection (first 10 elements before first section header)
  const sectionHeaderPattern = /^(EXPERIENCE|EMPLOYMENT|WORK HISTORY|EDUCATION|EDUCACIÓN|SKILLS|SUMMARY|OBJECTIVE)/i;
  let contactEndIndex = 10; // Default to first 10 elements
  
  for (let i = 0; i < Math.min(texts.length, 20); i++) {
    if (sectionHeaderPattern.test(texts[i])) {
      contactEndIndex = i;
      break;
    }
  }
  
  const contactText = texts.slice(0, contactEndIndex).join('\n');
  sections.contact = parseContactSection(contactText);
  
  // 2. Experience Section Detection
  const experienceMatch = fullText.match(/(?:EXPERIENCE|EMPLOYMENT|WORK HISTORY)[\s:]*([^]*?)(?:EDUCATION|SKILLS|$)/i);
  if (experienceMatch) {
    sections.experience = parseExperienceSection(experienceMatch[1]);
  } else {
    // Fallback: look for date patterns and job-related keywords
    sections.experience = extractExperienceFromDatePatterns(fullText);
  }
  
  // 3. Education Section Detection
  const educationMatch = fullText.match(/(?:EDUCATION|ACADEMIC)[\s:]*([^]*?)(?:SKILLS|EXPERIENCE|$)/i);
  if (educationMatch) {
    sections.education = parseEducationSection(educationMatch[1]);
  }
  
  // 4. Skills Section Detection
  const skillsMatch = fullText.match(/(?:SKILLS|TECHNICAL SKILLS|COMPETENCIES)[\s:]*([^]*?)(?:EDUCATION|EXPERIENCE|$)/i);
  if (skillsMatch) {
    sections.skills = parseSkillsSection(skillsMatch[1]);
  }
  
  console.log('Sections detected:', {
    hasContact: !!sections.contact,
    experienceCount: sections.experience?.length || 0,
    educationCount: sections.education?.length || 0,
    skillsCount: sections.skills?.length || 0
  });
  
  return sections;
}

// Parse contact section with enhanced location detection
function parseContactSection(contactText: string): ParsedResume['sections']['contact'] {
  const contact: ParsedResume['sections']['contact'] = {};
  
  // Name detection (usually first non-empty line)
  const lines = contactText.split('\n').filter(line => line.trim().length > 2);
  if (lines.length > 0) {
    // Skip common email/phone patterns for name detection
    const nameCandidate = lines.find(line => 
      !/@/.test(line) && 
      !/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(line) &&
      !/linkedin|github|http/i.test(line) &&
      line.length > 3 && line.length < 50
    );
    if (nameCandidate) {
      contact.name = nameCandidate.trim();
    }
  }
  
  // Email detection
  const emailMatch = contactText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) {
    contact.email = emailMatch[0];
  }
  
  // Phone detection
  const phoneMatch = contactText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    contact.phone = phoneMatch[0];
  }
  
  // LinkedIn detection
  const linkedinMatch = contactText.match(/linkedin\.com\/in\/[^\s)>\]}"']+/i);
  if (linkedinMatch) {
    contact.linkedin = linkedinMatch[0].startsWith('http') ? linkedinMatch[0] : `https://${linkedinMatch[0]}`;
  }
  
  // Enhanced location detection with multiple patterns and fallbacks
  const locationPatterns = [
    // Standard format: City, State/Province
    /([A-Za-záéíóúñü]+(?:\s[A-Za-záéíóúñü]+)*),\s*([A-Za-z.]+)(?:,\s*([A-Za-z\s]+))?/g,
    // International format: City, Country
    /([A-Za-z\s]+),\s*(Mexico|España|Argentina|Colombia|Chile|Peru|Brasil|Brazil|United States|USA|Canada)/i,
    // Mexican states format: City, STATE_ABBREV
    /([\w\s]+),\s*(CDMX|Jal\.|NL|BC|QRO|GTO|SLP|CHIH|SON|TAM|VER|Mex\.|Pue\.|Yuc\.)/i,
    // US states format: City, STATE
    /([\w\s]+),\s*(CA|TX|NY|FL|IL|PA|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|IA|MS|AR|KS|UT|NV|NM|WV|NE|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY)/,
    // International cities: City only
    /(Mexico City|Guadalajara|Monterrey|Buenos Aires|São Paulo|Madrid|Barcelona|Toronto|Vancouver|London|Paris|Berlin|Sydney|Melbourne)/i
  ];
  
  for (const pattern of locationPatterns) {
    const match = contactText.match(pattern);
    if (match) {
      if (match[3]) {
        // City, State, Country format
        contact.location = `${match[1].trim()}, ${match[2].trim()}, ${match[3].trim()}`;
      } else {
        // City, State format
        contact.location = `${match[1].trim()}, ${match[2].trim()}`;
      }
      console.log('Location found in contact:', contact.location);
      break;
    }
  }
  
  // Additional location fallback - look for address patterns
  if (!contact.location) {
    const addressPatterns = [
      // Look for address-like patterns anywhere in contact text
      /(?:^|\n)([A-Za-záéíóúñü\s]+),\s*([A-Za-z\s.]+)(?:,\s*([A-Za-z\s]+))?(?:\s+\d{5})?(?:\n|$)/gm,
      // Look for standalone city names that are commonly recognized
      /\b(Mexico City|Guadalajara|Monterrey|Buenos Aires|São Paulo|Madrid|Barcelona|Toronto|Vancouver|London|Paris|Berlin|Sydney|Melbourne|Austin|Seattle|San Francisco|Los Angeles|New York|Chicago|Houston|Phoenix|Philadelphia|San Antonio|San Diego|Dallas|Boston|Atlanta|Miami)\b/i
    ];
    
    for (const pattern of addressPatterns) {
      const matches = contactText.match(pattern);
      if (matches && matches.length > 0) {
        contact.location = matches[0].trim();
        console.log('Location found via fallback:', contact.location);
        break;
      }
    }
  }
  
  return contact;
}

// Parse experience section into job entries
function parseExperienceSection(experienceText: string): string[] {
  const entries = experienceText
    .split(/\n\s*\n|\d{4}\s*[-–—]\s*|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b\s+\d{4}/i)
    .filter(entry => entry.trim().length > 20)
    .map(entry => entry.trim());
  
  console.log(`Parsed ${entries.length} experience entries`);
  return entries;
}

// Extract experience from date patterns when no clear section exists
function extractExperienceFromDatePatterns(text: string): string[] {
  const lines = text.split('\n');
  const experienceLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for lines with years and job keywords
    if (/\d{4}/.test(line) && /manager|engineer|developer|analyst|coordinator|assistant|specialist|director/i.test(line)) {
      // Include this line and the next few lines as context
      const entry = lines.slice(i, Math.min(i + 3, lines.length)).join('\n').trim();
      if (entry.length > 20) {
        experienceLines.push(entry);
      }
    }
  }
  
  console.log(`Extracted ${experienceLines.length} experience entries from date patterns`);
  return experienceLines;
}

// Parse education section
function parseEducationSection(educationText: string): string[] {
  return educationText
    .split(/\n\s*\n|\d{4}\s*[-–—]/)
    .filter(entry => entry.trim().length > 10)
    .map(entry => entry.trim());
}

// Parse skills section
function parseSkillsSection(skillsText: string): string[] {
  return skillsText
    .split(/[,\n•·]/)
    .filter(skill => skill.trim().length > 2)
    .map(skill => skill.trim());
}

// Extract URLs from text
function extractURLsFromText(text: string): string[] {
  const urlPatterns = [
    /https?:\/\/[^\s)>\]}"']+/gi,
    /www\.[^\s)>\]}"']+/gi,
    /linkedin\.com\/in\/[^\s)>\]}"']+/gi,
    /github\.com\/[^\s)>\]}"']+/gi
  ];
  
  const urls: string[] = [];
  for (const pattern of urlPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      urls.push(...matches);
    }
  }
  
  return [...new Set(urls)];
}

// Enhanced DOCX text extraction
async function extractTextFromDOCX(base64Content: string): Promise<ParsedResume> {
  try {
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`DOCX extraction: Processing ${bytes.length} bytes`);

    // Import JSZip for DOCX parsing
    const JSZip = (await import('https://deno.land/x/jszip@0.11.0/mod.ts')).default;
    
    const zip = await JSZip.loadAsync(bytes);
    const allTextParts: string[] = [];

    // Extract from main document
    const documentXML = await zip.file('word/document.xml')?.async('text');
    if (documentXML) {
      const mainText = extractTextFromDocumentXML(documentXML);
      if (mainText) allTextParts.push(mainText);
    }

    const extractedText = allTextParts.join('\n\n').trim();
    console.log(`DOCX extraction: Extracted ${extractedText.length} characters`);
    
    const urls = extractURLsFromText(extractedText);
    const sections = detectSectionsFromElements([{ type: 'text', text: extractedText }]);
    
    return {
      rawText: extractedText,
      sections,
      urls
    };
  } catch (error) {
    console.error('DOCX extraction error:', error);
    return await extractTextFallback(base64Content);
  }
}

// Extract text from document XML
function extractTextFromDocumentXML(xml: string): string {
  const textParts: string[] = [];
  
  try {
    const paragraphs = xml.match(/<w:p[^>]*>.*?<\/w:p>/gs) || [];
    
    for (const paragraph of paragraphs) {
      const textRuns = paragraph.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const texts = textRuns.map(run => {
        const match = run.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
        return match ? match[1] : '';
      });

      if (texts.length > 0) {
        textParts.push(texts.join('').trim());
      }
    }
    
    return textParts.join('\n').trim();
  } catch (error) {
    console.error('Error extracting text from document XML:', error);
    return '';
  }
}

// Fallback text extraction for plain text or when other methods fail
async function extractTextFallback(base64Content: string): Promise<ParsedResume> {
  try {
    const rawText = new TextDecoder().decode(
      Uint8Array.from(atob(base64Content), c => c.charCodeAt(0))
    );
    
    const urls = extractURLsFromText(rawText);
    const sections = detectSectionsFromElements([{ type: 'text', text: rawText }]);
    
    return {
      rawText,
      sections,
      urls
    };
  } catch (error) {
    console.error('Fallback extraction error:', error);
    return { rawText: '', sections: {}, urls: [] };
  }
}

// Relaxed validation for resume quality
function validateResumeQuality(parsedResume: ParsedResume, fileName: string): { isValid: boolean; error?: string; details?: any } {
  const { rawText, sections } = parsedResume;
  
  console.log(`=== VALIDATION for ${fileName} ===`);
  console.log(`Text length: ${rawText.length}`);
  console.log(`Sections found:`, Object.keys(sections));
  
  const details = {
    textLength: rawText.length,
    sectionsFound: Object.keys(sections).length,
    hasContact: !!sections.contact,
    hasExperience: !!(sections.experience?.length),
    textPreview: rawText.substring(0, 200)
  };
  
  // Very relaxed validation - just check for basic content
  if (rawText.length < 100) {
    return {
      isValid: false,
      error: "File appears to be empty or corrupted. Please try a different file.",
      details
    };
  }
  
  const words = rawText.split(/\s+/).filter(word => word.length > 1);
  if (words.length < 20) {
    return {
      isValid: false,
      error: "This file doesn't contain enough readable text. Please try a different file format.",
      details
    };
  }
  
  console.log(`✅ VALIDATION PASSED: ${words.length} words, ${Object.keys(sections).length} sections`);
  return { isValid: true, details };
}

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

  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`[${requestId}] ===== NEW RESUME PARSING REQUEST =====`);

  try {
    if (!openAIApiKey) {
      console.error(`[${requestId}] ❌ OpenAI API key not configured`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "AI service not configured. Please contact support."
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      console.error(`[${requestId}] ❌ Invalid request body:`, error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid request format"
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { fileContent, fileName, fileType } = requestBody;
    
    if (!fileContent || !fileName || !fileType) {
      console.error(`[${requestId}] ❌ Missing required fields`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Missing file information"
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileSizeBytes = Math.floor((fileContent.length * 3) / 4);
    if (fileSizeBytes > 5 * 1024 * 1024) {
      console.error(`[${requestId}] ❌ File too large: ${fileSizeBytes} bytes`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "File too large. Please upload a file smaller than 5MB."
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] 📄 Processing resume: ${fileName} (${fileType}), size: ${fileSizeBytes} bytes`);

    // Extract structured text based on file type
    let parsedResume: ParsedResume;
    
    try {
      if (fileType === 'text/plain') {
        console.log(`[${requestId}] 📝 Processing plain text file...`);
        parsedResume = await extractTextFallback(fileContent);
      } else if (fileType === 'application/pdf') {
        console.log(`[${requestId}] 📕 Attempting Adobe PDF extraction...`);
        parsedResume = await extractTextWithAdobe(fileContent);
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        console.log(`[${requestId}] 📄 Attempting DOCX text extraction...`);
        parsedResume = await extractTextFromDOCX(fileContent);
      } else {
        console.error(`[${requestId}] ❌ Unsupported file type: ${fileType}`);
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Unsupported file type: ${fileType}. Please upload a PDF, DOCX, or TXT file.`
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (extractionError) {
      console.error(`[${requestId}] ❌ File extraction failed:`, extractionError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unable to read this file. Please try a different format or upload a text-based file."
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pre-AI validation
    console.log(`[${requestId}] 🔍 Running validation...`);
    const validation = validateResumeQuality(parsedResume, fileName);
    
    if (!validation.isValid) {
      console.warn(`[${requestId}] ❌ Resume validation failed: ${validation.error}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: validation.error,
        details: validation.details
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] ✅ Validation passed`);
    console.log(`[${requestId}] 📊 Sections found:`, Object.keys(parsedResume.sections));
    console.log(`[${requestId}] 🔍 Contact details:`, {
      name: parsedResume.sections.contact?.name || 'Not found',
      location: parsedResume.sections.contact?.location || 'Not found',
      email: parsedResume.sections.contact?.email || 'Not found',
      linkedin: parsedResume.sections.contact?.linkedin || 'Not found'
    });
    console.log(`[${requestId}] 💼 Experience entries:`, parsedResume.sections.experience?.length || 0);
    console.log(`[${requestId}] 🔗 URLs found:`, parsedResume.urls.length);
    
    // Enhanced OpenAI prompt with structured data
    console.log(`[${requestId}] 🤖 Calling OpenAI API...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an expert resume parsing AI. Extract structured candidate data from the resume sections below.

CRITICAL: Return ONLY valid JSON. Do not include any explanatory text, markdown formatting, or code blocks.

LOCATION EXTRACTION RULES:
- Parse locations from various formats: "Mexico City, CDMX", "Austin, TX", "Guadalajara, Jal.", "Toronto, ON, Canada"
- Break down locations into components: city, state/province, country
- Common patterns: "City, State", "City, State, Country", "City, Country", standalone cities
- Mexican states: CDMX=Ciudad de México, Jal.=Jalisco, NL=Nuevo León, BC=Baja California, etc.
- US states: Use full names (Texas not TX, California not CA)
- Look in: contact info, current job location, address lines, anywhere in resume
- Examples: "Guadalajara, Jal." → city="Guadalajara", state="Jalisco", country="Mexico"
- Examples: "Austin, TX" → city="Austin", state="Texas", country="United States"

PROFILE SUMMARY RULES (LESS RESTRICTIVE):
- Generate profile_summary if ANY of the following is true:
  * At least 1 clear job title found
  * At least 1 company name found  
  * At least 1 year of work experience detected
  * Any professional experience or skills mentioned
- The summary should include: roles, companies, skills, technologies, years if available
- Be concise (2-3 sentences) but informative
- Focus on professional highlights and key competencies
- If minimal experience exists, still generate a basic summary

URL EXTRACTION:
- LinkedIn: any variation of linkedin.com/in/username (with or without https://)
- GitHub: github.com/username patterns
- Portfolio sites: any professional URLs mentioned

Return ONLY this JSON structure (no markdown, no explanation):
{
  "candidate_name": "full name from contact" | null,
  "linkedin_url": "complete LinkedIn URL" | null, 
  "location_country": "country name" | null,
  "location_state": "state/province name" | null,
  "location_city": "city name" | null,
  "salary_amount": numeric_value | null,
  "salary_currency": "currency_code" | null,
  "profile_summary": "factual summary based on experience" | null,
  "notes": "other relevant info" | null
}`
            },
            {
              role: 'user',
              content: `Extract candidate information from this structured resume data:

${parsedResume.sections.contact ? `CONTACT INFORMATION:
Name: ${parsedResume.sections.contact.name || 'Not found'}
Email: ${parsedResume.sections.contact.email || 'Not found'}
Phone: ${parsedResume.sections.contact.phone || 'Not found'}
Location: ${parsedResume.sections.contact.location || 'Not found'}
LinkedIn: ${parsedResume.sections.contact.linkedin || 'Not found'}

` : ''}${parsedResume.sections.experience && parsedResume.sections.experience.length > 0 ? `WORK EXPERIENCE:
${parsedResume.sections.experience.join('\n\n')}

` : ''}${parsedResume.sections.education && parsedResume.sections.education.length > 0 ? `EDUCATION:
${parsedResume.sections.education.join('\n\n')}

` : ''}${parsedResume.sections.skills && parsedResume.sections.skills.length > 0 ? `SKILLS:
${parsedResume.sections.skills.join(', ')}

` : ''}${parsedResume.urls.length > 0 ? `FOUND URLs:
${parsedResume.urls.join(', ')}

` : ''}FULL TEXT (first 2000 chars):
${parsedResume.rawText.substring(0, 2000)}${parsedResume.rawText.length > 2000 ? '...' : ''}

Return structured JSON only.`
            }
          ],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error(`[${requestId}] ❌ OpenAI API request failed:`, fetchError);
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: "AI processing failed. Please try again."
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[${requestId}] ❌ OpenAI API error: ${response.status}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "AI parsing service error. Please try again."
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await response.json();
    let parsedContent = aiResponse.choices[0].message.content;

    console.log(`[${requestId}] 🤖 AI Response received:`, parsedContent.substring(0, 300));

    // Clean up response
    parsedContent = parsedContent.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();

    // Parse the JSON response
    let parsedData: ParsedResumeData;
    try {
      parsedData = JSON.parse(parsedContent);
    } catch (parseError) {
      console.error(`[${requestId}] ❌ Failed to parse AI response as JSON:`, parseError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "AI returned invalid data format. Please try again or enter information manually."
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    console.log(`[${requestId}] ✅ Successfully parsed resume data:`, cleanedData);

    return new Response(JSON.stringify({ 
      success: true, 
      data: cleanedData,
      fileName: fileName,
      debug: {
        textLength: parsedResume.rawText.length,
        urlsFound: parsedResume.urls.length,
        sectionsDetected: Object.keys(parsedResume.sections).length,
        contactFound: !!parsedResume.sections.contact,
        experienceEntries: parsedResume.sections.experience?.length || 0
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[${requestId}] ❌ Unexpected error:`, error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: "An unexpected error occurred. Please try again or enter information manually."
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});