import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { GioAtsLogo } from '@/components/brand/GioAtsLogo'
import { useReportSplashReady } from '@/contexts/SplashReadyContext'
import { cn } from '@/lib/utils'

/**
 * Shell for /privacy and /terms (2026-10-12): the gio ats logo, a title with
 * the lilac period, a fixed effective date (never today's date), a reading
 * column and a footer linking the two. Public, readable on phones.
 */

export const LEGAL_EFFECTIVE = 'October 12, 2026'
export const PRIVACY_EMAIL = 'privacy@virgilio.tech'
export const SUPPORT_EMAIL = 'support@virgilio.tech'
export const LEGAL_ADDRESS = '131 Continental Dr., Suite 305, Newark, Delaware 19713, USA'

function useDocumentMeta(title: string, description: string, path: string) {
  useEffect(() => {
    document.title = title
    let desc = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!desc) {
      desc = document.createElement('meta')
      desc.name = 'description'
      document.head.appendChild(desc)
    }
    desc.content = description
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = `${window.location.origin}${path}`
  }, [title, description, path])
}

export function LegalPage({ title, metaTitle, description, path, children }: {
  title: string
  metaTitle: string
  description: string
  path: string
  children: ReactNode
}) {
  useDocumentMeta(metaTitle, description, path)
  // Public route: when the visitor is signed in to Gio, nothing else on this
  // page clears the cold-load splash, so report ready here.
  useReportSplashReady(true)
  return (
    <div className="min-h-screen bg-[#fffcf9] text-[#1F2230]">
      <header className="mx-auto flex max-w-[760px] items-center px-5 pt-5 sm:px-8 sm:pt-7">
        <Link to="/" aria-label="Gio ATS home" className="inline-flex">
          <GioAtsLogo height={56} />
        </Link>
      </header>
      <main className="mx-auto max-w-[760px] px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <h1 className="font-poppins text-[32px] font-semibold leading-[1.15] tracking-[-0.04em] text-[#0d0d09] sm:text-[40px]">
          {title}
          <span className="text-[#D7C5FB]">.</span>
        </h1>
        <p className="mt-2 font-inter text-[13px] text-[#6B7080]">Effective {LEGAL_EFFECTIVE}</p>
        <div className="mt-8 space-y-4 font-inter text-[15px] leading-[1.65]">{children}</div>
      </main>
      <footer className="border-t border-[#ECEAE3]">
        <div className="mx-auto flex max-w-[760px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-6 font-inter text-[12.5px] text-[#6B7080] sm:px-8">
          <span>© 2026 Virgilio Technologies LLC</span>
          <Link to="/privacy" className="underline-offset-2 hover:underline">Privacy Policy</Link>
          <Link to="/terms" className="underline-offset-2 hover:underline">Terms of Use</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline-offset-2 hover:underline">{SUPPORT_EMAIL}</a>
        </div>
      </footer>
    </div>
  )
}

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-6 pt-6 font-poppins text-[19px] font-semibold tracking-[-0.02em] text-[#0d0d09]">
      {children}
    </h2>
  )
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={className}>{children}</p>
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-[#9CA3AF]">{children}</ul>
}

export function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-[#0d0d09]">{children}</strong>
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  const internal = href.startsWith('/')
  const cls = 'font-medium text-[#6F3FF5] underline underline-offset-2'
  return internal
    ? <Link to={href} className={cls}>{children}</Link>
    : <a href={href} className={cls} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{children}</a>
}

export function Mail({ to }: { to: string }) {
  return <A href={`mailto:${to}`}>{to}</A>
}

/** A two- or three-column table that stacks into cards on phones. */
export function LegalTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[#E7E8EE] bg-white">
      <table className="w-full border-collapse text-left text-[14px] leading-[1.5]">
        <thead className="hidden bg-[#F6F5F1] sm:table-header-group">
          <tr>
            {head.map(h => (
              <th key={h} scope="col" className="px-4 py-2.5 font-inter text-[12px] font-semibold uppercase tracking-[0.05em] text-[#5A6072]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn('block border-t border-[#F1F0EC] px-4 py-3 first:border-t-0 sm:table-row sm:p-0', i === 0 && 'sm:border-t-0')}>
              {r.map((cell, j) => (
                <td key={j} className={cn('block sm:table-cell sm:px-4 sm:py-3 sm:align-top', j === 0 ? 'font-medium text-[#0d0d09]' : 'mt-1 text-[#3A3D48] sm:mt-0')}>
                  {j > 0 && <span className="mb-0.5 block text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#6B7080] sm:hidden">{head[j]}</span>}
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
