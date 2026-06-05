interface Step {
  title: string
  detail?: string
}

interface Props {
  steps: Step[]
  accentColor?: string
}

export function JobProcessList({ steps, accentColor }: Props) {
  const color = accentColor || '#6F3FF5'
  return (
    <ol className="space-y-4">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3.5">
          <div
            className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[11.5px] font-poppins font-semibold"
            style={
              i === 0
                ? { background: color, color: '#fff' }
                : { background: '#F1F0EC', color: '#0d0d09' }
            }
          >
            {i + 1}
          </div>
          <div className="pt-0.5">
            <div className="font-poppins font-semibold text-[14px] text-[#0d0d09] tracking-[-0.01em]">
              {step.title}
            </div>
            {step.detail && (
              <div className="text-[13px] text-[#5a6072] mt-0.5">{step.detail}</div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

