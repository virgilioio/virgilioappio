import gioFaceEmpty from '@/assets/gio-face-empty.png'

interface TalentIntelligenceEmptyStateProps {
  message?: string
}

export function TalentIntelligenceEmptyState({ message = 'No data available yet for this visualization.' }: TalentIntelligenceEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <img src={gioFaceEmpty} alt="No data" className="h-10 w-10 opacity-60" />
      <p className="text-[1.38rem] font-semibold tracking-[-0.06em] text-virgilio-muted">
        {message}<span className="text-virgilio-purple">.</span>
      </p>
    </div>
  )
}
