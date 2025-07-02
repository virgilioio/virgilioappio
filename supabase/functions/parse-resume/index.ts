import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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
  confidence: {
    name: 'high' | 'medium' | 'low';
    location: 'high' | 'medium' | 'low';
    experience: 'high' | 'medium' | 'low';
    overall: 'high' | 'medium' | 'low';
  };
}

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

// Enhanced PDF text extraction using multiple strategies
async function extractTextFromPDF(base64Content: string): Promise<string> {
  try {
    console.log('Starting enhanced PDF text extraction...');
    
    // Strategy 1: Try basic PDF text extraction
    const pdfText = await extractPDFTextBasic(base64Content);
    if (pdfText && pdfText.length > 100) {
      console.log('PDF text extraction successful:', pdfText.length, 'characters');
      return pdfText;
    }
    
    // Strategy 2: Fallback to raw text extraction
    console.log('PDF extraction failed, trying raw text extraction...');
    return await extractTextFallback(base64Content);
    
  } catch (error) {
    console.error('PDF extraction failed:', error);
    return await extractTextFallback(base64Content);
  }
}

// Basic PDF text extraction
async function extractPDFTextBasic(base64Content: string): Promise<string> {
  try {
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Simple PDF text extraction - look for text streams
    const pdfString = new TextDecoder('latin1').decode(bytes);
    const textMatches = pdfString.match(/\((.*?)\)[\s]*Tj/g) || [];
    const streamMatches = pdfString.match(/stream\s+(.*?)\s+endstream/gs) || [];
    
    let extractedText = '';
    
    // Extract text from Tj operators
    for (const match of textMatches) {
      const text = match.replace(/^\(|\)[\s]*Tj$/g, '');
      if (text && text.length > 1) {
        extractedText += text + ' ';
      }
    }
    
    // Extract text from streams (simple approach)
    for (const stream of streamMatches) {
      const streamContent = stream.replace(/^stream\s+|\s+endstream$/g, '');
      // Look for readable text patterns
      const readableText = streamContent.match(/[A-Za-z0-9\s@.-]{3,}/g) || [];
      extractedText += readableText.join(' ') + ' ';
    }
    
    return extractedText.trim();
  } catch (error) {
    console.error('Basic PDF extraction failed:', error);
    throw error;
  }
}

// Enhanced DOCX text extraction
async function extractTextFromDOCX(base64Content: string): Promise<string> {
  try {
    console.log('Starting enhanced DOCX text extraction...');
    
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

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

    // Extract from headers and footers
    const headerFiles = Object.keys(zip.files).filter(name => name.startsWith('word/header'));
    const footerFiles = Object.keys(zip.files).filter(name => name.startsWith('word/footer'));
    
    for (const headerFile of headerFiles) {
      const headerXML = await zip.file(headerFile)?.async('text');
      if (headerXML) {
        const headerText = extractTextFromDocumentXML(headerXML);
        if (headerText) allTextParts.push(headerText);
      }
    }
    
    for (const footerFile of footerFiles) {
      const footerXML = await zip.file(footerFile)?.async('text');
      if (footerXML) {
        const footerText = extractTextFromDocumentXML(footerXML);
        if (footerText) allTextParts.push(footerText);
      }
    }

    const extractedText = allTextParts.join('\n\n').trim();
    console.log('DOCX extraction successful:', extractedText.length, 'characters');
    return extractedText;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    return await extractTextFallback(base64Content);
  }
}

