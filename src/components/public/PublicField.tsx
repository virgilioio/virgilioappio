/** Label + control primitive for the public reference pages. */
import type { ReactNode } from 'react'

const controlStyle: React.CSSProperties = {
  height: 38,
  width: '100%',
  borderRadius: 9,
  border: '1px solid #E3E0D6',
  background: '#fff',
  padding: '0 11px',
  fontSize: 13,
  color: '#1F2230',
  outline: 'none',
}

export function PublicField({
  label,
  required,
  helper,
  children,
}: {
  label: string
  required?: boolean
  helper?: string
  children: ReactNode
}) {
  return (
    <label className="block" style={{ minWidth: 0 }}>
      <span
        className="font-inter block"
        style={{ fontSize: 11.5, fontWeight: 500, color: '#5A6072', marginBottom: 5 }}
      >
        {label}
        {required && <span style={{ color: '#E8590C' }}> *</span>}
      </span>
      {children}
      {helper && (
        <span className="font-inter block" style={{ fontSize: 11, color: '#8B8F9E', marginTop: 4 }}>
          {helper}
        </span>
      )}
    </label>
  )
}

export function PublicInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="font-inter" style={{ ...controlStyle, ...props.style }} />
}

export function PublicSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="font-inter"
      style={{ ...controlStyle, appearance: 'none', ...props.style }}
    />
  )
}

export function PublicTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="font-inter"
      style={{
        ...controlStyle,
        height: 'auto',
        minHeight: 96,
        padding: '10px 11px',
        lineHeight: 1.55,
        resize: 'vertical',
        ...props.style,
      }}
    />
  )
}
