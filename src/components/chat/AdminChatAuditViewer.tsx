import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ScrollText } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

interface AuditRow {
  id: string
  tenant_id: string
  thread_id: string | null
  actor_type: string | null
  actor_id: string | null
  event: string
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

const EVENT_TONES: Record<string, 'red' | 'yellow' | 'green' | 'blue' | 'neutral'> = {
  message_sent: 'blue',
  internal_note_added: 'neutral',
  chat_paused: 'yellow',
  chat_resumed: 'green',
  thread_assigned: 'blue',
  thread_closed: 'neutral',
  ai_handoff: 'yellow',
  ai_failure: 'red',
  ai_cap_reached: 'yellow',
}

/**
 * AdminChatAuditViewer — admin-only sheet listing chat_audit_log events.
 * RLS already restricts visibility to admins/workspace owners.
 */
export function AdminChatAuditViewer() {
  const { organizationId } = useAuth()
  const [open, setOpen] = useState(false)
  const [eventFilter, setEventFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery<AuditRow[]>({
    queryKey: ['chat', 'audit-log', organizationId, eventFilter],
    enabled: open && !!organizationId,
    queryFn: async () => {
      let q = supabase
        .from('chat_audit_log')
        .select('*')
        .eq('tenant_id', organizationId!)
        .order('created_at', { ascending: false })
        .limit(200)
      if (eventFilter !== 'all') q = q.eq('event', eventFilter)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as AuditRow[]
    },
  })

  const rows = (data ?? []).filter((r) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      r.event.toLowerCase().includes(s) ||
      r.thread_id?.toLowerCase().includes(s) ||
      r.actor_id?.toLowerCase().includes(s) ||
      JSON.stringify(r.metadata ?? {}).toLowerCase().includes(s)
    )
  })

  const uniqueEvents = Array.from(new Set((data ?? []).map((r) => r.event)))

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" icon={<ScrollText className="h-3.5 w-3.5" />}>
          Audit
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(640px,100vw)] sm:max-w-[640px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-virgilio-border">
          <SheetTitle>Chat audit log</SheetTitle>
          <SheetDescription>
            Privileged chat events for your workspace. Restricted to admins and workspace owners.
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 py-3 border-b border-virgilio-border flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search event, thread, actor, metadata…"
            className="h-8 text-[12.5px]"
          />
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="h-8 w-[160px] text-[12.5px]">
              <SelectValue placeholder="Event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {uniqueEvents.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading && (
            <div className="p-5 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
          {error && (
            <div className="p-5 text-[12.5px] text-red-600">
              {(error as Error).message}
            </div>
          )}
          {!isLoading && !error && rows.length === 0 && (
            <div className="p-10 text-center text-[12.5px] text-text-secondary">
              No audit events match the current filters.
            </div>
          )}
          {!isLoading && !error && rows.length > 0 && (
            <ul className="divide-y divide-virgilio-border">
              {rows.map((r) => (
                <li key={r.id} className="px-5 py-3 hover:bg-surface-secondary transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge tone={EVENT_TONES[r.event] ?? 'neutral'} size="xs">
                          {r.event}
                        </Badge>
                        <span className="text-[10.5px] text-text-secondary font-mono">
                          {r.actor_type ?? 'system'}
                          {r.actor_id ? `:${r.actor_id.slice(0, 8)}` : ''}
                        </span>
                      </div>
                      {r.thread_id && (
                        <div className="text-[10.5px] text-text-secondary font-mono truncate">
                          thread {r.thread_id.slice(0, 8)}…
                        </div>
                      )}
                      {r.metadata && Object.keys(r.metadata).length > 0 && (
                        <pre className="text-[10.5px] text-text-secondary bg-surface-secondary rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-all">
                          {JSON.stringify(r.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                    <time className="shrink-0 text-[10.5px] text-text-secondary font-mono">
                      {format(new Date(r.created_at), 'MMM d HH:mm:ss')}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
