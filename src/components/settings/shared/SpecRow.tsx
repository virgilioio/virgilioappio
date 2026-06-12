import { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'

interface SpecRowProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  last?: boolean
}

/** Standard row inside a SpecCard. Hairline separator on bottom unless `last`. */
export function SpecRow({ children, className, style, last }: SpecRowProps) {
  return (
    <div
      className={cn('flex items-center gap-3', className)}
      style={{
        padding: '10px 18px',
        borderBottom: last ? 'none' : '1px solid #F1F0EC',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function SpecEmpty({ icon: Icon, title, body }: { icon?: any; title: string; body?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: '30px 18px', gap: 4 }}
    >
      {Icon && <Icon size={20} color="#B5B9C4" strokeWidth={1.75} className="mb-1" />}
      <div className="font-inter font-semibold text-[#0d0d09]" style={{ fontSize: 12.5 }}>
        {title}
      </div>
      {body && (
        <div className="font-inter text-[#8B8F9E]" style={{ fontSize: 11.5 }}>
          {body}
        </div>
      )}
    </div>
  )
}

export const NOIR_BTN =
  'inline-flex items-center gap-1.5 font-inter font-medium text-[#fffcf9] bg-[#0d0d09] hover:bg-[#1f1f1a] rounded-lg transition-colors disabled:opacity-50'

export const SEC_BTN =
  'inline-flex items-center gap-1.5 font-inter font-medium text-[#5A6072] bg-white border border-[#E7E8EE] hover:bg-[#FAFAF7] rounded-lg transition-colors disabled:opacity-50'