// Extract text from document XML with better parsing
function extractTextFromDocumentXML(xml: string): string {
  const textParts: string[] = [];
  
  try {
    // Extract paragraphs
    const paragraphs = xml.match(/<w:p[^>]*>.*?<\/w:p>/gs) || [];
    
    for (const paragraph of paragraphs) {
      // Extract text runs
      const textRuns = paragraph.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const texts = textRuns.map(run => {
        const match = run.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
        return match ? match[1] : '';
      });

      const paragraphText = texts.join('').trim();
      if (paragraphText && paragraphText.length > 0) {
        textParts.push(paragraphText);
      }
    }
    
    // Extract table content
    const tables = xml.match(/<w:tbl[^>]*>.*?<\/w:tbl>/gs) || [];
    for (const table of tables) {
      const cells = table.match(/<w:tc[^>]*>.*?<\/w:tc>/gs) || [];
      for (const cell of cells) {
        const cellTextRuns = cell.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
        const cellTexts = cellTextRuns.map(run => {
          const match = run.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
          return match ? match[1] : '';
        });
        const cellText = cellTexts.join(' ').trim();
        if (cellText) {
          textParts.push(cellText);
        }
      }
    }
    
    return textParts.join('\n').trim();
  } catch (error) {
    console.error('Error extracting text from document XML:', error);
    return '';
  }
}

// Fallback text extraction
async function extractTextFallback(base64Content: string): Promise<string> {
  try {
    console.log('Using fallback text extraction...');
    const rawText = new TextDecoder().decode(
      Uint8Array.from(atob(base64Content), c => c.charCodeAt(0))
    );
    
    // Clean up the raw text
    return rawText
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Remove non-printable characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  } catch (error) {
    console.error('Fallback extraction error:', error);
    return '';
  }
}

// Enhanced section detection with better parsing
function detectSectionsFromText(text: string): ParsedResume['sections'] {
  console.log('Starting enhanced section detection...');
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const sections: ParsedResume['sections'] = {};
  
  // 1. Enhanced Contact Section Detection
  sections.contact = parseContactSection(lines);
  
  // 2. Enhanced Experience Section Detection
  sections.experience = parseExperienceSection(text, lines);
  
  // 3. Enhanced Education Section Detection
  sections.education = parseEducationSection(text, lines);
  
  // 4. Enhanced Skills Section Detection
  sections.skills = parseSkillsSection(text, lines);
  
  console.log('Section detection completed:', {
    hasContact: !!sections.contact,
    experienceCount: sections.experience?.length || 0,
    educationCount: sections.education?.length || 0,
    skillsCount: sections.skills?.length || 0
  });
  
  return sections;
}

// Enhanced contact section parsing
function parseContactSection(lines: string[]): ParsedResume['sections']['contact'] {
  const contact: ParsedResume['sections']['contact'] = {};
  const fullText = lines.join('\n');
  
  console.log('Parsing contact section from', lines.length, 'lines');
  
  // Name detection - improved algorithm
  const namePatterns = [
    // First line that looks like a name (not email/phone/linkedin)
    /^([A-Z][a-záéíóúñü]+(?:\s+[A-Z][a-záéíóúñü]+)+)$/i,
    // Name with potential titles
    /^(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?)?\s*([A-Z][a-záéíóúñü]+(?:\s+[A-Z][a-záéíóúñü]+)+)(?:\s*,?\s*(?:Jr\.?|Sr\.?|III?|PhD|MD))?$/i
  ];
  
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (!/@/.test(line) && 
        !/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(line) &&
        !/linkedin|github|http/i.test(line) &&
        line.length >= 4 && line.length <= 50) {
      
      for (const pattern of namePatterns) {
        const match = line.match(pattern);
        if (match) {
          contact.name = match[1].trim();
          console.log('Name found:', contact.name);
          break;
        }
      }
      
      if (contact.name) break;
      
      // Fallback: if line looks like a name
      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 4 && 
          words.every(word => /^[A-Za-záéíóúñü]+$/.test(word))) {
        contact.name = line;
        console.log('Name found (fallback):', contact.name);
        break;
      }
    }
  }
  
  // Email detection
  const emailMatch = fullText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) {
    contact.email = emailMatch[0];
    console.log('Email found:', contact.email);
  }
  
  // Phone detection - enhanced patterns
  const phonePatterns = [
    /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    /(\+\d{1,3}\s?)?\d{10,14}/,
    /\(\d{3}\)\s?\d{3}-?\d{4}/
  ];
  
  for (const pattern of phonePatterns) {
    const phoneMatch = fullText.match(pattern);
    if (phoneMatch) {
      contact.phone = phoneMatch[0];
      console.log('Phone found:', contact.phone);
      break;
    }
  }
  
  // LinkedIn detection - enhanced patterns
  const linkedinPatterns = [
    /linkedin\.com\/in\/[^\s)>\]}"']+/i,
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?/i
  ];
  
  for (const pattern of linkedinPatterns) {
    const linkedinMatch = fullText.match(pattern);
    if (linkedinMatch) {
      contact.linkedin = linkedinMatch[0].startsWith('http') ? 
        linkedinMatch[0] : `https://${linkedinMatch[0]}`;
      console.log('LinkedIn found:', contact.linkedin);
      break;
    }
  }
  
  // Enhanced location detection with comprehensive patterns
  contact.location = parseLocation(fullText, lines);
  
  return contact;
}

