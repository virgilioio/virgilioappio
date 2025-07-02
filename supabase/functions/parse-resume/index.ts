import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Enhanced PDF text extraction using multiple extraction methods
async function extractTextFromPDF(base64Content: string): Promise<string> {
  try {
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`PDF extraction: Processing ${bytes.length} bytes`);

    // Method 1: Enhanced PDF text extraction with better text operators
    const extractedText = await extractTextFromPDFAdvanced(bytes);
    
    if (extractedText.length > 100 && hasMinimumTextQuality(extractedText)) {
      console.log(`PDF extraction: Advanced method successful, extracted ${extractedText.length} characters`);
      return extractedText;
    }

    // Method 2: Fallback to stream-based extraction
    console.log('PDF extraction: Trying fallback stream extraction');
    const streamText = extractTextFromPDFStreams(bytes);
    
    if (streamText.length > 50 && hasMinimumTextQuality(streamText)) {
      console.log(`PDF extraction: Stream method successful, extracted ${streamText.length} characters`);
      return streamText;
    }

    console.warn('PDF extraction: All methods failed to extract readable text');
    return '';
  } catch (error) {
    console.error('PDF extraction error:', error);
    return '';
  }
}

// Advanced PDF text extraction with proper operator handling
async function extractTextFromPDFAdvanced(bytes: Uint8Array): Promise<string> {
  try {
    const pdfString = new TextDecoder('latin1').decode(bytes);
    const textParts: string[] = [];
    
    // Look for content streams
    const streamMatches = pdfString.match(/stream\s*(.*?)\s*endstream/gs) || [];
    
    for (const streamMatch of streamMatches) {
      const streamContent = streamMatch.replace(/^stream\s*/, '').replace(/\s*endstream$/, '');
      
      // Extract text from various text operators
      const textOperators = [
        /\(((?:[^()\\]|\\.|\\[0-7]{1,3})*)\)\s*Tj/g,           // Simple text
        /\(((?:[^()\\]|\\.|\\[0-7]{1,3})*)\)\s*TJ/g,           // Text with spacing
        /\[((?:\([^)]*\)|[^\]])*)\]\s*TJ/g,                     // Array of strings
        /<([0-9A-Fa-f]+)>\s*Tj/g,                              // Hexadecimal strings
        /\(((?:[^()\\]|\\.|\\[0-7]{1,3})*)\)\s*'/g,            // Move and show text
        /\(((?:[^()\\]|\\.|\\[0-7]{1,3})*)\)\s*"/g             // Move and show text with spacing
      ];
      
      for (const regex of textOperators) {
        let match;
        while ((match = regex.exec(streamContent)) !== null) {
          let text = match[1];
          
          // Handle hex encoded text
          if (regex.source.includes('0-9A-Fa-f')) {
            text = hexToString(text);
          } else {
            // Decode PDF string escapes
            text = decodePDFString(text);
          }
          
          if (text && text.trim().length > 0) {
            textParts.push(text.trim());
          }
        }
      }
    }
    
    // Join and clean up the extracted text
    let result = textParts.join(' ').trim();
    result = cleanupPDFText(result);
    
    return result;
  } catch (error) {
    console.error('Advanced PDF extraction error:', error);
    return '';
  }
}

// Fallback stream-based extraction
function extractTextFromPDFStreams(bytes: Uint8Array): string {
  try {
    const pdfString = new TextDecoder('latin1').decode(bytes);
    const textParts: string[] = [];
    
    // Look for text between BT (begin text) and ET (end text) operators
    const textBlocks = pdfString.match(/BT\s+.*?ET/gs) || [];
    
    for (const block of textBlocks) {
      // Extract all text strings
      const stringMatches = block.match(/\(([^)]*)\)/g) || [];
      for (const match of stringMatches) {
        const text = match.slice(1, -1); // Remove parentheses
        const cleanText = decodePDFString(text);
        if (cleanText && cleanText.trim().length > 0) {
          textParts.push(cleanText.trim());
        }
      }
    }
    
    let result = textParts.join(' ').trim();
    result = cleanupPDFText(result);
    
    return result;
  } catch (error) {
    console.error('Stream PDF extraction error:', error);
    return '';
  }
}

// Helper functions for PDF text processing
function decodePDFString(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\([0-7]{1,3})/g, (match, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\(.)/g, '$1');
}

