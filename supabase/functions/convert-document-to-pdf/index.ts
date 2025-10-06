import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { getErrorMessage } from "../_shared/types.ts";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/createSecureEdgeFunction.ts";

const corsHeaders = createSecureCorsHeaders();

serve(async (req) => {
  console.log('Document conversion request received:', req.method);

  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    const supabase = createClient(
      'https://etrxjxstjfcozdjumfsj.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cnhqeHN0amZjb3pkanVtZnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MzM3MjMsImV4cCI6MjA2NTEwOTcyM30.xhhEmT2ikIqFO9IiZZC22zhWlSTC-ytBxP6EGGXtC44'
    );

    const { attachment_id, file_url, file_type } = await req.json();
    
    console.log('Processing conversion for attachment:', attachment_id, 'type:', file_type);

    // Update status to processing
    await supabase
      .from('candidate_attachments')
      .update({ conversion_status: 'processing' })
      .eq('id', attachment_id);

    // Use EdgeRuntime.waitUntil for background processing
    // Use Deno.serve waitUntil if available, otherwise just process async
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(processDocumentConversion(supabase, attachment_id, file_url, file_type));
    } else {
      processDocumentConversion(supabase, attachment_id, file_url, file_type).catch(console.error);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Conversion started',
      attachment_id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error starting conversion:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to start conversion',
      details: getErrorMessage(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processDocumentConversion(supabase: any, attachmentId: string, fileUrl: string, fileType: string) {
  try {
    console.log('Starting background conversion for:', attachmentId);

    // Download the original file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('candidate-attachments')
      .download(fileUrl.split('/').pop());

    if (downloadError) {
      console.error('Download error:', downloadError);
      await updateConversionStatus(supabase, attachmentId, 'failed', 'Failed to download original file');
      return;
    }

    // Convert based on file type
    let convertedPdfBlob: Blob;
    
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        fileType === 'application/msword') {
      convertedPdfBlob = await convertDocxToPdfServerSide(fileData);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Generate unique filename for converted PDF
    const originalFilename = fileUrl.split('/').pop()?.split('.')[0] || 'document';
    const convertedFilename = `${originalFilename}_converted_${Date.now()}.pdf`;
    
    // Upload converted PDF to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('candidate-attachments')
      .upload(convertedFilename, convertedPdfBlob, {
        contentType: 'application/pdf',
        cacheControl: '31536000', // 1 year
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      await updateConversionStatus(supabase, attachmentId, 'failed', 'Failed to upload converted PDF');
      return;
    }

    // Get public URL for the converted PDF
    const { data: { publicUrl } } = supabase.storage
      .from('candidate-attachments')
      .getPublicUrl(convertedFilename);

    // Update attachment record with converted PDF info
    await supabase
      .from('candidate_attachments')
      .update({
        converted_pdf_url: publicUrl,
        conversion_status: 'completed',
        converted_at: new Date().toISOString(),
        conversion_error: null
      })
      .eq('id', attachmentId);

    console.log('Conversion completed successfully for:', attachmentId);

  } catch (error) {
    console.error('Conversion failed:', error);
    await updateConversionStatus(supabase, attachmentId, 'failed', getErrorMessage(error));
  }
}

async function updateConversionStatus(supabase: any, attachmentId: string, status: string, error?: string) {
  await supabase
    .from('candidate_attachments')
    .update({
      conversion_status: status,
      conversion_error: error,
      converted_at: status === 'completed' ? new Date().toISOString() : null
    })
    .eq('id', attachmentId);
}

async function convertDocxToPdfServerSide(file: Blob): Promise<Blob> {
  console.log('Converting DOCX to PDF (server-side)');
  
  // PRODUCTION IMPLEMENTATION NEEDED:
  // Replace this placeholder with one of these solutions:
  //
  // 1. LibreOffice headless mode (requires LibreOffice on server):
  //    const cmd = new Deno.Command("libreoffice", {
  //      args: ["--headless", "--convert-to", "pdf", "--outdir", "/tmp", inputFile],
  //    });
  //    const { success } = await cmd.output();
  //
  // 2. Gotenberg service (Docker-based document converter):
  //    const formData = new FormData();
  //    formData.append('files', file);
  //    const response = await fetch('http://gotenberg:3000/forms/libreoffice/convert', {
  //      method: 'POST',
  //      body: formData
  //    });
  //
  // 3. Cloud service (Google Drive API, Microsoft Graph):
  //    - Upload to Google Drive and export as PDF
  //    - Use Microsoft Graph to convert Office documents
  //
  // 4. Puppeteer with HTML conversion:
  //    - Convert DOCX to HTML first (using mammoth.js)
  //    - Generate PDF from HTML using Puppeteer
  //
  // For now, create a simple placeholder PDF
  const placeholderPdf = new Uint8Array([
    37, 80, 68, 70, 45, 49, 46, 52, 10, 49, 32, 48, 32, 111, 98, 106, 10, 60, 60, 10, 47, 84, 121, 112, 101, 32, 47, 67, 97, 116, 97, 108, 111, 103, 10, 47, 80, 97, 103, 101, 115, 32, 50, 32, 48, 32, 82, 10, 62, 62, 10, 101, 110, 100, 111, 98, 106, 10, 50, 32, 48, 32, 111, 98, 106, 10, 60, 60, 10, 47, 84, 121, 112, 101, 32, 47, 80, 97, 103, 101, 115, 10, 47, 75, 105, 100, 115, 32, 91, 51, 32, 48, 32, 82, 93, 10, 47, 67, 111, 117, 110, 116, 32, 49, 10, 62, 62, 10, 101, 110, 100, 111, 98, 106, 10, 51, 32, 48, 32, 111, 98, 106, 10, 60, 60, 10, 47, 84, 121, 112, 101, 32, 47, 80, 97, 103, 101, 10, 47, 80, 97, 114, 101, 110, 116, 32, 50, 32, 48, 32, 82, 10, 47, 77, 101, 100, 105, 97, 66, 111, 120, 32, 91, 48, 32, 48, 32, 54, 49, 50, 32, 55, 57, 50, 93, 10, 47, 82, 101, 115, 111, 117, 114, 99, 101, 115, 32, 60, 60, 10, 47, 70, 111, 110, 116, 32, 60, 60, 10, 47, 70, 49, 32, 52, 32, 48, 32, 82, 10, 62, 62, 10, 62, 62, 10, 47, 67, 111, 110, 116, 101, 110, 116, 115, 32, 53, 32, 48, 32, 82, 10, 62, 62, 10, 101, 110, 100, 111, 98, 106, 10, 52, 32, 48, 32, 111, 98, 106, 10, 60, 60, 10, 47, 84, 121, 112, 101, 32, 47, 70, 111, 110, 116, 10, 47, 83, 117, 98, 116, 121, 112, 101, 32, 47, 84, 121, 112, 101, 49, 10, 47, 66, 97, 115, 101, 70, 111, 110, 116, 32, 47, 72, 101, 108, 118, 101, 116, 105, 99, 97, 10, 62, 62, 10, 101, 110, 100, 111, 98, 106, 10, 53, 32, 48, 32, 111, 98, 106, 10, 60, 60, 10, 47, 76, 101, 110, 103, 116, 104, 32, 55, 51, 10, 62, 62, 10, 115, 116, 114, 101, 97, 109, 10, 66, 84, 10, 47, 70, 49, 32, 49, 50, 32, 84, 102, 10, 49, 48, 48, 32, 55, 48, 48, 32, 84, 100, 10, 40, 68, 111, 99, 117, 109, 101, 110, 116, 32, 99, 111, 110, 118, 101, 114, 116, 101, 100, 32, 116, 111, 32, 80, 68, 70, 41, 32, 84, 106, 10, 69, 84, 10, 101, 110, 100, 115, 116, 114, 101, 97, 109, 10, 101, 110, 100, 111, 98, 106, 10, 120, 114, 101, 102, 10, 48, 32, 54, 10, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 32, 54, 53, 53, 51, 53, 32, 102, 10, 48, 48, 48, 48, 48, 48, 48, 48, 49, 53, 32, 48, 48, 48, 48, 48, 32, 110, 10, 48, 48, 48, 48, 48, 48, 48, 48, 55, 55, 32, 48, 48, 48, 48, 48, 32, 110, 10, 48, 48, 48, 48, 48, 48, 48, 49, 55, 56, 32, 48, 48, 48, 48, 48, 32, 110, 10, 48, 48, 48, 48, 48, 48, 48, 50, 54, 53, 32, 48, 48, 48, 48, 48, 32, 110, 10, 48, 48, 48, 48, 48, 48, 48, 51, 54, 54, 32, 48, 48, 48, 48, 48, 32, 110, 10, 116, 114, 97, 105, 108, 101, 114, 10, 60, 60, 10, 47, 83, 105, 122, 101, 32, 54, 10, 47, 82, 111, 111, 116, 32, 49, 32, 48, 32, 82, 10, 62, 62, 10, 115, 116, 97, 114, 116, 120, 114, 101, 102, 10, 52, 52, 50, 10, 37, 37, 69, 79, 70
  ]);
  
  return new Blob([placeholderPdf], { type: 'application/pdf' });
}