// Enhanced location parsing
function parseLocation(fullText: string, lines: string[]): string | undefined {
  console.log('Parsing location...');
  
  const locationPatterns = [
    // International format: City, State/Province, Country
    /([A-Za-záéíóúñü\s]+),\s*([A-Za-z.\s]+),\s*([A-Za-z\s]+)/g,
    // US/Mexico format: City, STATE_ABBREV
    /([\w\s]+),\s*(CDMX|Jal\.|NL|BC|QRO|GTO|SLP|CHIH|SON|TAM|VER|Mex\.|Pue\.|Yuc\.|CA|TX|NY|FL|IL|PA|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|IA|MS|AR|KS|UT|NV|NM|WV|NE|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY)/i,
    // City, Country format
    /([A-Za-z\s]+),\s*(Mexico|México|España|Spain|Argentina|Colombia|Chile|Peru|Perú|Brasil|Brazil|United States|USA|Canada|Canadá)/i,
    // Major cities standalone
    /(Mexico City|Ciudad de México|Guadalajara|Monterrey|Buenos Aires|São Paulo|Madrid|Barcelona|Toronto|Vancouver|London|Paris|Berlin|Sydney|Melbourne|Austin|Seattle|San Francisco|Los Angeles|New York|Chicago|Houston|Phoenix|Philadelphia|San Antonio|San Diego|Dallas|Boston|Atlanta|Miami)/i
  ];
  
  // Check each line for location patterns
  for (const line of lines.slice(0, 10)) { // Check first 10 lines
    for (const pattern of locationPatterns) {
      const matches = line.match(pattern);
      if (matches && matches[0].length >= 3) {
        console.log('Location found in line:', matches[0]);
        return matches[0].trim();
      }
    }
  }
  
  // Check full text for location patterns
  for (const pattern of locationPatterns) {
    const matches = fullText.match(pattern);
    if (matches && matches[0].length >= 3) {
      console.log('Location found in full text:', matches[0]);
      return matches[0].trim();
    }
  }
  
  console.log('No location found');
  return undefined;
}

