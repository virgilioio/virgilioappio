import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

/**
 * Gio's written answers (2026-11-05): Gio answers in light Markdown (headings, bullets,
 * bold, dividers, sometimes a table). `GioAnswer` draws it in the ATS's own type, so a
 * reader never sees ###, ** or ---. Raw HTML in an answer is ignored, never run.
 * `gioAnswerPlainText` is the same answer as clean text for Copy (src/lib/gioAnswerText.ts).
 */

type MdNode = { type: string; value?: string; children?: MdNode[] }

/** A line break inside a paragraph stays a line break, as Gio wrote it (remark-breaks, in brief). */
function remarkLineBreaks() {
  const walk = (node: MdNode) => {
    if (!node.children) return
    const next: MdNode[] = []
    for (const child of node.children) {
      if (child.type === 'text' && child.value?.includes('\n')) {
        child.value.split(/\r?\n/).forEach((part, i) => {
          if (i > 0) next.push({ type: 'break' })
          if (part) next.push({ type: 'text', value: part })
        })
      } else {
        walk(child)
        next.push(child)
      }
    }
    node.children = next
  }
  return (tree: MdNode) => walk(tree)
}

const heading = 'font-poppins font-semibold text-[#0d0d09] tracking-[-0.01em] mt-4 mb-1.5 first:mt-0'

const components: Components = {
  h1: ({ children }) => <h3 className={cn(heading, 'text-[15px]')}>{children}</h3>,
  h2: ({ children }) => <h3 className={cn(heading, 'text-[15px]')}>{children}</h3>,
  h3: ({ children }) => <h4 className={cn(heading, 'text-[14px]')}>{children}</h4>,
  h4: ({ children }) => <h5 className={cn(heading, 'text-[13.5px]')}>{children}</h5>,
  h5: ({ children }) => <h5 className={cn(heading, 'text-[13.5px]')}>{children}</h5>,
  h6: ({ children }) => <h5 className={cn(heading, 'text-[13.5px]')}>{children}</h5>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-[#0d0d09]">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-2 last:mb-0 list-disc pl-[18px] space-y-[3px] marker:text-[#8B8F9E] [&_ul]:mt-[3px] [&_ul]:mb-0 [&_ul]:list-[circle]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 last:mb-0 list-decimal pl-[20px] space-y-[3px] marker:text-[#8B8F9E] marker:tabular-nums [&_ol]:mt-[3px] [&_ol]:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5 [&>p]:mb-1">{children}</li>,
  hr: () => <hr className="my-3 border-0 border-t border-[#ECEAE2]" />,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#0d0d09] underline decoration-[#C9B8FB] underline-offset-2 hover:decoration-[#6F3FF5]"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded-[4px] bg-[#F1F0EC] px-1 py-px font-mono text-[12.5px]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-[#F1F0EC] p-3 text-[12.5px] [&>code]:bg-transparent [&>code]:p-0">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-[#E0DDD3] pl-3 text-[#5A6072]">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="mb-2 max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px] tabular-nums">{children}</table>
    </div>
  ),
  // `style` carries a column's alignment (| ---: |).
  th: ({ children, style }) => (
    <th style={style} className="border-b border-[#ECEAE2] py-1.5 pr-3 text-left font-medium text-[#5A6072] whitespace-nowrap">{children}</th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="border-b border-[#F1F0EC] py-1.5 pr-3 align-top">{children}</td>
  ),
}

export function GioAnswer({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('gio-answer min-w-0 break-words', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkLineBreaks]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default GioAnswer
