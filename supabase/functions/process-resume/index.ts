import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Load PDF.js from CDN
const loadPDFjs = async () => {
  const pdfScript = await fetch('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
  const pdfCode = await pdfScript.text();
  
  // Create a global PDF object
  const pdfModule = eval(`
    (function() {
      ${pdfCode}
      return pdfjsLib;
    })()
  `);
  
  // Set worker
  pdfModule.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  return pdfModule;
};

// Load Tesseract.js for OCR
const loadTesseract = async () => {
  const tesseractScript = await fetch('https://cdn.jsdelivr.net/npm/tesseract.js@4.1.1/dist/tesseract.min.js');
  const tesseractCode = await tesseractScript.text();
  
  return eval(`
    (function() {
      ${tesseractCode}
      return Tesseract;
    })()
  `);
};

// Primary PDF.js text extraction
async function extractTextWithPDFjs(uint8Array: Uint8Array): Promise<{ text: string; quality: 'good' | 'poor' | 'failed' }> {
  try {
    console.log("📖 Starting PDF.js text extraction...");
    const pdfLib = await loadPDFjs();
    
    const pdf = await pdfLib.getDocument({ data: uint8Array }).promise;
    const numPages = pdf.numPages;
    console.log(`📄 PDF has ${numPages} pages`);
    
    const textContent = [];
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ')
        .trim();
      
      if (pageText) {
        textContent.push(pageText);
      }
    }
    
    const fullText = textContent.join('\n\n').trim();
    console.log(`📝 PDF.js extracted ${fullText.length} characters`);
    
    // Quality assessment
    const wordCount = fullText.split(/\s+/).filter(word => word.length > 2).length;
    const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(fullText);
    const hasPhone = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(fullText);
    
    if (fullText.length > 100 && wordCount > 20 && (hasEmail || hasPhone || wordCount > 50)) {
      return { text: fullText, quality: 'good' };
    } else if (fullText.length > 50) {
      return { text: fullText, quality: 'poor' };
    } else {
      return { text: '', quality: 'failed' };
    }
    
  } catch (error) {
    console.error("❌ PDF.js extraction failed:", error);
    return { text: '', quality: 'failed' };
  }
}

// OCR fallback using Tesseract.js
async function extractTextWithOCR(uint8Array: Uint8Array, fileName: string): Promise<string> {
  try {
    console.log("🔍 Starting OCR text extraction...");
    const pdfLib = await loadPDFjs();
    const tesseract = await loadTesseract();
    
    const pdf = await pdfLib.getDocument({ data: uint8Array }).promise;
    const page = await pdf.getPage(1); // Start with first page
    
    const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Convert canvas to image blob
    const imageBlob = await canvas.convertToBlob({ type: 'image/png' });
    const imageBuffer = await imageBlob.arrayBuffer();
    
    console.log("🖼️ Converted PDF to image, starting OCR...");
    
    // Perform OCR
    const { data: { text } } = await tesseract.recognize(
      new Uint8Array(imageBuffer),
      'eng',
      {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );
    
    console.log(`🔤 OCR extracted ${text.length} characters`);
    
    // Clean up OCR text
    const cleanedText = text
      .replace(/[^\w\s@.-]/g, ' ') // Remove special characters except email/phone chars
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleanedText.length > 50 ? cleanedText : 
      `OCR Resume: ${fileName}\n\nOCR text extraction completed but yielded limited readable content. This may be a low-quality scan or complex layout.`;
    
  } catch (error) {
    console.error("❌ OCR extraction failed:", error);
    return `OCR Resume: ${fileName}\n\nOCR processing failed. This may be due to image quality or format issues.`;
  }
}

// Final fallback - manual parsing
async function extractTextFallback(uint8Array: Uint8Array, fileName: string): Promise<string> {
  console.log("🔧 Using fallback manual parsing...");
  const pdfString = new TextDecoder('latin1').decode(uint8Array);
  
  // Extract readable text patterns
  const textMatches = [
    ...pdfString.match(/\(([^)]+)\)/g) || [],
    ...pdfString.match(/\[([^\]]+)\]/g) || []
  ];
  
  const extractedTexts = textMatches
    .map(match => match.replace(/[()[\]]/g, '').trim())
    .filter(text => text.length > 2 && /[a-zA-Z]/.test(text));
  
  const result = extractedTexts.join(' ').replace(/\s+/g, ' ').trim();
  
  return result.length > 50 ? result : 
    `Fallback Resume: ${fileName}\n\nManual text extraction completed with limited success. Consider re-uploading as a text-based PDF or using OCR software.`;
}

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

    // Step 2: Hybrid PDF text extraction (PDF.js + OCR fallback)
    console.log("📝 Starting hybrid PDF text extraction...");
    
    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);
    
    let resumeText = "";
    let extractionMethod = "unknown";
    
    // Phase 1: Try PDF.js first (handles 90% of PDFs)
    const pdfResult = await extractTextWithPDFjs(uint8Array);
    
    if (pdfResult.quality === 'good') {
      resumeText = pdfResult.text;
      extractionMethod = "PDF.js";
      console.log("✅ PDF.js extraction successful with good quality");
    } else if (pdfResult.quality === 'poor') {
      console.log("⚠️ PDF.js extraction yielded poor quality, trying OCR...");
      
      // Phase 2: Try OCR for better results
      try {
        const ocrText = await extractTextWithOCR(uint8Array, file.name);
        if (ocrText.length > pdfResult.text.length * 1.5) {
          resumeText = ocrText;
          extractionMethod = "OCR";
          console.log("✅ OCR extraction provided better results");
        } else {
          resumeText = pdfResult.text;
          extractionMethod = "PDF.js (poor quality)";
          console.log("📝 Using PDF.js results despite poor quality");
        }
      } catch (ocrError) {
        console.error("❌ OCR failed, using PDF.js results:", ocrError);
        resumeText = pdfResult.text;
        extractionMethod = "PDF.js (OCR failed)";
      }
    } else {
      console.log("❌ PDF.js failed completely, trying OCR...");
      
      // Phase 2: OCR as primary method
      try {
        resumeText = await extractTextWithOCR(uint8Array, file.name);
        extractionMethod = "OCR";
        console.log("✅ OCR extraction completed");
      } catch (ocrError) {
        console.error("❌ OCR also failed, using manual fallback:", ocrError);
        
        // Phase 3: Manual parsing fallback
        resumeText = await extractTextFallback(uint8Array, file.name);
        extractionMethod = "Manual fallback";
        console.log("🔧 Manual fallback extraction completed");
      }
    }

    // Final validation and user guidance
    if (resumeText.length < 50) {
      console.log("⚠️ All extraction methods yielded minimal text");
      resumeText = `PDF Resume: ${file.name}

This PDF was processed using multiple extraction methods (${extractionMethod}) but yielded limited results.
File details: ${file.name} (${(file.size/1024).toFixed(1)} KB)

Possible reasons:
• Image-based PDF requiring advanced OCR
• Complex formatting or unusual fonts  
• Password protected or secured PDF
• Corrupted or non-standard PDF structure

Recommendations:
• Try exporting as a new, simpler PDF format
• Ensure the PDF contains selectable text
• Consider manual data entry for this resume`;
    } else {
      console.log(`✅ Extraction completed via ${extractionMethod}: ${resumeText.length} characters`);
    }


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