// Enhanced experience section parsing
function parseExperienceSection(fullText: string, lines: string[]): string[] {
  console.log('Parsing experience section...');
  
  const experiences: string[] = [];
  
  // Look for experience section markers
  const experienceMarkers = [
    /^(EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT|PROFESSIONAL EXPERIENCE|CAREER HISTORY)/i,
    /^(EXPERIENCIA|EXPERIENCIA LABORAL|HISTORIAL LABORAL)/i
  ];
  
  let experienceStartIndex = -1;
  let experienceEndIndex = lines.length;
  
  // Find experience section boundaries
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for experience section start
    if (experienceStartIndex === -1) {
      for (const marker of experienceMarkers) {
        if (marker.test(line)) {
          experienceStartIndex = i + 1;
          console.log('Experience section found at line', i);
          break;
        }
      }
    }
    
    // Check for next section (end of experience)
    if (experienceStartIndex > -1 && i > experienceStartIndex) {
      if (/^(EDUCATION|SKILLS|CERTIFICATIONS|PROJECTS)/i.test(line)) {
        experienceEndIndex = i;
        break;
      }
    }
  }
  
  // Extract experience entries
  if (experienceStartIndex > -1) {
    const experienceLines = lines.slice(experienceStartIndex, experienceEndIndex);
    
    // Group lines into experience entries based on dates and job titles
    let currentEntry = '';
    
    for (const line of experienceLines) {
      // Check if this line starts a new experience entry (has date or looks like job title)
      if (/\d{4}/.test(line) || /^[A-Z][a-z\s]+(Manager|Engineer|Developer|Analyst|Coordinator|Assistant|Specialist|Director|Lead|Senior|Junior)/i.test(line)) {
        if (currentEntry.trim()) {
          experiences.push(currentEntry.trim());
        }
        currentEntry = line + '\n';
      } else {
        currentEntry += line + '\n';
      }
    }
    
    if (currentEntry.trim()) {
      experiences.push(currentEntry.trim());
    }
  } else {
    // Fallback: look for date patterns and job keywords throughout the text
    const dateJobPattern = /(\d{4}[\s-]+(?:\d{4}|present|current)).*?(manager|engineer|developer|analyst|coordinator|assistant|specialist|director|lead|senior|junior)/gi;
    const matches = fullText.match(dateJobPattern);
    if (matches) {
      experiences.push(...matches.slice(0, 5)); // Limit to 5 entries
    }
  }
  
  console.log('Experience entries found:', experiences.length);
  return experiences;
}

// Enhanced education section parsing
function parseEducationSection(fullText: string, lines: string[]): string[] {
  console.log('Parsing education section...');
  
  const education: string[] = [];
  
  // Look for education section
  const educationMarkers = [
    /^(EDUCATION|ACADEMIC|STUDIES)/i,
    /^(EDUCACIÓN|FORMACIÓN|ESTUDIOS)/i
  ];
  
  let educationStartIndex = -1;
  let educationEndIndex = lines.length;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (educationStartIndex === -1) {
      for (const marker of educationMarkers) {
        if (marker.test(line)) {
          educationStartIndex = i + 1;
          break;
        }
      }
    }
    
    if (educationStartIndex > -1 && i > educationStartIndex) {
      if (/^(EXPERIENCE|SKILLS|CERTIFICATIONS)/i.test(line)) {
        educationEndIndex = i;
        break;
      }
    }
  }
  
  if (educationStartIndex > -1) {
    const educationLines = lines.slice(educationStartIndex, educationEndIndex);
    let currentEntry = '';
    
    for (const line of educationLines) {
      if (/\d{4}/.test(line) || /(Bachelor|Master|PhD|Degree|University|College|Instituto)/i.test(line)) {
        if (currentEntry.trim()) {
          education.push(currentEntry.trim());
        }
        currentEntry = line + '\n';
      } else {
        currentEntry += line + '\n';
      }
    }
    
    if (currentEntry.trim()) {
      education.push(currentEntry.trim());
    }
  }
  
  console.log('Education entries found:', education.length);
  return education;
}

// Enhanced skills section parsing
function parseSkillsSection(fullText: string, lines: string[]): string[] {
  console.log('Parsing skills section...');
  
  const skills: string[] = [];
  
  // Look for skills section
  const skillsMarkers = [
    /^(SKILLS|TECHNICAL SKILLS|COMPETENCIES|TECHNOLOGIES)/i,
    /^(HABILIDADES|COMPETENCIAS|TECNOLOGÍAS)/i
  ];
  
  let skillsStartIndex = -1;
  let skillsEndIndex = lines.length;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (skillsStartIndex === -1) {
      for (const marker of skillsMarkers) {
        if (marker.test(line)) {
          skillsStartIndex = i + 1;
          break;
        }
      }
    }
    
    if (skillsStartIndex > -1 && i > skillsStartIndex) {
      if (/^(EXPERIENCE|EDUCATION|CERTIFICATIONS)/i.test(line)) {
        skillsEndIndex = i;
        break;
      }
    }
  }
  
  if (skillsStartIndex > -1) {
    const skillsText = lines.slice(skillsStartIndex, skillsEndIndex).join(' ');
    
    // Split by common delimiters
    const skillsList = skillsText
      .split(/[,\n•·\-\|]/)
      .map(skill => skill.trim())
      .filter(skill => skill.length > 2 && skill.length < 50);
    
    skills.push(...skillsList);
  }
  
  console.log('Skills found:', skills.length);
  return skills;
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

