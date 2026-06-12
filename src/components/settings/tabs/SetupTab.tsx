import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Mail, Calendar, Clock,
  Building2, Folder, Users, ClipboardCheck,
  Import, Handshake, Megaphone,
  Check, ZapOff, Info,
} from 'lucide-react'
import { useSetupProgress, type SetupChecks } from '@/hooks/useSetupProgress'

type Status = 'done' | 'progress' | 'todo' | 'optional'

interface Row {
  id: string
  icon: any
  title: string
  description: string
  estimate: string
  blocks?: string
  status: Status
  tab?: string // settings tab key
  href?: string // external app route
}

interface Tier {
  id: string
  title: string
  subtitle: string
  rows: Row[]
}

const CHIP: Record<Status, { bg: string; fg: string; label: string }> = {
  done:     { bg: '#D1FAE5', fg: '#0B7A57', label: 'Done' },
  progress: { bg: '#FEF3C7', fg: '#92400E', label: 'In progress' },
  todo:     { bg: '#F1F0EC', fg: '#5A6072', label: 'To do' },
  optional: { bg: '#F1F0EC', fg: '#5A6072', label: 'Optional' },
}

function buildTiers(c: SetupChecks, isAdminOrOwner: boolean): Tier[] {
  const youRows: Row[] = [
    {
      id: 'profile', icon: User, title: 'Profile',
      description: 'Photo, title and timezone — on every candidate email.',
      estimate: '1 min',
      status: c.profile ? 'done' : 'todo',
      tab: 'profile',
    },
    {
      id: 'mail', icon: Mail, title: 'Email connection',
      description: 'Reply to candidates as you. Send-only access.',
      estimate: '1 min', blocks: 'Replying to candidates',
      status: c.mail ? 'done' : 'todo',
      tab: 'email-calendar',
    },
    {
      id: 'calendar', icon: Calendar, title: 'Calendar connection',
      description: 'Busy blocks in, interviews written back.',
      estimate: '1 min', blocks: 'Scheduling & holds',
      status: c.calendar ? 'done' : 'todo',
      tab: 'email-calendar',
    },
    {
      id: 'booking', icon: Clock, title: 'Booking link & event types',
      description: 'Powers candidate self-scheduling.',
      estimate: '2 min', blocks: 'Self-scheduling',
      status: c.booking ? 'done' : 'todo',
      tab: 'booking',
    },
  ]

  const workspaceRows: Row[] = [
    {
      id: 'brand', icon: Building2, title: 'Company story & logo',
      description: c.brand
        ? 'Logo and story shown to every candidate.'
        : 'Your careers page is live but bare.',
      estimate: '5 min', blocks: 'Careers page quality',
      status: c.brand ? 'done' : 'todo',
      tab: 'organization',
    },
    {
      id: 'departments', icon: Folder, title: 'Departments',
      description: c.firstDepartment
        ? `${c.firstDepartment} is set up. Add as you open jobs.`
        : 'Group jobs by team so reporting and access work.',
      estimate: '2 min',
      status: c.departments ? 'done' : 'todo',
      tab: 'workspace-departments',
    },
    {
      id: 'team', icon: Users, title: 'Team & roles',
      description: `${c.invitesSent} invites sent, ${Math.max(c.invitesAccepted - 1, 0)} accepted.`,
      estimate: '2 min',
      status: c.team ? 'done' : c.teamPending ? 'progress' : 'todo',
      tab: 'members',
    },
    {
      id: 'templates', icon: ClipboardCheck, title: 'Scorecard & stage templates',
      description: 'Review the Gio defaults before your first interview.',
      estimate: '4 min', blocks: 'First interview',
      status: c.templates ? 'done' : 'todo',
      tab: 'templates',
    },
  ]

  const growRows: Row[] = [
    {
      id: 'import', icon: Import, title: 'Import candidates',
      description: 'CSV or migrate from another ATS.',
      estimate: '15 min', status: 'optional',
      href: '/candidates?import=1',
    },
    {
      id: 'crm', icon: Handshake, title: 'CRM: customers & deals',
      description: 'Track companies you hire for.',
      estimate: '10 min', status: 'optional',
      href: '/crm',
    },
    {
      id: 'job-boards', icon: Megaphone, title: 'Job board channels',
      description: 'Publish to LinkedIn and job boards.',
      estimate: '5 min', status: 'optional',
      tab: 'job-boards',
    },
  ]

  const tiers: Tier[] = [
    { id: 'you', title: 'You', subtitle: 'Personal — every teammate completes these.', rows: youRows },
  ]
  if (isAdminOrOwner) {
    tiers.push({
      id: 'workspace', title: 'Your workspace', subtitle: 'Org-level — admins only.', rows: workspaceRows,
    })
    tiers.push({
      id: 'grow', title: 'Grow', subtitle: 'None of this blocks hiring.', rows: growRows,
    })
  }
  return tiers
}

