import { EmptyState } from '@/components/ui/empty-state'
import { SoftChart } from '@/components/ui/EmptyIllustrations'

export default function AnalyticsHub() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <EmptyState
        size="route"
        illustration={<SoftChart />}
        title="Analytics is coming"
        body="This is where workspace-wide insights, dashboards and trends will live. Set up the glyph and we'll bring this module to life."
      />
    </div>
  )
}
