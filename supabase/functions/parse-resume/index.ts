import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Parsed resume interface with structured data
interface ParsedResume {
  rawText: string;
  sections?: {
    contact?: string;
    summary?: string;
    experience?: string[];
    education?: string[];
  };
  urls: string[];
}

// Enhanced PDF text extraction with structure preservation
async function extractTextFromPDF(base64Content: string): Promise<ParsedResume> {
  try {
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`PDF extraction: Processing ${bytes.length} bytes`);

    // Extract text with structure preservation
    const result = extractStructuredTextFromPDF(bytes);
    
    if (result.rawText && result.rawText.length > 50) {
      console.log(`PDF extraction: Successful, extracted ${result.rawText.length} characters`);
      console.log(`Found ${result.urls.length} URLs`);
      console.log(`PDF text preview: ${result.rawText.substring(0, 300)}...`);
      return result;
    }

    // Fallback to basic extraction
    console.log('PDF extraction: Trying fallback method');
    const fallbackText = extractBasicTextFromPDF(bytes);
    
    if (fallbackText && fallbackText.length > 20) {
      console.log(`PDF extraction: Fallback successful, extracted ${fallbackText.length} characters`);
      return {
        rawText: cleanupExtractedText(fallbackText),
        urls: extractURLsFromText(fallbackText),
      };
    }

    console.warn('PDF extraction: All methods failed to extract readable text');
    return { rawText: '', urls: [] };
  } catch (error) {
    console.error('PDF extraction error:', error);
    return { rawText: '', urls: [] };
  }
}

// Enhanced PDF text extraction with structure preservation
function extractStructuredTextFromPDF(bytes: Uint8Array): ParsedResume {
  try {
    const pdfString = new TextDecoder('latin1').decode(bytes);
    const textSegments: string[] = [];
    const urls: string[] = [];
    
    // Enhanced patterns for better structure preservation
    const textPatterns = [
      // Text show operators with position tracking
      /\s*(\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+(?:Td|TD))\s*\(([^)]+)\)\s*(?:Tj|TJ|'|")/gi,
      // Regular text operators
      /\(([^)]+)\)\s*(?:Tj|TJ|'|"|T\*)/gi,
      // Array text with better structure
      /\[([^\]]+)\]\s*TJ/gi,
      // Hex encoded text
      /<([0-9A-Fa-f\s]+)>\s*(?:Tj|TJ)/gi,
      // Text blocks with positioning
      /BT\s*([\s\S]*?)\s*ET/gi,
    ];
    
    // Extract URLs first to preserve them
    const urlPatterns = [
      /https?:\/\/[^\s)>\]}"']+/gi,
      /www\.[^\s)>\]}"']+/gi,
      /linkedin\.com\/in\/[^\s)>\]}"']+/gi,
      /github\.com\/[^\s)>\]}"']+/gi,
      /\/URI\s*\(([^)]+)\)/gi
    ];
    
    for (const urlPattern of urlPatterns) {
      let match;
      while ((match = urlPattern.exec(pdfString)) !== null) {
        let url = match[1] || match[0];
        if (url.startsWith('(') && url.endsWith(')')) {
          url = url.slice(1, -1);
        }
        url = url.replace(/[()]/g, '').trim();
        if (url && (url.includes('linkedin') || url.includes('github') || url.startsWith('http'))) {
          urls.push(url);
        }
      }
    }
    
    // Extract text with structure awareness
    for (const pattern of textPatterns) {
      let match;
      while ((match = pattern.exec(pdfString)) !== null) {
        let text = match[match.length - 1]; // Get the text part
        
        if (text) {
          // Handle hex encoded text
          if (/^[0-9A-Fa-f\s]+$/.test(text)) {
            text = hexToString(text.replace(/\s/g, ''));
          } else {
            // Handle PDF string escapes
            text = decodePDFString(text);
          }
          
          // Preserve structure by detecting line breaks and spacing
          text = text
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\n')
            .replace(/\s{2,}/g, ' ')
            .trim();
          
          if (text && text.length > 1 && !/^[\s\x00-\x1F\x7F-\x9F]*$/.test(text)) {
            textSegments.push(text);
          }
        }
      }
    }
    
    // Join segments with proper spacing to preserve document structure
    const rawText = textSegments
      .filter(segment => segment.length > 1)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Attempt basic section detection
    const sections = detectSections(rawText);
    
    return {
      rawText: cleanupExtractedText(rawText),
      sections,
      urls: [...new Set(urls)] // Remove duplicates
    };
  } catch (error) {
    console.error('Structured PDF extraction error:', error);
    return { rawText: '', urls: [] };
  }
}

