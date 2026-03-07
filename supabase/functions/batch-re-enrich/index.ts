import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Batch Re-Enrich: One-time utility to re-enrich existing candidates
 * that have resumes but are missing the new structured fields.
 *
 * Usage:
 *   POST /batch-re-enrich { "dry_run": true }           — preview candidates
 *   POST /batch-re-enrich { "limit": 50 }               — process up to 50
 *   POST /batch-re-enrich { "candidate_ids": ["uuid"] } — process specific ones
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple PDF text extraction using pdf-parse (works in Deno via npm specifier)
async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  try {
    // Use pdf-parse via esm.sh
    const pdfParse = (await import("https://esm.sh/pdf-parse@1.1.1")).default;
    const result = await pdfParse(Buffer.from(pdfBytes));
    return result.text || '';
  } catch (err) {
    console.error('[batch-re-enrich] PDF parse error, trying fallback:', err);
    // Fallback: decode as UTF-8 and extract readable text
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const raw = decoder.decode(pdfBytes);
    // Extract text between stream markers (very basic)
    const textChunks: string[] = [];
    const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
    let match;
    while ((match = streamRegex.exec(raw)) !== null) {
      const chunk = match[1].replace(/[^\x20-\x7E\n\r]/g, ' ').trim();
      if (chunk.length > 20) textChunks.push(chunk);
    }
    return textChunks.join('\n').slice(0, 15000);
  }
}