export function SetupTab() {
  const navigate = useNavigate()
  const { checks, isAdminOrOwner } = useSetupProgress()
  const tiers = useMemo(() => buildTiers(checks, isAdminOrOwner), [checks, isAdminOrOwner])

  const go = (row: Row) => {
    if (row.href) {
      navigate(row.href)
      return
    }
    if (row.tab) {
      navigate(`/settings?tab=${row.tab}`)
    }
  }

  return (
    <div>
      {tiers.map((tier) => (
        <section
          key={tier.id}
          className="bg-white rounded-[12px] overflow-hidden mb-[14px]"
          style={{ border: '1px solid #E7E8EE' }}
        >
          <header style={{ padding: '14px 18px', borderBottom: '1px solid #F1F0EC' }}>
            <h3
              className="font-poppins font-semibold text-[#0d0d09] m-0"
              style={{ fontSize: 13.5, letterSpacing: '-0.01em', lineHeight: 1.2 }}
            >
              {tier.title}
            </h3>
            <p
              className="font-inter text-[#8B8F9E] m-0"
              style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 3 }}
            >
              {tier.subtitle}
            </p>
          </header>

          <ul className="m-0 p-0 list-none">
            {tier.rows.map((row, idx) => {
              const Icon = row.icon
              const isDone = row.status === 'done'
              const chip = CHIP[row.status]
              const last = idx === tier.rows.length - 1
              return (
                <li
                  key={row.id}
                  className="flex items-center"
                  style={{
                    gap: 13,
                    padding: '12px 18px',
                    borderBottom: last ? 'none' : '1px solid #F1F0EC',
                    opacity: isDone ? 0.55 : 1,
                  }}
                >
                  {/* Icon tile */}
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 30, height: 30, borderRadius: 9,
                      backgroundColor: isDone ? '#EDE4FF' : '#F6F5F1',
                    }}
                  >
                    {isDone ? (
                      <Check size={14} color="#6F3FF5" strokeWidth={2} />
                    ) : (
                      <Icon size={14} color="#5A6072" strokeWidth={2} />
                    )}
                  </div>

                  {/* Main column */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                      <span
                        className="font-inter"
                        style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2230' }}
                      >
                        {row.title}
                      </span>
                      <span
                        className="inline-flex items-center font-inter"
                        style={{
                          fontSize: 10, fontWeight: 600,
                          padding: '2px 8px', borderRadius: 999,
                          backgroundColor: chip.bg, color: chip.fg,
                        }}
                      >
                        {chip.label}
                      </span>
                      {!isDone && row.blocks && (
                        <span
                          className="inline-flex items-center font-inter"
                          style={{ fontSize: 10, color: '#B45309', gap: 4 }}
                        >
                          <ZapOff size={10} strokeWidth={2} />
                          blocks: {row.blocks}
                        </span>
                      )}
                    </div>
                    <div
                      className="font-inter"
                      style={{ fontSize: 11, color: '#8B8F9E', marginTop: 2 }}
                    >
                      {row.description}
                    </div>
                  </div>

                  {/* Time */}
                  <div
                    className="shrink-0 font-inter"
                    style={{ fontSize: 10.5, color: '#B5B9C4' }}
                  >
                    {row.estimate}
                  </div>

                  {/* Action */}
                  {!isDone && (
                    <button
                      type="button"
                      onClick={() => go(row)}
                      className="shrink-0 inline-flex items-center justify-center font-inter"
                      style={{
                        height: 27, padding: '0 12px',
                        borderRadius: 8,
                        backgroundColor: '#0d0d09', color: '#fffcf9',
                        fontSize: 11, fontWeight: 600,
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      {row.status === 'progress' ? 'Continue' : 'Set up'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div
        className="flex items-start font-inter"
        style={{ gap: 6, padding: '4px 4px', fontSize: 11, color: '#8B8F9E' }}
      >
        <Info size={12} strokeWidth={2} className="shrink-0" style={{ marginTop: 1 }} />
        <span>
          Invited teammates only see the "You" tier. This page disappears from the rail once
          essentials are done — it stays reachable from General.
        </span>
      </div>
    </div>
  )
}