// Detect common resume sections
function detectSections(text: string): ParsedResume['sections'] {
  const sections: ParsedResume['sections'] = {};
  
  try {
    // Look for contact information (usually at the top)
    const contactMatch = text.match(/^(.{0,500}?)(?:EXPERIENCE|EDUCATION|SKILLS|SUMMARY)/i);
    if (contactMatch) {
      sections.contact = contactMatch[1].trim();
    }
    
    // Look for summary/objective
    const summaryMatch = text.match(/(?:SUMMARY|OBJECTIVE|PROFILE)[\s:]*([^]*?)(?:EXPERIENCE|EDUCATION|SKILLS|$)/i);
    if (summaryMatch) {
      sections.summary = summaryMatch[1].trim();
    }
    
    // Look for experience sections
    const experienceMatches = text.match(/(?:EXPERIENCE|EMPLOYMENT|WORK HISTORY)[\s:]*([^]*?)(?:EDUCATION|SKILLS|$)/i);
    if (experienceMatches) {
      // Split experience into individual entries
      sections.experience = experienceMatches[1]
        .split(/\n\s*\n|\d{4}\s*-|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i)
        .filter(exp => exp.trim().length > 20)
        .map(exp => exp.trim());
    }
    
    // Look for education
    const educationMatch = text.match(/(?:EDUCATION|ACADEMIC)[\s:]*([^]*?)(?:SKILLS|EXPERIENCE|$)/i);
    if (educationMatch) {
      sections.education = educationMatch[1]
        .split(/\n\s*\n|\d{4}\s*-/)
        .filter(edu => edu.trim().length > 10)
        .map(edu => edu.trim());
    }
  } catch (error) {
    console.log('Section detection failed:', error);
  }
  
  return sections;
}

// Fallback PDF extraction using basic text patterns  
function extractBasicTextFromPDF(bytes: Uint8Array): string {
  try {
    const pdfString = new TextDecoder('latin1').decode(bytes);
    const textParts: string[] = [];
    
    // Simple but reliable text extraction patterns
    const patterns = [
      /\(([^)]+)\)\s*Tj/g,
      /\(([^)]+)\)\s*TJ/g,
      /\(([^)]+)\)\s*'/g,
      /BT\s+.*?\(([^)]+)\).*?ET/gs
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(pdfString)) !== null) {
        const text = decodePDFString(match[1]);
        if (text && text.length > 1 && !/^[\s\x00-\x1F]+$/.test(text)) {
          textParts.push(text.trim());
        }
      }
    }
    
    return textParts.join(' ').trim();
  } catch (error) {
    console.error('Basic PDF extraction error:', error);
    return '';
  }
}

