import { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { GioWordmark } from '@/components/icons/GioWordmark'
import { ProgressTracker } from './ProgressTracker'
import { WorkspacePreview, PreviewState } from './WorkspacePreview'
import './onboarding.css'

interface OnboardingShellProps {
  step: number // 1..6
  totalSteps?: number // tracker total (5 — final step is "All set" handoff)
  showTracker?: boolean
  onSkip?: () => void // when provided, shows "Skip for now →"
  preview: PreviewState
  children: ReactNode
}

export function OnboardingShell({
  step,
  totalSteps = 5,
  showTracker = true,
  onSkip,
  preview,
  children,
}: OnboardingShellProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fffcf9',
        display: 'flex',
        flexDirection: 'row',
      }}
      className="ob-shell"
    >
      {/* Left column — fixed 520px on lg+, full-width below */}
      <div
        className="ob-left"
        style={{
          width: '100%',
          maxWidth: 520,
          padding: '26px 48px 32px',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Top row: logo + (optional) skip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'auto',
          }}
        >
          <GioWordmark height={24} />
          {onSkip ? (
            <button
              type="button"
              onClick={onSkip}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#8B8F9E',
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Skip for now <ArrowRight size={12} strokeWidth={2} />
            </button>
          ) : null}
        </div>

        {/* Middle: content vertically centered */}
        <div
          style={{
            margin: 'auto 0',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </div>

        {/* Bottom: tracker */}
        <div style={{ marginTop: 'auto', paddingTop: 32 }}>
          {showTracker && <ProgressTracker current={step} total={totalSteps} />}
        </div>
      </div>

      {/* Right column — preview, hidden under lg */}
      <div
        className="ob-right"
        style={{
          flex: 1,
          display: 'flex',
        }}
      >
        <WorkspacePreview {...preview} />
      </div>
    </div>
  )
}

// Shared title primitive
export function ObTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 34,
        fontWeight: 600,
        letterSpacing: '-0.04em',
        lineHeight: 1.1,
        color: '#0d0d09',
        margin: 0,
      }}
    >
      {children}
      <span style={{ color: '#D7C5FB' }}>.</span>
    </h1>
  )
}

export function ObKicker({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
        color: '#8B8F9E',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

export function ObSub({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 13.5,
        color: '#5A6072',
        lineHeight: 1.55,
        maxWidth: 380,
        marginTop: 12,
        marginBottom: 0,
      }}
    >
      {children}
    </p>
  )
}

interface ObButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}
export function ObPrimaryButton({ children, ...rest }: ObButtonProps) {
  return (
    <button
      {...rest}
      style={{
        height: 44,
        borderRadius: 10,
        background: '#0d0d09',
        color: '#fffcf9',
        border: 'none',
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        opacity: rest.disabled ? 0.5 : 1,
        fontFamily: 'Inter, sans-serif',
        fontSize: 13.5,
        fontWeight: 600,
        padding: '0 18px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        transition: 'opacity 150ms ease',
        ...(rest.style || {}),
      }}
    >
      {children}
      <ArrowRight size={14} strokeWidth={2} />
    </button>
  )
}

export function ObLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 12,
        fontWeight: 600,
        color: '#0d0d09',
        display: 'block',
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  )
}

export function ObInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`ob-input ${props.className || ''}`}
      style={{
        height: 44,
        borderRadius: 10,
        border: '1.5px solid #E7E8EE',
        background: '#FFFFFF',
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        color: '#0d0d09',
        padding: '0 14px',
        width: '100%',
        outline: 'none',
        transition: 'border-color 150ms ease',
        ...(props.style || {}),
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#6F3FF5'
        props.onFocus?.(e)
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '#E7E8EE'
        props.onBlur?.(e)
      }}
    />
  )
}

export function ObHint({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
        color: '#8B8F9E',
        marginTop: 6,
        marginBottom: 0,
      }}
    >
      {children}
    </p>
  )
}