function hexToString(hex: string): string {
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const charCode = parseInt(hex.substr(i, 2), 16);
    if (charCode >= 32 && charCode <= 126) {
      result += String.fromCharCode(charCode);
    } else if (charCode === 32) {
      result += ' ';
    }
  }
  return result;
}

function cleanupPDFText(text: string): string {
  return text
    .replace(/\s+/g, ' ')                    // Normalize whitespace
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')     // Remove non-printable chars except newlines
    .replace(/(.)\1{10,}/g, '$1')            // Remove character repetitions
    .trim();
}

function hasMinimumTextQuality(text: string): boolean {
  if (text.length < 50) return false;
  
  // Check for reasonable character distribution
  const printableChars = text.replace(/[^\x20-\x7E]/g, '').length;
  const ratio = printableChars / text.length;
  
  return ratio > 0.7; // At least 70% printable characters
}

// Enhanced DOCX text extraction with comprehensive content parsing
async function extractTextFromDOCX(base64Content: string): Promise<string> {
  try {
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`DOCX extraction: Processing ${bytes.length} bytes`);

    // Import JSZip for DOCX parsing
    const JSZip = (await import('https://deno.land/x/jszip@0.11.0/mod.ts')).default;
    
    // Parse DOCX as ZIP file
    const zip = await JSZip.loadAsync(bytes);
    const allTextParts: string[] = [];

    // Extract from main document
    const documentXML = await zip.file('word/document.xml')?.async('text');
    if (documentXML) {
      const mainText = extractTextFromDocumentXML(documentXML);
      if (mainText) allTextParts.push(mainText);
    }

    // Extract from headers
    const headerFiles = Object.keys(zip.files).filter(name => 
      name.startsWith('word/header') && name.endsWith('.xml')
    );
    for (const headerFile of headerFiles) {
      const headerXML = await zip.file(headerFile)?.async('text');
      if (headerXML) {
        const headerText = extractTextFromDocumentXML(headerXML);
        if (headerText) allTextParts.unshift(headerText); // Headers go first
      }
    }

    // Extract from footers
    const footerFiles = Object.keys(zip.files).filter(name => 
      name.startsWith('word/footer') && name.endsWith('.xml')
    );
    for (const footerFile of footerFiles) {
      const footerXML = await zip.file(footerFile)?.async('text');
      if (footerXML) {
        const footerText = extractTextFromDocumentXML(footerXML);
        if (footerText) allTextParts.push(footerText); // Footers go last
      }
    }

    const extractedText = allTextParts.join('\n\n').trim();
    console.log(`DOCX extraction: Processed ${headerFiles.length} headers, ${footerFiles.length} footers, extracted ${extractedText.length} characters`);
    
    return extractedText || '';
  } catch (error) {
    console.error('DOCX extraction error:', error);
    return '';
  }
}

// Extract text from document XML with enhanced parsing
function extractTextFromDocumentXML(xml: string): string {
  const textParts: string[] = [];
  
  try {
    // Extract from paragraphs (w:p elements) to preserve document structure
    const paragraphs = xml.match(/<w:p[^>]*>.*?<\/w:p>/gs) || [];
    
    for (const paragraph of paragraphs) {
      const paragraphText = extractTextFromParagraph(paragraph);
      if (paragraphText.trim()) {
        textParts.push(paragraphText.trim());
      }
    }
    
    // Extract from tables (w:tbl elements) with better formatting
    const tables = xml.match(/<w:tbl[^>]*>.*?<\/w:tbl>/gs) || [];
    for (const table of tables) {
      const tableText = extractTextFromTable(table);
      if (tableText.trim()) {
        textParts.push(tableText.trim());
      }
    }

    // Extract from text boxes and other drawing elements
    const drawingElements = xml.match(/<w:drawing[^>]*>.*?<\/w:drawing>/gs) || [];
    for (const drawing of drawingElements) {
      const drawingText = extractTextFromDrawing(drawing);
      if (drawingText.trim()) {
        textParts.push(drawingText.trim());
      }
    }
    
    return textParts.join('\n').trim();
  } catch (error) {
    console.error('Error extracting text from document XML:', error);
    return '';
  }
}

