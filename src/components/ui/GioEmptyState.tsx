import gioFaceEmpty from '@/assets/gio-face-empty.png'

interface GioEmptyStateProps {
  title: string
  description?: string
  className?: string
}

export function GioEmptyState({ title, description, className = '' }: GioEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-10 gap-3 ${className}`}>
      <div className="h-16 w-16 rounded-full overflow-hidden flex items-center justify-center bg-muted/30">
        <img src={gioFaceEmpty} alt="No data" className="h-full w-full object-cover" />
      </div>
      <p className="text-[1.38rem] font-semibold tracking-[-0.06em] text-text-secondary text-center">
        {title}<span className="text-primary">.</span>
      </p>
      {description && (
        <p className="text-sm text-text-tertiary text-center max-w-md leading-relaxed">
          {description}
        </p>
      )}
    </div>
  )
}
