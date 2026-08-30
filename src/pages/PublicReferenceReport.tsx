import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { PublicPageShell } from '@/components/public/PublicPageShell'
import { supabase } from '@/integrations/supabase/client'
import { useReportSplashReady } from '@/contexts/SplashReadyContext'

interface ReportAnswer {
  id: string
  label: string
  type: string
  value: unknown
}

interface ReportReferee {
  id: string
  name: string
  relationship?: string | null
  title?: string | null
  company?: string | null
  period?: string | null
  submitted_at?: string | null
  answers: ReportAnswer[]
}

interface ReportPayload {
  brand: { agency_name: string; logo_url: string | null }
  candidate_name: string
  job_title: string
  client_name: string
  referee_count: number
  required_count: number
  referees: ReportReferee[]
}

/**
 * Client-facing reference report, resolved by an opaque share token. No account,
 * agency branding only — the payload is filtered server-side.
 */
export default function PublicReferenceReport() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<ReportPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useReportSplashReady(!!data || !!error)

  useEffect(() => {
    let cancelled = false
    supabase.functions
      .invoke('reference-report', { body: { action: 'resolve', token } })
      .then(({ data: res, error: err }) => {
        if (cancelled) return
        if (err || !res || (res as any).error) setError('not_found')
        else setData(res as ReportPayload)
      })
      .catch(() => !cancelled && setError('not_found'))
    return () => {
      cancelled = true
    }
  }, [token])

  if (error) {
    return (
      <PublicPageShell agencyName="References" pageKind="Reference report" width={720}>
        <div style={{ padding: '32px 4px' }}>
          <h1 className="font-poppins" style={{ fontSize: 20, fontWeight: 600, color: '#1F2230' }}>
            This link is no longer available
          </h1>
          <p className="font-inter" style={{ fontSize: 13, color: '#5A6072', marginTop: 8 }}>
            The report may have expired or been withdrawn. Ask your recruiter for a fresh link.
          </p>
        </div>
      </PublicPageShell>
    )
  }

  if (!data) return null

  return (
    <PublicPageShell
      agencyName={data.brand.agency_name}
      logoUrl={data.brand.logo_url}
      pageKind="Reference report"
      width={720}
    >
      <div style={{ padding: '24px 0 48px' }}>
        <h1
          className="font-poppins"
          style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.04em', color: '#1F2230' }}
        >
          References for {data.candidate_name}
        </h1>
        <p className="font-inter" style={{ fontSize: 13, color: '#5A6072', marginTop: 6 }}>
          {[data.job_title, data.client_name].filter(Boolean).join(' · ')} ·{' '}
          {data.referee_count} of {data.required_count} references in
        </p>

        <div className="flex flex-col" style={{ gap: 14, marginTop: 24 }}>
          {data.referees.map((r) => (
            <div
              key={r.id}
              style={{
                background: '#fff',
                border: '1px solid #EDEBE3',
                borderRadius: 12,
                padding: '16px 18px',
              }}
            >
              <div className="flex items-baseline" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span
                  className="font-poppins"
                  style={{ fontSize: 15, fontWeight: 600, color: '#1F2230' }}
                >
                  {r.name}
                </span>
                {r.relationship && (
                  <span className="font-inter" style={{ fontSize: 11.5, color: '#8B8F9E' }}>
                    {r.relationship}
                  </span>
                )}
              </div>
              <p className="font-inter" style={{ fontSize: 11.5, color: '#8B8F9E', marginTop: 3 }}>
                {[[r.title, r.company].filter(Boolean).join(' · '), r.period]
                  .filter(Boolean)
                  .join(' — ')}
              </p>

              <div className="flex flex-col" style={{ gap: 12, marginTop: 14 }}>
                {r.answers.map((a) => (
                  <div key={a.id}>
                    <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E' }}>
                      {a.label}
                    </p>
                    <p
                      className="font-inter"
                      style={{ fontSize: 13, color: '#1F2230', marginTop: 2, lineHeight: 1.6 }}
                    >
                      {typeof a.value === 'object'
                        ? JSON.stringify(a.value)
                        : String(a.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicPageShell>
  )
}
