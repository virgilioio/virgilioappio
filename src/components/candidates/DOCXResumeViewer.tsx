import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText } from 'lucide-react'

interface DOCXResumeViewerProps {
  url: string
  height?: number
}

export function DOCXResumeViewer({ url, height = 70 }: DOCXResumeViewerProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const convert = async () => {
      setIsLoading(true)
      setError(null)
      setHtml(null)

      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error('Failed to fetch document')

        const arrayBuffer = await response.arrayBuffer()
        const mammoth = await import('mammoth')
        const result = await mammoth.convertToHtml({ arrayBuffer })

        if (!cancelled) {
          setHtml(result.value)
          setIsLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('DOCX conversion error:', err)
          setError('Failed to render document preview')
          setIsLoading(false)
        }
      }
    }

    convert()
    return () => { cancelled = true }
  }, [url])

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" style={{ height: `${height}vh` }}>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    )
  }

  if (error || !html) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height: `${height}vh` }}>
        <div className="text-center space-y-2">
          <FileText className="h-8 w-8 mx-auto opacity-50" />
          <p className="text-sm">{error || 'Unable to preview this document'}</p>
          <p className="text-xs text-muted-foreground/70">You can still download the original file below</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="overflow-y-auto bg-white p-6 docx-preview"
      style={{ height: `${height}vh` }}
    >
      <style>{`
        .docx-preview {
          font-family: 'Georgia', 'Times New Roman', serif;
          font-size: 14px;
          line-height: 1.6;
          color: #1a1a1a;
        }
        .docx-preview h1 { font-size: 1.8em; font-weight: bold; margin: 0.8em 0 0.4em; }
        .docx-preview h2 { font-size: 1.4em; font-weight: bold; margin: 0.7em 0 0.3em; }
        .docx-preview h3 { font-size: 1.2em; font-weight: bold; margin: 0.6em 0 0.3em; }
        .docx-preview p { margin: 0.4em 0; }
        .docx-preview ul, .docx-preview ol { margin: 0.4em 0; padding-left: 1.5em; }
        .docx-preview li { margin: 0.2em 0; }
        .docx-preview table { border-collapse: collapse; width: 100%; margin: 0.6em 0; }
        .docx-preview td, .docx-preview th { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
        .docx-preview th { background: #f5f5f5; font-weight: 600; }
        .docx-preview strong, .docx-preview b { font-weight: 700; }
        .docx-preview em, .docx-preview i { font-style: italic; }
        .docx-preview a { color: #2563eb; text-decoration: underline; }
        .docx-preview img { max-width: 100%; height: auto; }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
