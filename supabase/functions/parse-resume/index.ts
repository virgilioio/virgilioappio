import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Enhanced PDF text extraction with multiple methods
async function extractTextFromPDF(base64Content: string): Promise<string> {
  try {
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`PDF extraction: Processing ${bytes.length} bytes`);

    // Method 1: Try enhanced manual PDF parsing
    let extractedText = extractTextFromPDFEnhanced(bytes);
    
    if (extractedText && extractedText.length > 10) {
      console.log(`PDF extraction: Enhanced method successful, extracted ${extractedText.length} characters`);
      console.log(`PDF text preview: ${extractedText.substring(0, 200)}...`);
      return cleanupExtractedText(extractedText);
    }

    // Method 2: Try simple PDF parsing as fallback
    console.log('PDF extraction: Trying simple PDF parsing fallback');
    extractedText = extractTextFromPDFSimple(bytes);
    
    if (extractedText && extractedText.length > 5) {
      console.log(`PDF extraction: Simple method successful, extracted ${extractedText.length} characters`);
      console.log(`PDF text preview: ${extractedText.substring(0, 200)}...`);
      return cleanupExtractedText(extractedText);
    }

    // Method 3: Try basic text extraction
    console.log('PDF extraction: Trying basic text extraction');
    extractedText = extractBasicText(bytes);
    
    if (extractedText && extractedText.length > 3) {
      console.log(`PDF extraction: Basic method successful, extracted ${extractedText.length} characters`);
      console.log(`PDF text preview: ${extractedText.substring(0, 200)}...`);
      return cleanupExtractedText(extractedText);
    }

    console.warn('PDF extraction: All methods failed to extract readable text');
    return '';
  } catch (error) {
    console.error('PDF extraction error:', error);
    return '';
  }
}

// Enhanced PDF text extraction with multiple extraction techniques
function extractTextFromPDFEnhanced(bytes: Uint8Array): string {
  try {
    const pdfString = new TextDecoder('latin1').decode(bytes);
    const textParts: string[] = [];
    
    // Enhanced pattern matching with better text operators coverage
    const patterns = [
      // Text show operators with optional spacing
      /\(([^)]+)\)\s*(?:Tj|TJ|'|"|T\*)/gi,
      // Array text operators
      /\[([^\]]+)\]\s*TJ/gi,
      // Hex encoded text with proper decoding
      /<([0-9A-Fa-f\s]+)>\s*(?:Tj|TJ)/gi,
      // Text blocks with enhanced capture
      /BT[\s\S]*?\(([^)]+)\)[\s\S]*?ET/gi,
      // Font and text combined patterns
      /\/F\d+\s+\d+\s+Tf[\s\S]*?\(([^)]+)\)/gi,
      // Direct text content without operators
      /q[\s\S]*?\(([^)]+)\)[\s\S]*?Q/gi,
      // URL and link annotations
      /\/URI\s*\(([^)]+)\)/gi,
      // Annotation content
      /\/Contents\s*\(([^)]+)\)/gi
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(pdfString)) !== null) {
        let text = match[1];
        
        if (text) {
          // Handle hex encoded text
          if (pattern.source.includes('0-9A-Fa-f')) {
            text = hexToString(text.replace(/\s/g, ''));
          } else {
            // Handle PDF string escapes
            text = decodePDFString(text);
          }
          
          // Clean and validate text
          text = text
            .replace(/\s+/g, ' ')
            .trim();
          
          if (text && text.length > 1 && !/^[\s\x00-\x1F\x7F-\x9F]*$/.test(text)) {
            textParts.push(text);
          }
        }
      }
    }
    
    // Extract URLs directly from the raw PDF string
    const urlPatterns = [
      /https?:\/\/[^\s)>\]]+/gi,
      /www\.[^\s)>\]]+/gi,
      /linkedin\.com\/in\/[^\s)>\]]+/gi,
      /github\.com\/[^\s)>\]]+/gi
    ];
    
    for (const urlPattern of urlPatterns) {
      const urlMatches = pdfString.match(urlPattern);
      if (urlMatches) {
        textParts.push(...urlMatches.map(url => url.trim()));
      }
    }
    
    return cleanupExtractedText(textParts.join(' '));
  } catch (error) {
    console.error('Enhanced PDF extraction error:', error);
    return '';
  }
}