// Extract URLs from any text
function extractURLsFromText(text: string): string[] {
  const urls: string[] = [];
  const urlPatterns = [
    /https?:\/\/[^\s)>\]}"']+/gi,
    /www\.[^\s)>\]}"']+/gi,
    /linkedin\.com\/in\/[^\s)>\]}"']+/gi,
    /github\.com\/[^\s)>\]}"']+/gi
  ];
  
  for (const pattern of urlPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      urls.push(...matches.map(url => url.trim()));
    }
  }
  
  return [...new Set(urls)]; // Remove duplicates
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
async function extractTextFromDOCX(base64Content: string): Promise<ParsedResume> {
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
    
    const urls = extractURLsFromText(extractedText);
    const sections = detectSections(extractedText);
    
    return {
      rawText: extractedText || '',
      sections,
      urls
    };
  } catch (error) {
    console.error('DOCX extraction error:', error);
    return { rawText: '', urls: [] };
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
function extractTextFallback(base64Content: string): ParsedResume {
  try {
    const rawText = new TextDecoder().decode(
      Uint8Array.from(atob(base64Content), c => c.charCodeAt(0))
    );
    
    return {
      rawText,
      urls: extractURLsFromText(rawText),
      sections: detectSections(rawText)
    };
  } catch (error) {
    console.error('Fallback extraction error:', error);
    return { rawText: '', urls: [] };
  }
}

// Pre-AI validation for resume text quality
function validateResumeQuality(parsedResume: ParsedResume): { isValid: boolean; error?: string } {
  const { rawText, urls } = parsedResume;
  
  // Rule 1: Minimum text length
  if (rawText.length < 1000) {
    return {
      isValid: false,
      error: "We couldn't extract enough information from this resume. Please upload a cleaner file or complete the fields manually."
    };
  }
  
  // Rule 2: Must include resume keywords
  const requiredKeywords = ['experience', 'skills', 'education', 'contact', 'summary', 'work', 'job', 'position'];
  const foundKeywords = requiredKeywords.filter(keyword => 
    rawText.toLowerCase().includes(keyword)
  );
  
  if (foundKeywords.length < 2) {
    return {
      isValid: false,
      error: "This doesn't appear to be a resume file. Please upload a resume document or complete the fields manually."
    };
  }
  
  // Rule 3: Must contain contact information (email or LinkedIn)
  const hasEmail = /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(rawText);
  const hasLinkedIn = urls.some(url => url.toLowerCase().includes('linkedin')) || 
                     rawText.toLowerCase().includes('linkedin');
  
  if (!hasEmail && !hasLinkedIn) {
    return {
      isValid: false,
      error: "We couldn't find contact information in this resume. Please check the file quality or enter information manually."
    };
  }
  
  // Rule 4: Must have paragraph structure
  const paragraphs = rawText.split(/\n\s*\n/).filter(p => p.trim().length > 20);
  if (paragraphs.length < 2) {
    return {
      isValid: false,
      error: "This file doesn't appear to have a proper resume structure. Please try a different format or enter information manually."
    };
  }
  
  return { isValid: true };
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

    // Extract structured text based on file type
    let parsedResume: ParsedResume;
    
    try {
      if (fileType === 'text/plain') {
        console.log('Processing plain text file...');
        parsedResume = extractTextFallback(fileContent);
      } else if (fileType === 'application/pdf') {
        console.log('Attempting PDF text extraction...');
        parsedResume = await extractTextFromPDF(fileContent);
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        console.log('Attempting DOCX text extraction...');
        parsedResume = await extractTextFromDOCX(fileContent);
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (extractionError) {
      console.error('File extraction failed:', extractionError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "This file could not be processed. Please try another format or complete the fields manually."
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pre-AI validation
    const validation = validateResumeQuality(parsedResume);
    if (!validation.isValid) {
      console.warn(`Resume validation failed for ${fileName}: ${validation.error}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: validation.error
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Extracted text length: ${parsedResume.rawText.length} characters`);
    console.log(`Found ${parsedResume.urls.length} URLs: ${parsedResume.urls.join(', ')}`);
    console.log('Resume validation passed - proceeding to AI parsing');
    
    // Log structured data being sent to OpenAI
    console.log('Text being sent to OpenAI (first 500 chars):', parsedResume.rawText.substring(0, 500));
    if (parsedResume.rawText.length > 500) {
      console.log('...and last 500 chars:', parsedResume.rawText.substring(parsedResume.rawText.length - 500));
    }
    if (parsedResume.sections?.contact) {
      console.log('Contact section preview:', parsedResume.sections.contact.substring(0, 200));
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
            content: `Parse this resume and extract the information as JSON:

RESUME TEXT:
${parsedResume.rawText}

${parsedResume.urls.length > 0 ? `\nFOUND URLs: ${parsedResume.urls.join(', ')}` : ''}

${parsedResume.sections?.contact ? `\nCONTACT SECTION: ${parsedResume.sections.contact}` : ''}

Please extract the candidate information and return as JSON.`
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