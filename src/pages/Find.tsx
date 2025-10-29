import { AIJobAssistant } from '@/components/dashboard/AIJobAssistant'
import { Section } from '@/components/layout/Section'
import { Sparkles } from 'lucide-react'

export default function Find() {
  return (
    <Section container className="py-6 sm:py-8 lg:py-12 animate-fade-in">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-virgilio-purple" />
            <h1 className="text-h3-mobile sm:text-h3-desktop font-poppins font-bold text-virgilio-text tracking-page-title">
              Find Talent<span className="text-purple-period">.</span>
            </h1>
          </div>
          <p className="text-body-large text-virgilio-muted max-w-3xl">
            Use AI to generate complete job specifications and discover matching candidates from your talent pool.
          </p>
        </div>

        {/* AI Job Assistant */}
        <AIJobAssistant />
      </div>
    </Section>
  )
}
