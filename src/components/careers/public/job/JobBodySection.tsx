import { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
}

export function JobBodySection({ title, children }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="font-poppins font-semibold text-[18px] text-[#0d0d09] tracking-[-0.02em]">{title}</h2>
      <div className="text-[14.5px] leading-[1.65] text-[#3f4451]">{children}</div>
    </section>
  )
}

export function JobBulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2 h-1 w-1 rounded-full bg-[#6F3FF5] shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