// Calculate confidence scores
function calculateConfidence(parsedResume: ParsedResume): ParsedResume['confidence'] {
  const { sections, rawText } = parsedResume;
  
  // Name confidence
  let nameConfidence: 'high' | 'medium' | 'low' = 'low';
  if (sections.contact?.name) {
    const words = sections.contact.name.split(/\s+/);
    if (words.length >= 2 && words.every(word => /^[A-Za-záéíóúñü]+$/.test(word))) {
      nameConfidence = 'high';
    } else if (words.length >= 2) {
      nameConfidence = 'medium';
    }
  }
  
  // Location confidence
  let locationConfidence: 'high' | 'medium' | 'low' = 'low';
  if (sections.contact?.location) {
    const location = sections.contact.location;
    if (location.includes(',') && location.length > 10) {
      locationConfidence = 'high';
    } else if (location.length > 5) {
      locationConfidence = 'medium';
    }
  }
  
  // Experience confidence
  let experienceConfidence: 'high' | 'medium' | 'low' = 'low';
  if (sections.experience && sections.experience.length > 0) {
    const hasDatePatterns = sections.experience.some(exp => /\d{4}/.test(exp));
    const hasJobTitles = sections.experience.some(exp => 
      /(manager|engineer|developer|analyst|coordinator|assistant|specialist|director)/i.test(exp)
    );
    
    if (hasDatePatterns && hasJobTitles) {
      experienceConfidence = 'high';
    } else if (hasDatePatterns || hasJobTitles) {
      experienceConfidence = 'medium';
    }
  }
  
  // Overall confidence
  const scores = [nameConfidence, locationConfidence, experienceConfidence];
  const highCount = scores.filter(s => s === 'high').length;
  const mediumCount = scores.filter(s => s === 'medium').length;
  
  let overallConfidence: 'high' | 'medium' | 'low' = 'low';
  if (highCount >= 2) {
    overallConfidence = 'high';
  } else if (highCount >= 1 || mediumCount >= 2) {
    overallConfidence = 'medium';
  }
  
  return {
    name: nameConfidence,
    location: locationConfidence,
    experience: experienceConfidence,
    overall: overallConfidence
  };
}

// Enhanced validation with LinkedIn support
function validateResumeQuality(parsedResume: ParsedResume, fileName: string): { isValid: boolean; error?: string; details?: any } {
  const { rawText, sections, confidence } = parsedResume;
  
  console.log(`Validating resume quality for ${fileName}`);
  console.log(`Text length: ${rawText.length}, Overall confidence: ${confidence.overall}`);
  
  // Check if this appears to be a LinkedIn resume
  const isLinkedInResume = /linkedin/i.test(rawText) || /linkedin/i.test(fileName);
  
  const details = {
    textLength: rawText.length,
    sectionsFound: Object.keys(sections).length,
    hasContact: !!sections.contact,
    hasName: !!sections.contact?.name,
    hasLocation: !!sections.contact?.location,
    hasExperience: !!(sections.experience?.length),
    confidence: confidence,
    textPreview: rawText.substring(0, 200),
    isLinkedInResume: isLinkedInResume,
    detectedKeywords: []
  };
  
  // Enhanced validation criteria
  if (rawText.length < 50) {
    return {
      isValid: false,
      error: "File appears to be empty or corrupted. Please try a different file.",
      details
    };
  }
  
  const words = rawText.split(/\s+/).filter(word => word.length > 1);
  if (words.length < 15) {
    return {
      isValid: false,
      error: "This file doesn't contain enough readable text. Please try a different file format.",
      details
    };
  }
  
  // Progressive validation with enhanced keyword detection
  const resumeValidation = validateResumeContent(rawText, isLinkedInResume);
  details.detectedKeywords = resumeValidation.detectedKeywords;
  
  if (!resumeValidation.isValid) {
    // For LinkedIn resumes, try more relaxed validation
    if (isLinkedInResume) {
      const relaxedValidation = validateResumeContentRelaxed(rawText);
      if (relaxedValidation.isValid) {
        console.log(`✅ LinkedIn resume passed relaxed validation`);
        return { isValid: true, details: { ...details, validationType: 'relaxed', detectedKeywords: relaxedValidation.detectedKeywords } };
      }
    }
    
    return {
      isValid: false,
      error: resumeValidation.error,
      details: { ...details, failureType: resumeValidation.failureType }
    };
  }
  
  console.log(`✅ Validation passed: ${words.length} words, confidence: ${confidence.overall}, keywords found: ${resumeValidation.detectedKeywords.length}`);
  return { isValid: true, details: { ...details, validationType: 'standard' } };
}

