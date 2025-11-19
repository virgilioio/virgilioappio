import { useEffect, useState, useRef } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker using Vite's module resolution
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface PDFResumeViewerProps {
  url: string;
  height: number;
}

export const PDFResumeViewer = ({ url, height }: PDFResumeViewerProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const loadAndRenderPDF = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('📄 Fetching PDF from URL:', url);
        
        // Fetch the PDF as a blob
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        if (cancelled) return;

        console.log('📄 Loading PDF with PDF.js');
        
        // Load the PDF document
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        if (cancelled) return;

        console.log(`📄 PDF loaded successfully, ${pdf.numPages} pages`);
        setNumPages(pdf.numPages);

        // Render all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) break;

          const page = await pdf.getPage(pageNum);
          const canvas = canvasRefs.current.get(pageNum);
          
          if (!canvas || cancelled) continue;

          const context = canvas.getContext('2d');
          if (!context) continue;

          // Calculate scale to fit container width
          const containerWidth = containerRef.current?.clientWidth || 800;
          const viewport = page.getViewport({ scale: 1 });
          const scale = (containerWidth - 32) / viewport.width; // 32px for padding
          const scaledViewport = page.getViewport({ scale });

          canvas.height = scaledViewport.height;
          canvas.width = scaledViewport.width;

          // Render the page
          await page.render({
            canvasContext: context,
            viewport: scaledViewport,
          }).promise;

          console.log(`📄 Rendered page ${pageNum}/${pdf.numPages}`);
        }

        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('❌ Error loading PDF:', err);
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
          setLoading(false);
        }
      }
    };

    loadAndRenderPDF();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div 
        className="flex items-center justify-center bg-muted/30 rounded-lg border border-border"
        style={{ height: `${height}vh` }}
      >
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="flex items-center justify-center bg-muted/30 rounded-lg border border-border"
        style={{ height: `${height}vh` }}
      >
        <div className="text-center space-y-3 p-6 max-w-md">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm font-medium text-foreground">Unable to display PDF inline</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-4">
            Please use the "Open in new tab" or "Download" buttons above to view the resume.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="bg-muted/30 rounded-lg border border-border overflow-y-auto"
      style={{ height: `${height}vh` }}
    >
      <div className="p-4 space-y-4">
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <div key={pageNum} className="bg-background rounded shadow-sm">
            <canvas
              ref={(el) => {
                if (el) {
                  canvasRefs.current.set(pageNum, el);
                } else {
                  canvasRefs.current.delete(pageNum);
                }
              }}
              className="w-full h-auto"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
