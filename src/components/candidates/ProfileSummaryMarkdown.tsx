import ReactMarkdown from "react-markdown";

interface ProfileSummaryMarkdownProps {
  content: string;
  className?: string;
}

export function ProfileSummaryMarkdown({ content, className = "" }: ProfileSummaryMarkdownProps) {
  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-lg font-semibold text-foreground mb-3 mt-4 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mb-3 mt-5 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mb-2 mt-3 first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="text-sm text-foreground mb-3 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic text-foreground">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1.5 mb-3 text-sm">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1.5 mb-3 text-sm">{children}</ol>,
          li: ({ children }) => <li className="text-foreground leading-relaxed">{children}</li>,
          hr: () => <hr className="border-border my-4" />,
          a: ({ children, href }) => (
            <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
