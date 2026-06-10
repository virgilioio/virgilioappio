import { Link } from 'react-router-dom'
import { GoGioLogo } from '@/components/GoGioLogo'
import { PipelineProductGraphic } from '@/components/auth/PipelineProductGraphic'

interface AuthLayoutProps {
  children: React.ReactNode
}

/**
 * Shared chrome for /auth (login) and /signup:
 * - Top-left Gio logo
 * - Left column: PipelineProductGraphic
 * - Right column: brand heading + form card + footer
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#fffcf9' }}>
      {/* Top-left logo */}
      <header className="px-6 sm:px-8 lg:px-12 pt-6">
        <Link to="/" aria-label="Gio home" className="inline-flex">
          <GoGioLogo size="2xl" />
        </Link>
      </header>

      {/* Two-column body */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center px-6 sm:px-8 lg:px-12 py-10 lg:py-12">
        {/* Left: product graphic (hidden on small screens) */}
        <div className="hidden lg:flex justify-center items-center">
          <PipelineProductGraphic />
        </div>

        {/* Right: heading + form + footer — centered in its own half */}
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8 text-center">
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground"
              style={{ fontFamily: 'Poppins', letterSpacing: '-0.06em' }}
            >
              Find your people<span style={{ color: '#d7c5fb' }}>.</span>
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">{children}</div>

          <footer className="mt-6 text-xs text-foreground/70 text-center">
            <nav className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/privacy" className="underline underline-offset-2 hover:no-underline">
                Privacy Policy
              </Link>
              <span aria-hidden="true">•</span>
              <Link to="/terms" className="underline underline-offset-2 hover:no-underline">
                Terms of Service
              </Link>
            </nav>
            <p className="mt-2">© {new Date().getFullYear()} Gio ATS</p>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default AuthLayout
