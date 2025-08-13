
import type { PDFDocumentProxy } from 'pdfjs-dist';
/* eslint-disable @typescript-eslint/no-explicit-any */
let pdfjsLib: any | null = null;

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
