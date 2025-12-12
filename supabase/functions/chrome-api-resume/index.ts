import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handlePreflight, corsHeadersFor } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface ResumeUploadRequest {
  candidate_id: string;
  filename: string;
  file_data: string; // base64-encoded PDF
}

serve(async (req) => {
  const origin = req.headers.get('Origin') ?? req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);

  // Handle CORS preflight
  const preflightResponse = handlePreflight(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No Authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Parse request body
    const body: ResumeUploadRequest = await req.json();
    const { candidate_id, filename, file_data } = body;

    // Validate required fields
    if (!candidate_id || !filename || !file_data) {
      console.error('❌ Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: candidate_id, filename, file_data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📎 Chrome API /resume - User: ${userId}, Candidate: ${candidate_id}, File: ${filename}`);

    // Get user's tenant_id from members table
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('tenant_id')
      .eq('user_id', userId)
      .eq('user_status', 'active')
      .single();

    if (memberError || !member?.tenant_id) {
      console.error('❌ Member/tenant not found:', memberError);
      return new Response(
        JSON.stringify({ error: 'User not associated with any tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = member.tenant_id;

    // Verify candidate exists and belongs to user's tenant
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('id, tenant_id')
      .eq('id', candidate_id)
      .is('deleted_at', null)
      .single();

    if (candidateError || !candidate) {
      console.error('❌ Candidate not found:', candidateError);
      return new Response(
        JSON.stringify({ error: 'Candidate not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (candidate.tenant_id !== tenantId) {
      console.error('❌ Candidate belongs to different tenant');
      return new Response(
        JSON.stringify({ error: 'Access denied: candidate belongs to a different tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode base64 file data
    let fileBytes: Uint8Array;
    try {
      // Remove data URL prefix if present (e.g., "data:application/pdf;base64,")
      const base64Data = file_data.includes(',') ? file_data.split(',')[1] : file_data;
      const binaryString = atob(base64Data);
      fileBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileBytes[i] = binaryString.charCodeAt(i);
      }
    } catch (decodeError) {
      console.error('❌ Failed to decode base64 file data:', decodeError);
      return new Response(
        JSON.stringify({ error: 'Invalid base64 file data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileSizeBytes = fileBytes.length;
    console.log(`📊 File size: ${fileSizeBytes} bytes`);

    // Check file size (15MB limit)
    const maxSizeBytes = 15 * 1024 * 1024;
    if (fileSizeBytes > maxSizeBytes) {
      console.error(`❌ File too large: ${fileSizeBytes} bytes (max ${maxSizeBytes})`);
      return new Response(
        JSON.stringify({ error: 'File too large. Maximum size is 15MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate simple file path: {candidate_id}/{timestamp}-{random}.pdf
    const randomId = crypto.randomUUID().split('-')[0];
    const timestamp = Date.now();
    const storagePath = `${candidate_id}/${timestamp}-${randomId}.pdf`;

    console.log(`📁 Uploading to: ${storagePath}`);

    // Upload to candidate-attachments bucket
    const { error: uploadError } = await supabase.storage
      .from('candidate-attachments')
      .upload(storagePath, fileBytes, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Failed to upload file:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload file to storage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ File uploaded successfully');

    // Create record in candidate_attachments table
    const { data: attachment, error: attachmentError } = await supabase
      .from('candidate_attachments')
      .insert({
        candidate_id,
        file_name: sanitizedFilename,
        file_url: storagePath,
        file_size_bytes: fileSizeBytes,
        file_type: 'application/pdf',
        uploaded_by: userId,
        is_resume: true,
        conversion_status: 'completed' // PDFs don't need conversion
      })
      .select('id')
      .single();

    if (attachmentError || !attachment) {
      console.error('❌ Failed to create attachment record:', attachmentError);
      // Try to clean up the uploaded file
      await supabase.storage.from('candidate-attachments').remove([storagePath]);
      return new Response(
        JSON.stringify({ error: 'Failed to create attachment record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = {
      success: true,
      attachment_id: attachment.id,
      file_url: storagePath
    };

    console.log(`✅ Chrome API /resume - Success: ${JSON.stringify(response)}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in chrome-api-resume:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
