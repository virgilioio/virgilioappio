import type { PDFDocumentProxy } from 'pdfjs-dist';
/* eslint-disable @typescript-eslint/no-explicit-any */
let pdfjsLib: any | null = null;
let mammothLib: any | null = null;

// Configure pdfjs worker from CDN (works well in Vite)
const ensurePdfJs = async () => {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('pdfjs-dist/build/pdf');
  // Pin to installed version for compatibility
  const workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  }
  return pdfjsLib;
};

const ensureMammoth = async () => {
  if (mammothLib) return mammothLib;
  // Use browser build of mammoth for Vite/browser
  mammothLib = await import('mammoth/mammoth.browser');
  return mammothLib;
};

export async function extractTextFromPdf(file: File): Promise<string> {
  if (!file) return '';
  const lib = await ensurePdfJs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = lib.getDocument({ data: arrayBuffer });
  const pdf: PDFDocumentProxy = await loadingTask.promise;

  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
      .join(' ');
    parts.push(pageText);
  }

  try {
    // @ts-ignore - optional cleanup
    pdf.cleanup && pdf.cleanup();
  } catch (_) {
    // no-op
  }

  return parts.join('\n').trim();
}

// Very lightweight RTF to text extraction (best-effort)
function rtfToText(rtf: string): string {
  try {
    // Remove RTF groups and control words
    let text = rtf
      .replace(/\{\\\*?[^{}]*\}|[{}]/g, '') // remove groups and braces
      .replace(/\\[a-zA-Z]+-?\d* ?/g, '') // remove control words
      .replace(/\\'([0-9a-fA-F]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16))) // hex escapes
      .replace(/\n|\r/g, ' ');
    return text.replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

// Generic file text extractor supporting PDF, DOCX, TXT, and basic RTF
export async function extractTextFromFile(file: File): Promise<string> {
  if (!file) return '';
  const mime = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return extractTextFromPdf(file);
  }

  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    try {
      const mammoth = await ensureMammoth();
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return (result?.value || '').trim();
    } catch (e) {
      console.warn('DOCX parse failed, returning empty text', e);
      return '';
    }
  }

  if (mime === 'text/plain' || name.endsWith('.txt')) {
    try {
      const t = await file.text();
      return t.trim();
    } catch {
      return '';
    }
  }

  if (mime === 'text/rtf' || mime === 'application/rtf' || name.endsWith('.rtf')) {
    try {
      const rtf = await file.text();
      return rtfToText(rtf);
    } catch {
      return '';
    }
  }

  // .doc (legacy) and other types are not supported in-browser
  return '';
}
