import { ExternalLink } from 'lucide-react'
import { GIO_SALES_COMPANIES_URL } from '@/hooks/useChildOrganizationsForJobCreation'

/** Quiet line shown wherever a client would have been created in the ATS. */
export function ClientsManagedNote({ label = 'Clients are managed in Gio Sales' }: { label?: string }) {
  return (
    <p className="mt-1.5 font-inter text-[11.5px] text-[#8B8F9E]">
      {label} ·{' '}
      <a
        href={GIO_SALES_COMPANIES_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-[#1F2230] underline underline-offset-2 decoration-[#B9B6AC]"
      >
        Open Gio Sales <ExternalLink className="h-3 w-3" />
      </a>
    </p>
  )
}
