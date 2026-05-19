import { LucideIcon } from 'lucide-react'

interface Props {
  icon?: LucideIcon
  label: string
}

export function JobMetaChip({ icon: Icon, label }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white border border-black/5 text-[12px] text-[#3f4451]">
      {Icon && <Icon className="h-3.5 w-3.5 text-[#8B8F9E]" />}
      <span className="whitespace-nowrap">{label}</span>
    </span>
  )
}
