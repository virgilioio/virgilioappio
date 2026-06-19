import { GioLogomark } from '@/components/icons/GioLogomark'

interface Props {
  companyName: string
  logoUrl: string | null
  websiteUrl: string | null
}

export function CareersFooter({ companyName, logoUrl, websiteUrl }: Props) {
  const cols = [
    { title: 'Company', links: ['About', 'Customers', 'Press', 'Contact'] },
    { title: 'Product', links: ['ATS', 'CRM', 'Sourcing', 'Pricing'] },
    { title: 'Hiring', links: ['Open roles', 'Internships', 'Life at ' + companyName, 'Benefits'] },
  ]
  return (
    <footer className="bg-[#0d0d09] text-[#FFFCF9]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-5 space-y-3">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="h-7 w-7 rounded object-cover" />
            ) : (
              <div className="h-7 w-7 rounded bg-white/10 flex items-center justify-center font-poppins font-semibold text-[12px]">
                {companyName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="font-poppins font-semibold text-[14px]">{companyName}</span>
          </div>
          <p className="text-[12.5px] text-white/55 max-w-sm leading-relaxed">
            We're building the modern hiring stack — fast, fair, and AI-assisted.
          </p>
        </div>

        {cols.map((c) => (
          <div key={c.title} className="md:col-span-2">
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/50 font-medium mb-3">{c.title}</div>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l}>
                  <a
                    href={websiteUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12.5px] text-white/70 hover:text-white"
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="md:col-span-1" />
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-[11.5px] text-white/55">
          <span>© {new Date().getFullYear()} {companyName}. All rights reserved.</span>
          <div className="flex items-center gap-2 text-[#FFFCF9]">
            <span>hiring powered by</span>
            <GioLogomark height={18} aria-label="Gio" />
          </div>
        </div>
      </div>
    </footer>
  )
}