// Extract text from DOCX (basic: extract from word/document.xml)
function extractTextFromDocx(bytes: Uint8Array): string {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const raw = decoder.decode(bytes);
  // Strip XML tags to get plain text
  const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, 15000);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Auth skipped — one-time utility, verify_jwt=false in config.toml

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const dryRun = body.dry_run === true;
    const limit = body.limit || 10;
    const candidateIds: string[] | undefined = body.candidate_ids;

    console.log(`[batch-re-enrich] dry_run=${dryRun}, limit=${limit}, specific_ids=${candidateIds?.length || 'all'}`);

    // --- DRY RUN: lightweight count-only queries ---
    if (dryRun) {
      // Count candidates with resume attachments but missing structured fields
      let countQ1 = supabase
        .from('candidates')
        .select('id, candidate_attachments!inner(id)', { count: 'exact', head: true })
        .eq('candidate_attachments.is_resume', true)
        .in('enrichment_status', ['pending', 'pending_reparse'])
        .is('deleted_at', null);

      if (candidateIds?.length) countQ1 = countQ1.in('id', candidateIds);
      const { count: c1, error: e1 } = await countQ1;
      if (e1) console.error('[batch-re-enrich] Count query 1 error:', e1);

      // Count candidates with resume_url but missing structured fields
      let countQ2 = supabase
        .from('candidates')
        .select('id', { count: 'exact', head: true })
        .not('resume_url', 'is', null)
        .or('enrichment_status.in.(pending,pending_reparse),and(enrichment_status.is.null,profile_summary.is.null)')
        .is('deleted_at', null);

      if (candidateIds?.length) countQ2 = countQ2.in('id', candidateIds);
      const { count: c2, error: e2 } = await countQ2;
      if (e2) console.error('[batch-re-enrich] Count query 2 error:', e2);

      // Approximate total (may have overlap, but good enough for progress display)
      const totalCount = Math.max(c1 || 0, c2 || 0);

      return new Response(JSON.stringify({
        dry_run: true,
        count: totalCount,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- PROCESSING: fetch actual candidates ---
    // Query 1: Candidates with resume attachments but missing structured fields
    let attachmentQuery = supabase
      .from('candidates')
      .select(`
        id, candidate_name, current_job_title, enrichment_status, resume_url,
        candidate_attachments!inner (id, file_url, file_name, file_type, is_resume)
      `)
      .eq('candidate_attachments.is_resume', true)
      .in('enrichment_status', ['pending', 'pending_reparse'])
      .is('deleted_at', null)
      .limit(limit);

    if (candidateIds?.length) {
      attachmentQuery = attachmentQuery.in('id', candidateIds);
    }

    const { data: attachmentCandidates, error: q1Error } = await attachmentQuery;
    if (q1Error) {
      console.error('[batch-re-enrich] Attachment query error:', q1Error);
    }

    // Query 2: Candidates with resume_url but no attachment (CSV imports)
    let urlQuery = supabase
      .from('candidates')
      .select('id, candidate_name, current_job_title, enrichment_status, resume_url')
      .not('resume_url', 'is', null)
      .is('current_job_title', null)
      .is('deleted_at', null)
      .limit(limit);

    if (candidateIds?.length) {
      urlQuery = urlQuery.in('id', candidateIds);
    }

    const { data: urlCandidates, error: q2Error } = await urlQuery;
    if (q2Error) {
      console.error('[batch-re-enrich] URL query error:', q2Error);
    }

    // Merge and deduplicate
    const seen = new Set<string>();
    const candidates: any[] = [];
    for (const c of [...(attachmentCandidates || []), ...(urlCandidates || [])]) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        candidates.push(c);
      }
    }
    if (candidates.length > limit) candidates.length = limit;

    console.log(`[batch-re-enrich] Found ${candidates?.length || 0} candidates to process`);

    // Process each candidate
    const results: Array<{ id: string; name: string; status: string; error?: string }> = [];

    for (const candidate of candidates) {
      const attachments = (candidate as any).candidate_attachments as any[] | undefined;
      const resume = attachments?.[0];
      const externalResumeUrl = candidate.resume_url as string | null;

      // Determine the file URL: prefer attachment, fall back to resume_url field
      const fileUrl = resume?.file_url || externalResumeUrl;

      if (!fileUrl) {
        results.push({ id: candidate.id, name: candidate.candidate_name, status: 'skipped', error: 'No resume URL' });
        continue;
      }

      try {
        console.log(`[batch-re-enrich] Processing ${candidate.candidate_name} (${candidate.id})`);

        // Download the resume file
        let resumeText = '';
        const fileName = resume?.file_name || fileUrl;

        if (fileUrl.startsWith('http')) {
          // External URL - fetch directly
          const pdfResp = await fetch(fileUrl);
          if (!pdfResp.ok) {
            results.push({ id: candidate.id, name: candidate.candidate_name, status: 'failed', error: 'Failed to download resume' });
            continue;
          }
          const bytes = new Uint8Array(await pdfResp.arrayBuffer());

          // Determine file extension from URL or content-type
          const contentType = pdfResp.headers.get('content-type') || '';
          let ext = 'pdf';
          if (contentType.includes('docx') || fileUrl.toLowerCase().includes('.docx')) ext = 'docx';
          else if (contentType.includes('doc') || fileUrl.toLowerCase().includes('.doc')) ext = 'doc';

          // Permanently store the resume in Supabase Storage
          const storagePath = `${candidate.id}/${Date.now()}-resume.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('candidate-attachments')
            .upload(storagePath, bytes, { contentType: contentType || 'application/pdf' });

          if (uploadError) {
            console.error(`[batch-re-enrich] Storage upload error for ${candidate.id}:`, uploadError);
            // Continue with enrichment even if storage fails
          } else {
            // Create candidate_attachments record
            const originalFileName = fileUrl.split('/').pop()?.split('?')[0] || `resume.${ext}`;
            const { error: insertError } = await supabase
              .from('candidate_attachments')
              .insert({
                candidate_id: candidate.id,
                file_name: originalFileName,
                file_url: storagePath,
                file_size_bytes: bytes.length,
                file_type: contentType || 'application/pdf',
                is_resume: true,
              });

            if (insertError) {
              console.error(`[batch-re-enrich] Attachment record error for ${candidate.id}:`, insertError);
            } else {
              console.log(`[batch-re-enrich] Permanently stored resume for ${candidate.candidate_name} at ${storagePath}`);
            }
          }

          // Extract text for enrichment
          if (ext === 'docx') {
            resumeText = extractTextFromDocx(bytes);
          } else {
            resumeText = await extractTextFromPdf(bytes);
          }
        } else {
          // Storage path - download from Supabase Storage
          const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('candidate-attachments')
            .download(fileUrl);

          if (downloadError || !fileData) {
            console.error(`[batch-re-enrich] Download error for ${candidate.id}:`, downloadError);
            results.push({ id: candidate.id, name: candidate.candidate_name, status: 'failed', error: 'Storage download failed' });
            continue;
          }

          const bytes = new Uint8Array(await fileData.arrayBuffer());
          const fileNameLower = (resume?.file_name || fileUrl || '').toLowerCase();

          if (fileNameLower.endsWith('.pdf') || resume?.file_type === 'application/pdf') {
            resumeText = await extractTextFromPdf(bytes);
          } else if (fileName.endsWith('.docx')) {
            resumeText = extractTextFromDocx(bytes);
          } else {
            // Try as text
            resumeText = new TextDecoder().decode(bytes);
          }
        }

        if (!resumeText || resumeText.trim().length < 50) {
          results.push({ id: candidate.id, name: candidate.candidate_name, status: 'skipped', error: 'Resume text too short or empty' });
          continue;
        }

        console.log(`[batch-re-enrich] Extracted ${resumeText.length} chars for ${candidate.candidate_name}`);

        // Invoke the enrich-candidate-profile function
        const enrichResp = await fetch(`${SUPABASE_URL}/functions/v1/enrich-candidate-profile`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            candidateId: candidate.id,
            resumeText: resumeText.slice(0, 15000),
            candidateName: candidate.candidate_name,
          }),
        });

        if (enrichResp.ok) {
          results.push({ id: candidate.id, name: candidate.candidate_name, status: 'queued' });
        } else {
          const errText = await enrichResp.text();
          results.push({ id: candidate.id, name: candidate.candidate_name, status: 'failed', error: errText });
        }

        // Small delay between requests (enrich returns 202 instantly)
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        console.error(`[batch-re-enrich] Error for ${candidate.id}:`, err);
        results.push({ id: candidate.id, name: candidate.candidate_name, status: 'failed', error: String(err) });
      }
    }

    const summary = {
      total: results.length,
      queued: results.filter(r => r.status === 'queued').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    };

    console.log(`[batch-re-enrich] Complete: ${summary.queued} queued, ${summary.skipped} skipped, ${summary.failed} failed`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[batch-re-enrich] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
