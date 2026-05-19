export function CareersHowWeHireCard() {
  const chips = ['48h reply guarantee', 'Paid take-homes', 'Public rubrics', 'Salary on every role', 'No degree required']
  const tiles = [
    { label: 'Team offsite', sub: 'Lisbon', from: '#c4a6ff', to: '#8d6eff' },
    { label: 'Design crit', sub: 'weekly', from: '#9be8d0', to: '#3fb191' },
    { label: 'HQ office', sub: 'NYC', from: '#2e2e2e', to: '#0a0a0a' },
    { label: 'Ship week', sub: 'quarterly', from: '#ffd166', to: '#f4a261' },
  ]
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
      <div className="rounded-2xl bg-white border border-black/5 p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-[#8B8F9E] font-medium">How we hire</div>
          <h3 className="font-poppins font-bold text-[#0d0d09] text-[28px] lg:text-[34px] leading-[1.1] tracking-[-0.03em]">
            Fast, structured, and{' '}
            <span className="italic font-normal" style={{ fontFamily: 'Instrument Serif, Cormorant, Georgia, serif' }}>respectful of</span><br />
            your time<span className="text-[hsl(var(--purple-period))]">.</span>
          </h3>
          <p className="text-[14px] text-[#3f4451] leading-relaxed max-w-md">
            Every applicant hears back within 48 hours. Most processes run in 2–3 weeks with a tight, standardized panel. We share rubrics ahead of time, we pay for take-homes, and we never ghost.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {chips.map((c) => (
              <span key={c} className="inline-flex items-center h-7 px-2.5 rounded-full bg-[#F1F0EC] text-[11.5px] text-[#3f4451]">
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="aspect-[5/4] rounded-2xl p-4 flex items-end text-white"
              style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
            >
              <div>
                <div className="font-poppins font-semibold text-[14px] tracking-[-0.01em]">{t.label}</div>
                <div className="text-[12px] text-white/80">{t.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