// Basic text extraction for any readable content
function extractBasicText(bytes: Uint8Array): string {
  try {
    // Try multiple encoding approaches
    const encodings = ['utf-8', 'latin1', 'ascii'];
    let bestText = '';
    let maxScore = 0;
    
    for (const encoding of encodings) {
      try {
        const decoded = new TextDecoder(encoding, { fatal: false }).decode(bytes);
        // Extract any sequences of printable characters
        const textMatches = decoded.match(/[\x20-\x7E]{3,}/g);
        
        if (textMatches) {
          const text = textMatches
            .filter(match => match.length > 2)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Score based on text quality
          const score = text.length * (text.match(/[a-zA-Z]/g)?.length || 0) / text.length;
          
          if (score > maxScore) {
            maxScore = score;
            bestText = text;
          }
        }
      } catch (e) {
        // Continue with next encoding
      }
    }
    
    return bestText;
  } catch (error) {
    console.error('Basic text extraction error:', error);
    return '';
  }
}

// Manual PDF text extraction using improved patterns
function extractTextFromPDFManual(bytes: Uint8Array): string {
  try {
    const pdfString = new TextDecoder('latin1').decode(bytes);
    const textParts: string[] = [];
    
    // Look for text content in various PDF structures
    const patterns = [
      // Text in parentheses with text operators
      /\(([^)]+)\)\s*(?:Tj|TJ|'|")/gi,
      // Text in brackets
      /\[([^\]]+)\]\s*TJ/gi,
      // Hex encoded text
      /<([0-9A-Fa-f\s]+)>\s*(?:Tj|TJ)/gi,
      // Text between BT and ET operators
      /BT\s+.*?\(([^)]+)\).*?ET/gi,
      // Simple text patterns
      /\/F\d+\s+\d+\s+Tf\s*\(([^)]+)\)/gi
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(pdfString)) !== null) {
        let text = match[1];
        
        if (text) {
          // Handle hex encoded text
          if (pattern.source.includes('0-9A-Fa-f')) {
            text = hexToString(text.replace(/\s/g, ''));
          }
          
          // Clean up text content
          text = text
            .replace(/\\n/g, ' ')
            .replace(/\\r/g, ' ')
            .replace(/\\t/g, ' ')
            .replace(/\\(.)/g, '$1')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (text && text.length > 1 && !/^[\s\x00-\x1F]*$/.test(text)) {
            textParts.push(text);
          }
        }
      }
    }
    
    return textParts.join(' ').trim();
  } catch (error) {
    console.error('Manual PDF extraction error:', error);
    return '';
  }
}

// Improved PDF extraction fallback method
function extractTextFromPDFSimple(bytes: Uint8Array): string {
  try {
    const pdfString = new TextDecoder('latin1').decode(bytes);
    const textParts: string[] = [];
    
    // Look for simple text patterns
    const patterns = [
      /\(([^)]+)\)\s*Tj/g,           // Basic text show
      /\(([^)]+)\)\s*TJ/g,           // Text with arrays
      /\(([^)]+)\)\s*'/g,            // Move and show
      /BT\s+.*?\(([^)]+)\).*?ET/gs   // Text blocks
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(pdfString)) !== null) {
        const text = match[1];
        if (text && text.length > 1 && !/^[\s\x00-\x1F]+$/.test(text)) {
          textParts.push(text.trim());
        }
      }
    }
    
    return textParts.join(' ').trim();
  } catch (error) {
    console.error('Simple PDF extraction error:', error);
    return '';
  }
}