// Enhanced resume content validation with comprehensive keyword detection
function validateResumeContent(text: string, isLinkedInResume: boolean): { isValid: boolean; error?: string; failureType?: string; detectedKeywords: string[] } {
  const detectedKeywords: string[] = [];
  
  // Comprehensive resume indicators - English and Spanish
  const resumeKeywords = [
    // Professional sections - English
    'experience', 'education', 'skills', 'work', 'job', 'employment', 
    'university', 'college', 'degree', 'professional', 'career', 
    'background', 'summary', 'profile', 'objective', 'qualifications',
    'achievements', 'accomplishments', 'responsibilities', 'projects',
    'certifications', 'awards', 'volunteer', 'languages', 'interests',
    
    // Professional sections - Spanish
    'experiencia', 'educación', 'educacion', 'habilidades', 'trabajo', 
    'empleo', 'universidad', 'colegio', 'titulo', 'grado', 'profesional',
    'carrera', 'antecedentes', 'resumen', 'perfil', 'objetivo', 
    'cualificaciones', 'logros', 'responsabilidades', 'proyectos',
    'certificaciones', 'premios', 'voluntariado', 'idiomas', 'intereses',
    
    // LinkedIn-specific terms
    'linkedin', 'resume', 'curriculum', 'cv', 'vitae',
    
    // Job titles and roles
    'manager', 'engineer', 'developer', 'analyst', 'coordinator', 
    'specialist', 'director', 'lead', 'senior', 'junior', 'intern',
    'consultant', 'administrator', 'supervisor', 'executive',
    
    // Company and work terms
    'company', 'corporation', 'organization', 'team', 'department',
    'position', 'role', 'title', 'employer', 'workplace',
    
    // Time and duration indicators
    'years', 'months', 'present', 'current', 'desde', 'hasta', 'actual',
    
    // Education terms
    'bachelor', 'master', 'phd', 'doctorate', 'certificate', 'diploma',
    'school', 'institute', 'academy', 'licenciatura', 'maestría', 'doctorado'
  ];
  
  const lowerText = text.toLowerCase();
  
  // Check for keyword matches
  for (const keyword of resumeKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(text)) {
      detectedKeywords.push(keyword);
    }
  }
  
  // For LinkedIn resumes, be more lenient
  const minKeywords = isLinkedInResume ? 2 : 3;
  
  if (detectedKeywords.length >= minKeywords) {
    return { isValid: true, detectedKeywords };
  }
  
  // Check for date patterns that indicate work history
  const datePatterns = [
    /\b\d{4}\s*[-–]\s*\d{4}\b/g,           // 2020-2023
    /\b\d{4}\s*[-–]\s*present\b/gi,       // 2020-present
    /\b\d{4}\s*[-–]\s*current\b/gi,       // 2020-current
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/gi, // Jan 2020
    /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+\d{4}/gi // Spanish months
  ];
  
  let dateMatches = 0;
  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      dateMatches += matches.length;
    }
  }
  
  if (dateMatches >= 2) {
    detectedKeywords.push('date_patterns');
    return { isValid: true, detectedKeywords };
  }
  
  // Check for email patterns (contact info)
  if (/@/.test(text)) {
    detectedKeywords.push('email');
  }
  
  // Check for phone patterns
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text) || /\+\d{1,3}/.test(text)) {
    detectedKeywords.push('phone');
  }
  
  // If we have contact info and some keywords, it might be a resume
  if (detectedKeywords.length >= 1 && (detectedKeywords.includes('email') || detectedKeywords.includes('phone'))) {
    return { isValid: true, detectedKeywords };
  }
  
  return {
    isValid: false,
    error: `This file doesn't appear to be a resume. Found ${detectedKeywords.length} resume indicators (need at least ${minKeywords}).`,
    failureType: 'insufficient_keywords',
    detectedKeywords
  };
}

