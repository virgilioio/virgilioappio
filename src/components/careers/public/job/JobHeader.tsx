import { ChevronRight, Share2, Bookmark, ArrowRight, MapPin, Briefcase, DollarSign, Users, Clock, Sparkles } from 'lucide-react'
import { JobMetaChip } from './JobMetaChip'

interface Props {
  careersHref: string | null
  department: string | null
  title: string
  subtitle: string | null
  featured: boolean
  metaChips: { icon?: any; label: string }[]
  onApply: () => void
  onShare: () => void
  onSave: () => void
  saved: boolean
  accentColor?: string
}

export function JobHeader({
  careersHref,
  department,
  title,
  subtitle,
  featured,
  metaChips,
  onApply,
  onShare,
  onSave,
  saved,
  accentColor,
}: Props) {
  const accent = accentColor || '#6F3FF5'

  return (
    <section className="border-b border-black/5 bg-[#FAF7F2]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-7">
        {/* breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[11.5px] text-[#8B8F9E]">
          {careersHref ? (
            <a href={careersHref} className="hover:text-[#0d0d09]">Careers</a>
          ) : (
            <span>Careers</span>
          )}
          {department && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span>{department}</span>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <span className="text-[#5a6072] truncate">{title}{subtitle ? ` — ${subtitle}` : ''}</span>
        </nav>

        {/* badges */}
        <div className="mt-4 flex items-center gap-1.5 flex-wrap">
          {department && (
            <span
              className="inline-flex items-center h-[20px] px-2 rounded text-[10px] font-poppins font-semibold tracking-[0.08em] uppercase"
              style={{ background: `${accent}26`, color: accent }}
            >
              {department}
            </span>
          )}

          {featured && (
            <span className="inline-flex items-center h-[20px] px-2 rounded text-[10px] font-poppins font-semibold tracking-[0.08em] uppercase bg-[#0d0d09] text-[#FFFCF9]">
              Featured
            </span>
          )}
        </div>

        {/* title row */}
        <div className="mt-3 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="min-w-0">
            <h1 className="font-poppins font-semibold text-[#0d0d09] tracking-[-0.04em] leading-[1.02] text-[40px] sm:text-[52px]">
              {title}
            </h1>
            {subtitle && (
              <div
                className="text-[#5a6072] text-[34px] sm:text-[44px] leading-[1.05] italic mt-0.5 font-normal"
                style={{ fontFamily: 'Instrument Serif, Cormorant, Georgia, serif' }}
              >
                {subtitle}
              </div>
            )}
          </div>

          <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={onShare}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-black/10 text-[12.5px] font-poppins font-medium text-[#0d0d09] hover:bg-[#FAFAF7]"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>
              <button
                onClick={onSave}
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[12.5px] font-poppins font-medium ${
                  saved
                    ? ''
                    : 'bg-white border-black/10 text-[#0d0d09] hover:bg-[#FAFAF7]'
                }`}
                style={saved ? { background: `${accent}26`, borderColor: `${accent}26`, color: accent } : undefined}
              >
                <Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-current' : ''}`} />

                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
            <button
              onClick={onApply}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-[#0d0d09] text-[#FFFCF9] text-[13px] font-poppins font-medium hover:bg-black"
            >
              Apply for this role
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <div className="text-[11px] text-[#8B8F9E] text-right">
              takes about 4 minutes · No account needed
            </div>
          </div>
        </div>

        {/* meta chips */}
        {metaChips.length > 0 && (
          <div className="mt-5 flex items-center gap-1.5 flex-wrap">
            {metaChips.map((c, i) => (
              <JobMetaChip key={i} icon={c.icon} label={c.label} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// Re-export common icons consumers will pick from
export const HeaderIcons = { MapPin, Briefcase, DollarSign, Users, Clock, Sparkles }