// Enhanced text cleanup function
function cleanupExtractedText(text: string): string {
  return text
    .replace(/\s+/g, ' ')                    // Normalize whitespace
    .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')   // Remove control characters
    .replace(/[^\x20-\x7E\s]/g, ' ')         // Keep only printable ASCII and whitespace
    .replace(/(.)\1{5,}/g, '$1')             // Remove excessive character repetition
    .replace(/\s+/g, ' ')                    // Final whitespace normalization
    .trim();
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

// Enhanced text quality validation for resume content
function validateExtractedText(text: string): boolean {
  if (!text || text.length < 3) {
    console.log('Validation failed: Text too short or empty');
    return false;
  }
  
  // Very lenient validation - just check if we have some readable content
  const words = text.split(/\s+/).filter(word => word.length > 0);
  
  if (words.length < 2) {
    console.log(`Validation failed: Too few words: ${words.length}`);
    return false;
  }
  
  console.log(`Validation passed: Found ${words.length} words, text length: ${text.length}`);
  console.log(`Text preview: ${text.substring(0, 200)}...`);
  
  return true;
}

// Check if text contains resume-like content
function hasResumeContent(text: string): boolean {
  const resumeIndicators = [
    /\b(experience|work|employment|job|position|role)\b/i,
    /\b(education|university|college|degree|bachelor|master)\b/i,
    /\b(skills|technologies|tools|software)\b/i,
    /\b(email|phone|linkedin|github)\b/i,
    /\b(company|organization|corp|inc|ltd)\b/i,
    /\b\d{4}\b/, // Years
    /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email patterns
    /linkedin\.com/i,
    /github\.com/i
  ];
  
  const matches = resumeIndicators.filter(pattern => pattern.test(text)).length;
  console.log(`Resume content indicators found: ${matches}/9`);
  
  return matches >= 2; // At least 2 resume indicators
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
    
    // Check if extracted text contains resume-like content
    const hasValidResumeContent = hasResumeContent(extractedText);
    console.log('Resume content validation:', hasValidResumeContent);
    
    // Log the actual text being sent to OpenAI for debugging
    console.log('Text being sent to OpenAI (first 500 chars):', extractedText.substring(0, 500));
    if (extractedText.length > 500) {
      console.log('...and last 500 chars:', extractedText.substring(extractedText.length - 500));
    }

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
            content: `You are an expert resume parsing AI. Extract ONLY information that is clearly present in the resume text. DO NOT generate generic content. Return ONLY valid JSON with no markdown formatting.

CRITICAL INSTRUCTIONS:

1. CONSERVATIVE EXTRACTION - Only extract information that is EXPLICITLY stated in the resume:
   - If information is not clearly present, return empty string or null
   - DO NOT create generic descriptions or summaries
   - DO NOT make assumptions about experience or skills not mentioned

2. URL EXTRACTION - Look for complete URLs in the text:
   - LinkedIn URLs: Must be complete URLs starting with https://linkedin.com or www.linkedin.com
   - GitHub URLs: Must be complete URLs starting with https://github.com
   - Portfolio URLs: Extract any other professional URLs found
   - DO NOT construct URLs if they're not explicitly provided

3. PROFILE SUMMARY - Create summary ONLY from actual resume content:
   - Use the person's actual work experience, companies, and roles
   - Include specific skills, technologies, and achievements mentioned
   - Use dates and company names from the resume
   - If insufficient information is available, create a brief summary with available facts
   - NEVER use generic phrases like "seasoned professional" unless justified by actual experience

4. LOCATION EXTRACTION - Look for explicit location information:
   - Address headers, contact sections
   - Current location statements
   - Work location mentions
   - Phone area codes as hints only

5. NAME EXTRACTION - Extract the candidate's full name from:
   - Header sections
   - Contact information areas
   - Resume title areas

6. TEXT QUALITY CHECK - Before processing:
   - If the extracted text appears to be mostly symbols, random characters, or very fragmented
   - Return empty values rather than guessing

LINKEDIN URL PATTERNS TO LOOK FOR:
- https://linkedin.com/in/username
- https://www.linkedin.com/in/username  
- linkedin.com/in/username
- www.linkedin.com/in/username

REQUIRED JSON FIELDS:
- candidate_name: Actual name found in resume or empty string
- linkedin_url: Complete LinkedIn URL if found or empty string
- location_country: Country if clearly stated or empty string
- location_state: State/Province if clearly stated or empty string
- location_city: City if clearly stated or empty string
- salary_amount: Numeric salary if mentioned or null
- salary_currency: Currency code if salary mentioned or "USD"
- profile_summary: Factual summary from actual resume content or empty string
- notes: Relevant additional info found or empty string

IMPORTANT: Return empty strings/null if information is not clearly available. Do not generate placeholder content.`
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