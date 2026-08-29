import { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Sheet, SheetContent, SheetPortal, SheetOverlay } from '@/components/ui/sheet'

interface FormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  width?: number
  eyebrow?: ReactNode
  title: string
  subtitle?: ReactNode
  footer?: ReactNode
  children?: ReactNode
}

/**
 * Right-anchored form sheet used by the Reference checks module.
 * Rounded on the LEFT edge only. Body background is #FAFAF7 so white
 * FormSection cards sit on top of it.
 *
 * The lilac "." after the title is appended here — callers must not add one.
 */
export function FormSheet({
  open,
  onOpenChange,
  width = 620,
  eyebrow,
  title,
  subtitle,
  footer,
  children,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPortal>
        <SheetOverlay style={{ background: 'rgba(13,13,9,0.18)' }} />
        <SheetContent
          side="right"
          hideClose
          className="p-0 gap-0 border-0 sm:max-w-none flex flex-col"
          style={{
            width,
            maxWidth: '100vw',
            height: '100%',
            borderTopLeftRadius: 16,
            borderBottomLeftRadius: 16,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            background: '#fff',
            boxShadow:
              '0 24px 80px -12px rgba(13,13,9,0.2), 0 0 0 1px rgba(13,13,9,0.04)',
          }}
        >
          <header
            className="flex items-start gap-3 shrink-0"
            style={{ padding: '16px 24px 14px', borderBottom: '1px solid #F1F0EC' }}
          >
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <div
                  className="font-inter uppercase truncate"
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: '#6F3FF5',
                    letterSpacing: '0.08em',
                    marginBottom: 6,
                  }}
                >
                  {eyebrow}
                </div>
              )}
              <h2
                className="font-poppins"
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '-0.035em',
                  color: '#0d0d09',
                  lineHeight: 1.15,
                }}
              >
                {title}
                <span style={{ color: '#6F3FF5' }}>.</span>
              </h2>
              {subtitle && (
                <p
                  className="font-inter"
                  style={{
                    fontSize: 12.5,
                    color: '#5A6072',
                    lineHeight: 1.5,
                    maxWidth: 480,
                    marginTop: 6,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="shrink-0 inline-flex items-center justify-center"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <X size={16} color="#5A6072" />
            </button>
          </header>

          <div
            className="flex-1 overflow-auto"
            style={{ padding: '20px 24px 24px', background: '#FAFAF7' }}
          >
            {children}
          </div>

          {footer && (
            <footer
              className="shrink-0 flex items-center"
              style={{
                padding: '12px 24px',
                borderTop: '1px solid #F1F0EC',
                background: '#fff',
                gap: 10,
              }}
            >
              {footer}
            </footer>
          )}
        </SheetContent>
      </SheetPortal>
    </Sheet>
  )
}

export default FormSheet