// Extract text from a paragraph with enhanced formatting
function extractTextFromParagraph(paragraph: string): string {
  try {
    // Extract all text runs (w:t) within the paragraph
    const textRuns = paragraph.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    const texts = textRuns.map(run => {
      const match = run.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
      return match ? match[1] : '';
    });

    // Extract hyperlink text
    const hyperlinks = paragraph.match(/<w:hyperlink[^>]*>.*?<\/w:hyperlink>/gs) || [];
    for (const hyperlink of hyperlinks) {
      const hyperlinkTexts = hyperlink.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      texts.push(...hyperlinkTexts.map(run => {
        const match = run.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
        return match ? match[1] : '';
      }));
    }

    return texts.join('').trim();
  } catch (error) {
    console.error('Error extracting paragraph text:', error);
    return '';
  }
}

// Extract text from tables with better structure preservation
function extractTextFromTable(table: string): string {
  try {
    const rows = table.match(/<w:tr[^>]*>.*?<\/w:tr>/gs) || [];
    const tableRows: string[] = [];
    
    for (const row of rows) {
      const cells = row.match(/<w:tc[^>]*>.*?<\/w:tc>/gs) || [];
      const cellTexts: string[] = [];
      
      for (const cell of cells) {
        const cellText = (cell.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
          .map(run => run.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
          .join(' ');
        if (cellText.trim()) {
          cellTexts.push(cellText.trim());
        }
      }
      
      if (cellTexts.length > 0) {
        tableRows.push(cellTexts.join(' | ')); // Use pipe separator for readability
      }
    }
    
    return tableRows.join('\n');
  } catch (error) {
    console.error('Error extracting table text:', error);
    return '';
  }
}

// Extract text from drawing elements (text boxes, etc.)
function extractTextFromDrawing(drawing: string): string {
  try {
    // Look for text in various drawing elements
    const textElements = drawing.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
    const texts = textElements.map(element => {
      const match = element.match(/<a:t[^>]*>([^<]*)<\/a:t>/);
      return match ? match[1] : '';
    });
    
    return texts.join(' ').trim();
  } catch (error) {
    console.error('Error extracting drawing text:', error);
    return '';
  }
}

// Fallback text extraction for plain text or unknown formats
function extractTextFallback(base64Content: string): string {
  try {
    return new TextDecoder().decode(
      Uint8Array.from(atob(base64Content), c => c.charCodeAt(0))
    );
  } catch (error) {
    console.error('Fallback extraction error:', error);
    return '';
  }
}

// Enhanced validation with detailed quality assessment
function validateExtractedText(text: string): boolean {
  if (!text || text.length < 50) {
    console.log('Validation failed: Text too short or empty');
    return false;
  }
  
  // Check for reasonable text-to-noise ratio
  const printableChars = text.replace(/[^\x20-\x7E\n\r\t]/g, '').length;
  const ratio = printableChars / text.length;
  
  if (ratio < 0.5) {
    console.log(`Validation failed: Low printable character ratio: ${ratio}`);
    return false;
  }
  
  // Check for resume-like content (expanded keywords)
  const resumeKeywords = [
    // Professional terms
    'experience', 'education', 'skill', 'work', 'employment', 'job', 
    'company', 'position', 'role', 'responsibility', 'achievement',
    'university', 'degree', 'certificate', 'project', 'team',
    'manage', 'develop', 'lead', 'coordinate', 'implement',
    // Contact/personal info indicators
    'phone', 'email', 'address', 'linkedin', 'github',
    // Resume structure indicators
    'summary', 'objective', 'profile', 'background', 'qualifications',
    // Professional actions
    'created', 'designed', 'built', 'analyzed', 'improved', 'organized'
  ];
  
  const lowerText = text.toLowerCase();
  const foundKeywords = resumeKeywords.filter(keyword => 
    lowerText.includes(keyword)
  );
  
  console.log(`Validation check: Found ${foundKeywords.length} resume keywords: [${foundKeywords.slice(0, 5).join(', ')}${foundKeywords.length > 5 ? '...' : ''}]`);
  
  // More lenient validation - at least 2 resume-related keywords
  return foundKeywords.length >= 2;
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

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { fileContent, fileName, fileType } = await req.json();
    
    if (!fileContent) {
      throw new Error('No file content provided');
    }

    console.log(`Processing resume: ${fileName} (${fileType})`);

    // Extract text based on file type using proper parsing
    let extractedText = '';
    
    if (fileType === 'text/plain') {
      // For plain text files, decode base64
      extractedText = extractTextFallback(fileContent);
    } else if (fileType === 'application/pdf') {
      // For PDF files, use proper PDF text extraction
      console.log('Attempting PDF text extraction...');
      extractedText = await extractTextFromPDF(fileContent);
      
      // Log extraction results without binary fallback
      if (!validateExtractedText(extractedText)) {
        console.warn('PDF extraction failed - no readable text found. May be image-based PDF or corrupted.');
      }
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // For DOCX files, use proper DOCX text extraction
      console.log('Attempting DOCX text extraction...');
      extractedText = await extractTextFromDOCX(fileContent);
      
      // Log extraction results without binary fallback
      if (!validateExtractedText(extractedText)) {
        console.warn('DOCX extraction failed - no readable text found. May be corrupted or password-protected.');
      }
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Final validation
    if (!validateExtractedText(extractedText)) {
      console.warn(`Low quality text extraction for ${fileName}. Text length: ${extractedText.length}`);
      console.warn('First 200 chars:', extractedText.substring(0, 200));
    }

    console.log(`Extracted text length: ${extractedText.length} characters`);
    console.log('Text quality check passed:', validateExtractedText(extractedText));

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
            content: `You are an expert resume parsing AI trained to generate structured Profile Summaries from candidate resumes. Extract structured information and return ONLY valid JSON with no markdown formatting.

CRITICAL INSTRUCTIONS:

1. ROLE & INDUSTRY DETECTION - First analyze the resume to identify:
   - The candidate's actual profession (e.g., Recruiter, Software Engineer, Marketing Manager, Sales Director, etc.)
   - Their industry and specialization
   - Years of experience in their field
   - Do NOT default to software developer assumptions

2. LOCATION EXTRACTION - Look for location clues in:
   - Header addresses (street, city, state, zip codes)
   - Phone number area codes (e.g., 415 = San Francisco, 212 = New York)
   - Email domain endings (e.g., .uk = United Kingdom)
   - Explicitly mentioned locations in work experience
   - Current residence statements
   - Extract full location hierarchy: Country > State/Province > City

3. PROFILE SUMMARY CREATION - Generate a structured, professional Profile Summary using HTML formatting:

   Structure:
   <h3>Profile Summary</h3>
   
   <h4>Professional Background</h4>
   <p>Brief professional overview: years of experience, key industries, roles, and strengths based on their actual profession.</p>
   
   <h4>Professional Experience</h4>
   <p>2–4 most relevant roles with <strong>Company Name</strong>, job title, <em>employment dates</em>, and key contributions/achievements.</p>
   
   <h4>Core Competencies</h4>
   <p>List core skills, technologies, or tools that align with their actual experience and industry.</p>
   
   <h4>Education & Certifications</h4>
   <p>List relevant education, languages, or certifications only if present in the resume.</p>
   
   <h4>Professional Impact</h4>
   <p>Short summary of professional values or measurable impact if discernible from the resume.</p>

   Formatting Rules:
   - Use <strong>Company Name</strong> for company names
   - Use <em>Jan 2022 – Mar 2024</em> for employment dates
   - Break information into digestible segments
   - Ensure every section adds meaningful value
   - Use clear, confident, professional tone
   - No exaggerations or vague phrases unless backed by evidence

4. SALARY EXTRACTION - Look for:
   - Salary expectations or requirements
   - Previous compensation mentioned
   - Hourly rates or annual figures
   - Extract number only, identify currency

5. DATA VALIDATION:
   - Ensure LinkedIn URLs are properly formatted
   - Validate location data makes geographic sense
   - Create meaningful, role-specific profile summaries

REQUIRED JSON FIELDS:
- candidate_name: Full name (First Last format)
- linkedin_url: Complete LinkedIn URL or empty string
- location_country: Full country name
- location_state: State/Province/Region name  
- location_city: City name
- salary_amount: Numeric value only (no symbols)
- salary_currency: ISO currency code (USD, EUR, GBP, etc.)
- profile_summary: HTML-formatted structured profile summary
- notes: Additional relevant information for recruiting team

Return empty string for missing text fields, null for missing numbers.`
          },
          {
            role: 'user',
            content: `Parse this resume and extract the information as JSON:\n\n${extractedText}`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
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