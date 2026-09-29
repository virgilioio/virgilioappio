import { extractText } from "https://esm.sh/unpdf@0.12.1";

/** Reads the latest resume attachment's text from storage. Returns '' when unreadable. */
// deno-lint-ignore no-explicit-any
export async function loadResumeText(sb: any, candidateId: string): Promise<string> {
  const { data: att } = await sb.from('candidate_attachments')
    .select('file_url, file_name').eq('candidate_id', candidateId).eq('is_resume', true)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!att?.file_url) return '';
  const { data: file, error } = await sb.storage.from('candidate-attachments').download(att.file_url);
  if (error || !file) return '';
  const name = String(att.file_name || att.file_url).toLowerCase();
  let text = '';
  try {
    if (name.endsWith('.txt') || name.endsWith('.md')) text = await file.text();
    else if (name.endsWith('.docx')) {
      const raw = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(await file.arrayBuffer()));
      text = raw.replace(/<[^>]+>/g, ' ');
    } else if (!name.endsWith('.doc')) {
      const { text: t } = await extractText(new Uint8Array(await file.arrayBuffer()));
      text = Array.isArray(t) ? t.join('\n') : String(t || '');
    }
  } catch (e) {
    console.error('[resumeText] extraction failed:', e);
    return '';
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const readable = text.replace(/[^\p{L}\p{N}\s.,;:!?@\-()\/'"#$%&*+]/gu, '').length;
  return readable / text.length < 0.5 ? '' : text;
}
