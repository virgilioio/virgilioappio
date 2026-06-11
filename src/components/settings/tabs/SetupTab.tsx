import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Mail, Calendar, Image as ImageIcon, Folder, Users, ClipboardList,
  Globe, GitBranch, Sparkles, ArrowRight, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsCard } from '@/components/settings/shared/SettingsCard'
import { StatusChip, type StatusTone } from '@/components/settings/shared/StatusChip'
import { useMailIdentities } from '@/hooks/useMailIdentities'
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities'
import { useDepartments } from '@/hooks/useDepartments'
import { useMembers } from '@/hooks/useMembers'
import { useTenant } from '@/hooks/useTenant'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

interface SetupItem {
  id: string
  icon: any
  title: string
  blurb: string
  estimate: string
  done: boolean
  tabKey: string
}

interface SetupGroup {
  id: string
  label: string
  description: string
  items: SetupItem[]
}

export function SetupTab() {
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const { identities: mail = [] } = useMailIdentities()
  const { identities: calendars = [] } = useCalendarIdentities()
  const { data: departments = [] } = useDepartments()
  const { data: members = [] } = useMembers()

  const { data: scorecardCount = 0 } = useQuery({
    queryKey: ['setup', 'scorecard-templates-count', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from('scorecard_templates')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id)
      return count ?? 0
    },
  })

  const hasLogo = !!(tenant as any)?.logo_url
  const hasMail = mail.length > 0
  const hasCalendar = calendars.length > 0
  const hasDepartments = departments.length > 0
  const hasTeammates = members.length > 1
  const hasScorecards = scorecardCount > 0

  const groups: SetupGroup[] = useMemo(
    () => [
      {
        id: 'you',
        label: 'You',
        description: 'Get your personal account ready to send and schedule.',
        items: [
          {
            id: 'mail', icon: Mail, title: 'Connect your email',
            blurb: 'Send candidate emails from your own address.',
            estimate: '2 min', done: hasMail, tabKey: 'email-calendar',
          },
          {
            id: 'calendar', icon: Calendar, title: 'Connect your calendar',
            blurb: 'Two-way sync so interviews never collide.',
            estimate: '1 min', done: hasCalendar, tabKey: 'email-calendar',
          },
        ],
      },
      {
        id: 'workspace',
        label: 'Your workspace',
        description: 'The essentials your team needs to start hiring together.',
        items: [
          {
            id: 'brand', icon: ImageIcon, title: 'Add your company logo',
            blurb: 'Shown on careers page, offers and emails.',
            estimate: '1 min', done: hasLogo, tabKey: 'organization',
          },
          {
            id: 'departments', icon: Folder, title: 'Create departments',
            blurb: 'Group jobs by team so reporting and access work.',
            estimate: '2 min', done: hasDepartments, tabKey: 'workspace-departments',
          },
          {
            id: 'members', icon: Users, title: 'Invite your team',
            blurb: 'Recruiters, hiring managers and interviewers.',
            estimate: '3 min', done: hasTeammates, tabKey: 'members',
          },
        ],
      },
      {
        id: 'grow',
        label: 'Grow',
        description: 'Tune the pipeline and broadcast your jobs.',
        items: [
          {
            id: 'pipeline', icon: GitBranch, title: 'Review your pipeline stages',
            blurb: 'Match your real interview flow.',
            estimate: '3 min', done: false, tabKey: 'pipeline-stages',
          },
          {
            id: 'scorecards', icon: ClipboardList, title: 'Create a scorecard template',
            blurb: 'So interviewers rate consistently.',
            estimate: '5 min', done: hasScorecards, tabKey: 'templates',
          },
          {
            id: 'careers', icon: Globe, title: 'Publish your careers page',
            blurb: 'A public page candidates can apply from.',
            estimate: '4 min', done: false, tabKey: 'careers-page',
          },
        ],
      },
    ],
    [hasMail, hasCalendar, hasLogo, hasDepartments, hasTeammates, hasScorecards],
  )

  const allItems = groups.flatMap((g) => g.items)
  const doneCount = allItems.filter((i) => i.done).length

  const goto = (tab: string) => {
    const sp = new URLSearchParams({ tab })
    navigate(`/settings?${sp.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div
        className="rounded-xl p-5 border"
        style={{
          borderColor: '#E7DCFF',
          background: 'linear-gradient(135deg, #F7F2FF 0%, #FAFAF7 100%)',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#EDE4FF' }}
          >
            <Sparkles className="w-4 h-4" style={{ color: '#5B21B6' }} />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="font-poppins font-semibold text-[#0d0d09]"
              style={{ fontSize: '15px', letterSpacing: '-0.01em' }}
            >
              Set up Gio in about 15 minutes
            </h3>
            <p className="font-inter text-[12.5px] text-[#5A6072] mt-1 leading-relaxed">
              Eight essentials, grouped by what they unlock. You can do them in any order — we'll track progress as you go.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: '#E7DCFF' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(doneCount / allItems.length) * 100}%`,
                    backgroundColor: '#6F3FF5',
                  }}
                />
              </div>
              <span className="font-poppins font-semibold text-[12px] text-[#0d0d09] tabular-nums">
                {doneCount}/{allItems.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {groups.map((g) => (
        <SettingsCard key={g.id} title={g.label} description={g.description}>
          <ul className="divide-y divide-[#EFEFEA] -mx-5">
            {g.items.map((item) => {
              const Icon = item.icon
              const tone: StatusTone = item.done ? 'done' : 'todo'
              return (
                <li
                  key={item.id}
                  className={cn(
                    'flex items-center gap-4 px-5 py-3.5 transition-opacity',
                    item.done && 'opacity-60',
                  )}
                >
                  <div
                    className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: item.done ? '#E5F4EC' : '#F1F0EC' }}
                  >
                    {item.done ? (
                      <Check className="w-4 h-4" style={{ color: '#0E7A4D' }} />
                    ) : (
                      <Icon className="w-4 h-4 text-[#1F2230]" strokeWidth={1.75} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-poppins font-medium text-[13px] text-[#0d0d09]">
                        {item.title}
                      </span>
                      <StatusChip tone={tone} />
                    </div>
                    <div className="font-inter text-[11.5px] text-[#5A6072] mt-0.5">
                      {item.blurb} <span className="text-[#B5B9C4]">·</span> {item.estimate}
                    </div>
                  </div>
                  <Button
                    variant={item.done ? 'secondary' : 'primary'}
                    size="sm"
                    iconRight={ArrowRight}
                    onClick={() => goto(item.tabKey)}
                  >
                    {item.done ? 'Review' : 'Set up'}
                  </Button>
                </li>
              )
            })}
          </ul>
        </SettingsCard>
      ))}

      <p className="font-inter text-[11.5px] text-[#8B8F9E] px-1">
        Nothing here is one-way. You can change every setting later from its own page in this sidebar.
      </p>
    </div>
  )
}
