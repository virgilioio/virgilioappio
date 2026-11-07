import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderTemplate } from '@/utils/templateUtils';
import { templateSample } from '@/lib/templateSample';

/**
 * Preview for an email template (2026-11-07, from the stage automation composer):
 * the toolbar's Preview / Edit toggle and the email with sample values in place of
 * its variables. Variables the email doesn't fill read blank.
 */
export function PreviewToggle({ preview, onToggle }: { preview: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={preview}
      className={cn('h-7 px-2 rounded-md inline-flex items-center gap-1.5 font-inter hover:bg-[#F1F0EC]', preview && 'bg-[#EDE4FF]')}
      style={{ fontSize: 12, color: '#5A6072' }}
    >
      <Eye className="h-3.5 w-3.5" /> {preview ? 'Edit' : 'Preview'}
    </button>
  );
}

interface TemplatePreviewProps {
  subject: string;
  body: string;
  /** Only these keys are filled; the rest read blank, as when the email goes out. */
  keys?: string[];
  candidateName?: string;
  minHeight?: number;
}

export function TemplatePreview({ subject, body, keys, candidateName, minHeight = 200 }: TemplatePreviewProps) {
  const all = templateSample(candidateName);
  const sample = keys ? Object.fromEntries(keys.filter((k) => k in all).map((k) => [k, all[k]])) : all;
  // Older templates are plain text: keep their line breaks.
  const html = /<[a-z][\s\S]*>/i.test(body) ? body : body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
  return (
    <div className="rounded-lg p-4 font-inter" style={{ border: '1px solid #E8E6E0', background: '#FAFAF7', fontSize: 13, color: '#0d0d09', minHeight }}>
      <div className="font-poppins mb-3" style={{ fontSize: 13.5, fontWeight: 600 }}>
        {renderTemplate(subject, sample) || <span style={{ color: '#8B8F9E' }}>No subject</span>}
      </div>
      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderTemplate(html, sample) }} />
      <div className="mt-3 font-inter" style={{ fontSize: 11, color: '#8B8F9E' }}>Preview uses sample values. Real sends use each candidate's data.</div>
    </div>
  );
}
