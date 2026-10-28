import { Mail } from 'lucide-react'
import { GoogleWorkspaceConnection } from '@/components/settings/GoogleWorkspaceConnection'
import { ProfileCard } from './ProfileParts'

/**
 * Your Google Workspace on My profile (Allan, 2026-10-28), where Settings ›
 * Email & calendar used to be: one connection for Gmail and Google Calendar,
 * so candidates get your emails from your address, interviews land on your
 * calendar and your booking links offer your real free times. For Virgilio's
 * own people it's one of the profile checks (`useProfileChecks`, 'google').
 */
export function GoogleWorkspaceCard({ note }: { note?: string }) {
  return (
    <ProfileCard id="card-google" title="Google Workspace" icon={Mail} tone="blue">
      <p className="mb-3 font-inter text-[12.5px] leading-[1.5] text-[#5A6072]">
        {note ?? 'Candidates get your emails from your own address, interviews land on your calendar and your booking links offer your real free times.'}
      </p>
      <GoogleWorkspaceConnection stacked />
    </ProfileCard>
  )
}
