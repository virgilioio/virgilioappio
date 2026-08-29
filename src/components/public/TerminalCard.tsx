/** Terminal state card for the public reference pages. */
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react'

export type TerminalTone = 'green' | 'amber' | 'neutral' | 'red'

const TONES: Record<TerminalTone, { bg: string; fg: string; Icon: typeof CheckCircle2 }> = {
  green: { bg: '#E9F8F1', fg: '#0E9F6E', Icon: CheckCircle2 },
  amber: { bg: '#FEF4E6', fg: '#E8590C', Icon: AlertTriangle },
  neutral: { bg: '#F4F3EE', fg: '#5A6072', Icon: Clock },
  red: { bg: '#FDECEC', fg: '#D9382C', Icon: XCircle },
}

export function TerminalCard({
  tone = 'neutral',
  title,
  body,
  action,
  foot,
}: {
  tone?: TerminalTone
  title: string
  body: ReactNode
  action?: ReactNode
  foot?: ReactNode
}) {
  const { bg, fg, Icon } = TONES[tone]
  return (
    <div className="flex flex-col items-center text-center" style={{ padding: '18px 4px 10px' }}>
      <span
        className="inline-flex items-center justify-center"
        style={{ width: 54, height: 54, borderRadius: 999, background: bg, color: fg }}
      >
        <Icon size={24} />
      </span>
      <h1
        className="font-poppins"
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.04em',
          color: '#1F2230',
          marginTop: 16,
        }}
      >
        {title}
        <span style={{ color: '#6F3FF5' }}>.</span>
      </h1>
      <div
        className="font-inter"
        style={{ fontSize: 13.5, lineHeight: 1.65, color: '#5A6072', marginTop: 8, maxWidth: 460 }}
      >
        {body}
      </div>
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
      {foot && (
        <div
          className="font-inter"
          style={{
            fontSize: 11.5,
            color: '#8B8F9E',
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid #F1F0EC',
            width: '100%',
          }}
        >
          {foot}
        </div>
      )}
    </div>
  )
}
