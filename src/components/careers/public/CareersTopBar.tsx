import { GoGioLogo } from '@/components/GoGioLogo'
import { ExternalLink } from 'lucide-react'

interface Props {
  logoUrl: string | null
  companyName: string
  websiteUrl: string | null
  showCompanyName: boolean
}

export function CareersTopBar({ logoUrl, companyName, websiteUrl, showCompanyName }: Props) {
  const onLogoClick = () => {
    if (websiteUrl) window.open(websiteUrl, '_blank', 'noopener,noreferrer')
  }

  const domain = websiteUrl ? websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : null

  return (
    <header className="border-b border-black/5 bg-[#FAF7F2]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div
          className={`flex items-center gap-3 ${websiteUrl ? 'cursor-pointer' : ''}`}
          onClick={onLogoClick}
        >
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-[#0d0d09] text-[#FFFCF9] flex items-center justify-center font-poppins font-semibold text-sm">
              {companyName.slice(0, 1).toUpperCase()}
            </div>
          )}
          {showCompanyName && (
            <div className="leading-tight">
              <div className="font-poppins font-semibold text-[14px] text-[#0d0d09] tracking-[-0.02em]">
                {companyName}
              </div>
              <div className="text-[11px] text-[#5a6072] tracking-wide uppercase">Careers</div>
            </div>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-7 text-[13px] text-[#5a6072]">
          {websiteUrl && (
            <>
              <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#0d0d09]">Company</a>
              <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#0d0d09]">Product</a>
              <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#0d0d09]">Blog</a>
            </>
          )}
          <span className="font-medium text-[#0d0d09]">Careers</span>
        </nav>

        {domain && (
          <a
            href={websiteUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white border border-black/10 text-[12px] text-[#0d0d09] hover:bg-[#FAFAF7]"
          >
            {domain}
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        )}
      </div>
    </header>
  )
}

// fallback to avoid unused import warning when not rendering brand logo
void GoGioLogo
