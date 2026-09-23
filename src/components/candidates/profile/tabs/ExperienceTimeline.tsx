import { GraduationCap } from 'lucide-react'
import type { CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import type { CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import { ExperienceTimeline as GroupedExperienceTimeline } from '@/components/candidates/experience/ExperienceTimeline'

function formatYear(d?: string) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return String(date.getFullYear())
}

export function ExperienceTimeline({ experiences }: { experiences: CandidateWorkExperience[] }) {
  return <GroupedExperienceTimeline items={experiences} />
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
