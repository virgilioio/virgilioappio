/**
 * Shell for the token-resolved public reference pages.
 *
 * Deliberately imports nothing from the authenticated app — no Layout, no
 * AppHeader, no PageHeader. Agency branding only; Gio appears once, in the
 * footer footnote.
 */
import type { ReactNode } from 'react'
import { Lock, ShieldCheck } from 'lucide-react'

import { useReportSplashReady } from '@/contexts/SplashReadyContext'

import { AgencyBrand } from './AgencyBrand'

interface PublicPageShellProps {
  agencyName: string
  logoUrl?: string | null
  pageKind: string
  width?: number
  footnote?: string
  children: ReactNode
}

export function PublicPageShell({
  agencyName,
  logoUrl,
  pageKind,
  width = 760,
  footnote,
  children,
}: PublicPageShellProps) {
  // Safety net: a public page must never be trapped behind the cold-load
  // splash, which only clears when something reports readiness.
  useReportSplashReady(true)

  return (
    <div style={{ minHeight: '100dvh', background: '#FAF8F3' }}>
      <header
        style={{
          borderBottom: '1px solid #EDEBE3',
          background: 'rgba(250,248,243,0.9)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <div
          className="flex items-center"
          style={{ maxWidth: width, margin: '0 auto', padding: '16px 20px', gap: 12 }}
        >
          <AgencyBrand name={agencyName} logoUrl={logoUrl} />
          <span className="flex items-center" style={{ marginLeft: 'auto', gap: 10 }}>
            <span className="font-inter hidden sm:inline" style={{ fontSize: 11.5, color: '#8B8F9E' }}>
              {pageKind}
            </span>
            <span
              className="hidden sm:inline"
              style={{ width: 1, height: 14, background: '#E6E3DA' }}
              aria-hidden
            />
            <span
              className="font-inter inline-flex items-center"
              style={{ fontSize: 11.5, color: '#0E9F6E', gap: 5, fontWeight: 500 }}
            >
              <ShieldCheck size={13} />
              Secure link
            </span>
          </span>
        </div>
      </header>

      <main style={{ maxWidth: width, margin: '0 auto', padding: '26px 16px 56px' }}>
        <div
          className="public-card"
          style={{
            background: '#fff',
            border: '1px solid #EDEBE3',
            borderRadius: 22,
            boxShadow: '0 22px 54px -30px rgba(20,18,12,0.28)',
            padding: '30px 30px 26px',
          }}
        >
          {children}
        </div>

        <footer
          className="flex flex-wrap items-center"
          style={{ gap: 10, padding: '18px 6px 0', color: '#8B8F9E' }}
        >
          <Lock size={12} />
          <span className="font-inter" style={{ fontSize: 11.5 }}>
            {footnote ?? 'This link is unique to you. Please don’t forward it.'}
          </span>
          <span style={{ marginLeft: 'auto' }} className="flex items-center gap-3">
            <a
              href="/privacy"
              className="font-inter"
              style={{ fontSize: 11.5, color: '#8B8F9E', textDecoration: 'underline' }}
            >
              Privacy
            </a>
            <a
              href="mailto:support@gogio.com?subject=Report%20a%20reference%20link"
              className="font-inter"
              style={{ fontSize: 11.5, color: '#8B8F9E', textDecoration: 'underline' }}
            >
              Report this link
            </a>
            <span className="font-inter" style={{ fontSize: 11.5 }}>
              Recruitment software by{' '}
              <span style={{ color: '#6F3FF5', fontWeight: 600 }}>Gio</span>
            </span>
          </span>
        </footer>
      </main>

      <style>{`
        @media (max-width: 759px) {
          .public-card { border-radius: 16px !important; padding: 22px 18px 20px !important; }
        }
      `}</style>
    </div>
  )
}