// Relaxed validation for LinkedIn resumes with parsing issues
function validateResumeContentRelaxed(text: string): { isValid: boolean; detectedKeywords: string[] } {
  const detectedKeywords: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Very basic indicators that this could be a resume
  const basicIndicators = [
    'email', 'phone', 'linkedin', 'experience', 'education', 'skills',
    'work', 'job', '@', '.com', 'university', 'college', 'company',
    'manager', 'engineer', 'developer', 'analyst', 'years', 'months'
  ];
  
  for (const indicator of basicIndicators) {
    if (lowerText.includes(indicator.toLowerCase())) {
      detectedKeywords.push(indicator);
    }
  }
  
  // Check for patterns that look like structured data
  const hasStructuredData = (
    /@/.test(text) || // email
    /\b\d{4}\b/.test(text) || // years
    /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text) || // proper names
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text) // phone numbers
  );
  
  if (hasStructuredData) {
    detectedKeywords.push('structured_data');
  }
  
  // If we have at least 2 indicators, consider it a resume
  return {
    isValid: detectedKeywords.length >= 2,
    detectedKeywords
  };
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

    // Extract text based on file type
    let extractedText: string;
    
    try {
      if (fileType === 'text/plain') {
        console.log(`[${requestId}] 📝 Processing plain text file...`);
        extractedText = await extractTextFallback(fileContent);
      } else if (fileType === 'application/pdf') {
        console.log(`[${requestId}] 📕 Processing PDF file...`);
        extractedText = await extractTextFromPDF(fileContent);
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        console.log(`[${requestId}] 📄 Processing DOCX file...`);
        extractedText = await extractTextFromDOCX(fileContent);
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

    // Parse sections from extracted text
    const sections = detectSectionsFromText(extractedText);
    const urls = extractURLsFromText(extractedText);
    
    // Create parsed resume object
    const parsedResume: ParsedResume = {
      rawText: extractedText,
      sections,
      urls,
      confidence: calculateConfidence({ rawText: extractedText, sections, urls, confidence: {} as any })
    };

    // Validate resume quality
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

    console.log(`[${requestId}] ✅ Validation passed - Processing with AI...`);
    console.log(`[${requestId}] 📊 Extracted data:`, {
      name: parsedResume.sections.contact?.name || 'Not found',
      location: parsedResume.sections.contact?.location || 'Not found',
      email: parsedResume.sections.contact?.email || 'Not found',
      linkedin: parsedResume.sections.contact?.linkedin || 'Not found',
      experienceEntries: parsedResume.sections.experience?.length || 0,
      confidence: parsedResume.confidence
    });
    
    // Enhanced OpenAI prompt
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
              content: `You are an expert resume parsing AI. Extract structured candidate data from the pre-parsed resume sections below.

CRITICAL: Return ONLY valid JSON. Do not include any explanatory text, markdown formatting, or code blocks.

LOCATION EXTRACTION RULES:
- Parse locations from various formats: "Mexico City, CDMX", "Austin, TX", "Guadalajara, Jal.", "Toronto, ON, Canada"
- Break down locations into components: city, state/province, country
- Common patterns: "City, State", "City, State, Country", "City, Country", standalone cities
- Mexican states: CDMX=Ciudad de México, Jal.=Jalisco, NL=Nuevo León, BC=Baja California, etc.
- US states: Use full names (Texas not TX, California not CA)
- Spanish/Mexican cities: Mexico City, Guadalajara, Monterrey, etc.
- Examples: "Guadalajara, Jal." → city="Guadalajara", state="Jalisco", country="Mexico"
- Examples: "Austin, TX" → city="Austin", state="Texas", country="United States"

PROFILE SUMMARY RULES (MANDATORY GENERATION):
- ALWAYS generate a profile_summary if ANY professional information is detected
- Generate summary if you find: job titles, company names, years of experience, or skills
- Be concise (2-3 sentences) but informative
- Focus on professional highlights and key competencies
- Include experience level (entry, mid, senior) when determinable
- If minimal experience, still generate a basic summary

URL EXTRACTION:
- LinkedIn: any variation of linkedin.com/in/username (with or without https://)
- Complete the URL with https:// if missing

CONFIDENCE INDICATORS:
- Use the confidence scores provided in metadata to inform your extraction
- High confidence data should be preferred over low confidence data

Return ONLY this JSON structure (no markdown, no explanation):
{
  "candidate_name": "full name from contact" | null,
  "linkedin_url": "complete LinkedIn URL" | null, 
  "location_country": "country name" | null,
  "location_state": "state/province name" | null,
  "location_city": "city name" | null,
  "salary_amount": numeric_value | null,
  "salary_currency": "currency_code" | null,
  "profile_summary": "professional summary based on experience" | null,
  "notes": "other relevant info or parsing notes" | null
}`
            },
            {
              role: 'user',
              content: `Extract candidate information from this parsed resume data:

CONFIDENCE SCORES: ${JSON.stringify(parsedResume.confidence)}

${parsedResume.sections.contact ? `CONTACT INFORMATION:
Name: ${parsedResume.sections.contact.name || 'Not extracted'}
Email: ${parsedResume.sections.contact.email || 'Not extracted'}
Phone: ${parsedResume.sections.contact.phone || 'Not extracted'}
Location: ${parsedResume.sections.contact.location || 'Not extracted'}
LinkedIn: ${parsedResume.sections.contact.linkedin || 'Not extracted'}

` : ''}${parsedResume.sections.experience && parsedResume.sections.experience.length > 0 ? `WORK EXPERIENCE (${parsedResume.sections.experience.length} entries):
${parsedResume.sections.experience.slice(0, 3).join('\n\n')}

` : ''}${parsedResume.sections.education && parsedResume.sections.education.length > 0 ? `EDUCATION (${parsedResume.sections.education.length} entries):
${parsedResume.sections.education.slice(0, 2).join('\n\n')}

` : ''}${parsedResume.sections.skills && parsedResume.sections.skills.length > 0 ? `SKILLS (${parsedResume.sections.skills.length} found):
${parsedResume.sections.skills.slice(0, 10).join(', ')}

` : ''}${parsedResume.urls.length > 0 ? `FOUND URLs:
${parsedResume.urls.join(', ')}

` : ''}FULL TEXT SAMPLE (first 1500 chars):
${parsedResume.rawText.substring(0, 1500)}${parsedResume.rawText.length > 1500 ? '...' : ''}

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

    console.log(`[${requestId}] ✅ Successfully parsed resume data:`, {
      name: cleanedData.candidate_name,
      location: `${cleanedData.location_city}, ${cleanedData.location_state}, ${cleanedData.location_country}`,
      hasLinkedIn: !!cleanedData.linkedin_url,
      hasSummary: !!cleanedData.profile_summary,
      confidence: parsedResume.confidence
    });

    return new Response(JSON.stringify({ 
      success: true, 
      data: cleanedData,
      fileName: fileName,
      debug: {
        textLength: parsedResume.rawText.length,
        urlsFound: parsedResume.urls.length,
        sectionsDetected: Object.keys(parsedResume.sections).length,
        contactFound: !!parsedResume.sections.contact,
        experienceEntries: parsedResume.sections.experience?.length || 0,
        confidence: parsedResume.confidence
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