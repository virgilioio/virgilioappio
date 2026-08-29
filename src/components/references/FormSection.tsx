import { ReactNode } from 'react'

interface FormSectionProps {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  children?: ReactNode
}

/**
 * Section shell inside FormSheet. Titles are UPPERCASE with POSITIVE tracking —
 * the opposite of page titles.
 */
export function FormSection({ title, subtitle, action, children }: FormSectionProps) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div
        className="flex items-start justify-between"
        style={{ marginBottom: 10, gap: 12 }}
      >
        <div className="min-w-0">
          <h3
            className="font-poppins uppercase"
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: '#1F2230',
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              className="font-inter"
              style={{ fontSize: 11.5, color: '#8B8F9E', marginTop: 3 }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div
        style={{
          background: '#fff',
          border: '1px solid #E7E8EE',
          borderRadius: 12,
          padding: 16,
        }}
      >
        {children}
      </div>
    </section>
  )
}

export default FormSection
