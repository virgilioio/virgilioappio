import { GraduationCap } from 'lucide-react'
import type { CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import type { CandidateEducation } from '@/components/candidates/CandidateEducationComponent'

function formatMonthYear(d?: string) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatYear(d?: string) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return String(date.getFullYear())
}

function monthsBetween(start?: string, end?: string) {
  if (!start) return 0
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)))
}

function formatDuration(months: number) {
  if (months <= 0) return ''
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m}m`
  if (m === 0) return `${y}y`
  return `${y}y ${m}m`
}

interface ExperienceTimelineProps {
  experiences: CandidateWorkExperience[]
}

export function ExperienceTimeline({ experiences }: ExperienceTimelineProps) {
  if (experiences.length === 0) {
    return <p className="font-inter text-[12.5px] text-[#8B8F9E]">No experience added yet.</p>
  }

  return (
    <ol className="relative">
      {experiences.map((exp, i) => {
        const isLast = i === experiences.length - 1
        const current = exp.is_current || !exp.end_date
        const months = monthsBetween(exp.start_date, exp.end_date)
        const dateRange = `${formatMonthYear(exp.start_date)}${exp.start_date ? ' — ' : ''}${current ? 'Present' : formatMonthYear(exp.end_date)}`.trim()
        const duration = formatDuration(months)
        const meta = [dateRange, duration, exp.location].filter(Boolean).join(' · ')
        const letter = (exp.company_name || '?').charAt(0).toUpperCase()
        return (
          <li key={exp.id} className={`relative flex gap-3.5 ${isLast ? '' : 'pb-[18px]'}`}>
            {!isLast && (
              <span
                aria-hidden
                className="absolute w-px bg-[#E7E8EE]"
                style={{ left: 17, top: 36, bottom: 0 }}
              />
            )}
            <div
              className={`relative z-10 flex-shrink-0 w-9 h-9 rounded-[9px] flex items-center justify-center font-poppins font-bold text-[14px] ${
                current ? 'bg-[#0d0d09] text-[#fffcf9]' : 'bg-[#F1F0EC] text-[#1F2230]'
              }`}
              style={{ letterSpacing: '-0.03em' }}
            >
              {letter}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-poppins font-semibold text-[13.5px] text-[#1F2230]" style={{ letterSpacing: '-0.005em' }}>
                  {exp.job_title}
                </h4>
                {current && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#D1FAE5] text-[#065F46] font-inter text-[10.5px] font-medium px-1.5 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#12B886]" />
                    Current
                  </span>
                )}
              </div>
              {exp.company_name && (
                <p className="mt-0.5 font-inter text-[12.5px] font-medium text-[#1F2230]">{exp.company_name}</p>
              )}
              {meta && (
                <p className="mt-[3px] font-inter text-[11.5px] text-[#8B8F9E]">{meta}</p>
              )}
              {exp.description && (
                <p className="mt-2.5 font-inter text-[12.5px] text-[#5A6072]" style={{ lineHeight: 1.55 }}>
                  {exp.description}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

interface EducationTimelineProps {
  education: CandidateEducation[]
}

export function EducationTimeline({ education }: EducationTimelineProps) {
  if (education.length === 0) {
    return <p className="font-inter text-[12.5px] text-[#8B8F9E]">No education added yet.</p>
  }

  return (
    <ol className="relative">
      {education.map((edu, i) => {
        const isLast = i === education.length - 1
        const dates = [formatYear(edu.start_date), formatYear(edu.end_date)].filter(Boolean).join(' — ')
        const meta = [dates, (edu as any).location].filter(Boolean).join(' · ')
        const program = [edu.degree_type, edu.field_of_study].filter(Boolean).join(' · ')
        return (
          <li key={edu.id} className={`relative flex gap-3.5 ${isLast ? '' : 'pb-4'}`}>
            {!isLast && (
              <span
                aria-hidden
                className="absolute w-px bg-[#E7E8EE]"
                style={{ left: 17, top: 36, bottom: 0 }}
              />
            )}
            <div className="relative z-10 flex-shrink-0 w-9 h-9 rounded-[9px] bg-[#EDE4FF] flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-[#5B21B6]" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="font-poppins font-semibold text-[13.5px] text-[#1F2230]" style={{ letterSpacing: '-0.005em' }}>
                {edu.institution_name}
              </h4>
              {program && (
                <p className="mt-0.5 font-inter text-[12.5px] text-[#1F2230]">{program}</p>
              )}
              {meta && (
                <p className="mt-[3px] font-inter text-[11.5px] text-[#8B8F9E]">{meta}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
