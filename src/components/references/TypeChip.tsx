import type { LucideIcon } from 'lucide-react'

/** Answer/field type chip. Neutral for standard types, purple for reference types. */
export function TypeChip({
  label,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string
  tone?: 'neutral' | 'purple'
  icon?: LucideIcon
}) {
  const purple = tone === 'purple'
  return (
    <span
      className="inline-flex items-center font-inter whitespace-nowrap"
      style={{
        gap: 5,
        height: 22,
        padding: '0 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 500,
        background: purple ? '#EDE4FF' : '#F1F0EC',
        color: purple ? '#5B21B6' : '#5A6072',
      }}
    >
      {Icon && <Icon size={12} strokeWidth={2} />}
      {label}
    </span>
  )
}

export default TypeChip
