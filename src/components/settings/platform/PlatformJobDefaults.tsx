import { useState } from 'react'
import { PlatformJobStagesManager } from '../PlatformJobStagesManager'
import { PlatformApplicationFieldsManager } from '../PlatformApplicationFieldsManager'
import { OfferTemplatesManager } from '../OfferTemplatesManager'
import { AutomationsTab } from '../AutomationsTab'

type TopTab = 'stages' | 'fields' | 'templates' | 'automations'
type SubTemplate =
  | 'offer-forms'
  | 'offer-letters'
  | 'email-templates'
  | 'contracts'
  | 'rejection-reasons'
  | 'rejection-templates'
  | 'candidate-sources'

function Pill({ active, onClick, children, small = false }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-inter font-medium transition-colors"
      style={{
        height: small ? 26 : 28,
        padding: small ? '0 10px' : '0 12px',
        borderRadius: 999,
        fontSize: small ? '11px' : '11.5px',
        background: active ? (small ? '#EDE4FF' : '#0d0d09') : '#FFFFFF',
        color: active ? (small ? '#5B21B6' : '#fffcf9') : '#1F2230',
        border: active ? (small ? '1px solid #D7C5FB' : '1px solid #0d0d09') : '1px solid #E7E8EE',
      }}
    >
      {children}
    </button>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  // Soft container to harmonize legacy manager cards with the new chrome.
  return <div className="space-y-0 [&_>_*]:!mb-0">{children}</div>
}

export function PlatformJobDefaults() {
  const [tab, setTab] = useState<TopTab>('stages')
  const [sub, setSub] = useState<SubTemplate>('offer-letters')

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2 mb-[14px] flex-wrap">
        <Pill active={tab === 'stages'} onClick={() => setTab('stages')}>Stages</Pill>
        <Pill active={tab === 'fields'} onClick={() => setTab('fields')}>Application fields</Pill>
        <Pill active={tab === 'templates'} onClick={() => setTab('templates')}>Templates</Pill>
        <Pill active={tab === 'automations'} onClick={() => setTab('automations')}>Automations</Pill>
      </div>

      {tab === 'stages' && (
        <Wrapper><PlatformJobStagesManager /></Wrapper>
      )}

      {tab === 'fields' && (
        <Wrapper><PlatformApplicationFieldsManager /></Wrapper>
      )}

      {tab === 'templates' && (
        <>
          <div className="flex items-center gap-1.5 mb-[14px] flex-wrap">
            {([
              ['offer-forms', 'Offer forms'],
              ['offer-letters', 'Offer letters'],
              ['email-templates', 'Email templates'],
              ['contracts', 'Contracts'],
              ['rejection-reasons', 'Rejection reasons'],
              ['rejection-templates', 'Rejection templates'],
              ['candidate-sources', 'Candidate sources'],
            ] as [SubTemplate, string][]).map(([k, label]) => (
              <Pill key={k} active={sub === k} onClick={() => setSub(k)} small>{label}</Pill>
            ))}
          </div>

          {sub === 'offer-letters' ? (
            <Wrapper><OfferTemplatesManager context="platform-defaults" /></Wrapper>
          ) : (
            <div className="bg-white border border-[#E7E8EE] rounded-[12px]" style={{ padding: '32px 18px' }}>
              <p className="font-inter text-center text-[#8B8F9E]" style={{ fontSize: '12px' }}>
                No default {sub.replace('-', ' ')} yet.
              </p>
            </div>
          )}
        </>
      )}

      {tab === 'automations' && (
        <Wrapper><AutomationsTab /></Wrapper>
      )}
    </div>
  )
}
