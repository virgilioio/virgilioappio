/**
 * Calendar page — recruiter-facing weekly schedule.
 * Interviews, debriefs, holds and busy blocks across all jobs, coloured by the
 * interviewer hosting them, plus a "Needs scheduling" rail.
 * Events can be dragged to a new slot and acted on through their own menu.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarPlus,
  Briefcase,
  Users,
  Clock,
  CalendarClock,
  CalendarCheck,
  CheckCircle2,
  Check,
  FileText,
  Send,
  Link as LinkIcon,
  User,
  ExternalLink,
  Video,
  Ellipsis,
  RefreshCw,
  X,
} from 'lucide-react'
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  isToday,
  isSameDay,
  isSameMonth,
  isSameYear,
  isWeekend,
  parseISO,
  startOfDay,
  isWithinInterval,
  differenceInMinutes,
} from 'date-fns'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { SettingsGlyph } from '@/components/icons/SettingsGlyph'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { useScheduledBookings, type ScheduledBooking } from '@/hooks/useScheduledBookings'
import { useJobs } from '@/hooks/useJobs'
import { useNeedsSchedulingQueue, type NeedsSchedulingItem } from '@/hooks/useNeedsSchedulingQueue'
import { useWorkspaceCalendarMembers } from '@/hooks/useWorkspaceCalendarMembers'
import { useCalendarEventAction } from '@/hooks/useCalendarEventAction'
import { ScheduleInterviewSheet } from '@/components/candidates/ScheduleInterviewSheet'
import { SimpleScheduleInterviewSheet } from '@/components/candidates/SimpleScheduleInterviewSheet'
import { EventMenu, type EventMenuAction, type EventMenuItem } from '@/components/calendar/EventMenu'
import {
  CalendarActionDialog,
  type CalendarActionMode,
  type CalendarActionPayload,
} from '@/components/calendar/CalendarActionDialog'
import { CalendarToast, type CalendarToastState } from '@/components/calendar/CalendarToast'
import {
  BUSY_TONE,
  DEBRIEF_TONE,
  toneForHost,
  type CalendarTone,
} from '@/lib/calendar/colors'
import { cn } from '@/lib/utils'

// ─── Tokens ──────────────────────────────────────────────────
const C = {
  pageBg: '#F6F5F1',
  card: '#FFFFFF',
  border: '#E7E8EE',
  hairline: '#F1F0EC',
  ink: '#0d0d09',
  ink2: '#1F2230',
  muted: '#5A6072',
  tertiary: '#8B8F9E',
  disabled: '#B5B9C4',
  purple: '#6F3FF5',
  purpleLight: '#EDE4FF',
  purpleText: '#5B21B6',
  purpleTint: '#FBFAFF',
  dropTint: '#F3EEFF',
  amber: '#D97706',
  amberBg: '#FEF3C7',
  amberText: '#92400E',
  holdBorder: '#A5AAB8',
  busyBg: '#F1F0EC',
  busyBorder: '#D2D4DC',
  red: '#FA5252',
  redText: '#DC2626',
  redBg: '#FEE2E2',
  green: '#12B886',
} as const

// ─── Types ───────────────────────────────────────────────────
type EventType = 'interview' | 'debrief' | 'hold' | 'busy'
type ViewMode = 'day' | 'week' | 'month'
type TypeFilter = 'all' | EventType
/** 'mine' · 'all' · a specific member's user id */
type PeopleFilter = 'mine' | 'all' | string

interface CalEvent {
  id: string
  type: EventType
  title: string
  start: Date
  end: Date
  jobId: string | null
  jobTitle: string | null
  candidateId: string | null
  candidateName: string | null
  interviewerId: string | null
  interviewerName: string | null
  scheduledById: string | null
  raw: ScheduledBooking
}

// ─── Helpers ─────────────────────────────────────────────────
const HOUR_PX = 56
const DAY_START = 8
const DAY_END = 18
const GUTTER_PX = 52
const SNAP_MIN = 15
const DRAG_THRESHOLD = 5
const PEOPLE_KEY = 'gio.calendar.people'
const VIEW_KEY = 'gio.calendar.view'
const MONTH_GRID_COLUMNS = 'repeat(5, minmax(0,1fr)) repeat(2, minmax(0,0.55fr))'

function classifyEvent(b: ScheduledBooking): EventType {
  const source = (b.sync_source ?? '').toLowerCase()
  if (source === 'google' || source === 'outlook' || source === 'external') {
    if (!b.candidate_id && !b.job_id) return 'busy'
  }
  if ((b.isSimpleBooking || (!b.candidate_id && !b.job_id))) return 'busy'
  const stageName = (b.stage?.stage_name ?? '').toLowerCase()
  if (stageName.includes('debrief')) return 'debrief'
  if (b.status === 'tentative') return 'hold'
  return 'interview'
}

function eventTitle(b: ScheduledBooking, type: EventType): string {
  if (type === 'busy') return b.notes || 'Busy'
  const kind =
    type === 'debrief'
      ? 'Debrief'
      : type === 'hold'
      ? 'Hold'
      : b.stage?.stage_name || 'Interview'
  const who = b.candidate_name || b.candidate?.candidate_name || ''
  return who ? `${kind} · ${who}` : kind
}

const TYPE_LABEL: Record<EventType, string> = {
  interview: 'Interviews',
  debrief: 'Debriefs',
  hold: 'Holds',
  busy: 'Busy',
}

interface PlacedEvent {
  event: CalEvent
  lane: number
  lanes: number
}

/**
 * Side-by-side layout for a single day column. Overlapping meetings are grouped
 * into clusters and each member of a cluster gets its own lane, so nothing is
 * ever drawn on top of (and therefore hidden by) another meeting.
 */
function layoutDayEvents(dayEvents: CalEvent[]): PlacedEvent[] {
  const sorted = [...dayEvents].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime(),
  )

  const placed: PlacedEvent[] = []
  let cluster: PlacedEvent[] = []
  let clusterEnd = -Infinity

  const flush = () => {
    const lanes = cluster.reduce((max, p) => Math.max(max, p.lane + 1), 0)
    cluster.forEach(p => {
      p.lanes = lanes
      placed.push(p)
    })
    cluster = []
    clusterEnd = -Infinity
  }

  for (const event of sorted) {
    if (cluster.length > 0 && event.start.getTime() >= clusterEnd) flush()

    const laneEnds: number[] = []
    for (const p of cluster) {
      laneEnds[p.lane] = Math.max(laneEnds[p.lane] ?? -Infinity, p.event.end.getTime())
    }
    let lane = 0
    while (lane < laneEnds.length && (laneEnds[lane] ?? -Infinity) > event.start.getTime()) lane++

    cluster.push({ event, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, event.end.getTime())
  }
  if (cluster.length > 0) flush()

  return placed
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('')
}

function localDay(d: Date) {
  return startOfDay(d)
}

function dateKey(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function nextWeekday(d: Date) {
  const next = localDay(d)
  do {
    next.setDate(next.getDate() + 1)
  } while (isWeekend(next))
  return next
}

function previousWeekday(d: Date) {
  const prev = localDay(d)
  do {
    prev.setDate(prev.getDate() - 1)
  } while (isWeekend(prev))
  return prev
}

function firstBookableDayOfMonth(d: Date) {
  const first = startOfMonth(d)
  if (!isWeekend(first)) return first
  const next = localDay(first)
  while (isWeekend(next)) next.setDate(next.getDate() + 1)
  return next
}

function combineDateAndMinutes(day: Date, minutes: number) {
  const next = localDay(day)
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return next
}

function rangeContainsDate(start: Date, endExclusive: Date, day: Date) {
  const d = localDay(day).getTime()
  return d >= start.getTime() && d < endExclusive.getTime()
}

function weekRangeLabel(start: Date, end: Date) {
  if (isSameMonth(start, end)) return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
  if (isSameYear(start, end)) return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
}

interface DragState {
  kind: 'time' | 'month'
  eventId: string
  pointerId: number
  originX: number
  originY: number
  grabOffsetMin: number
  active: boolean
  dayIndex: number
  startMinutes: number
  targetDateKey?: string
  sourceDateKey?: string
  frozen?: boolean
}

// ─── Page ────────────────────────────────────────────────────
export default function CalendarPage() {
  const navigate = useNavigate()
  const { user, organizationId } = useAuth()
  const permissions = usePermissions()
  const [view, setViewState] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY)
      return saved === 'day' || saved === 'week' || saved === 'month' ? saved : 'week'
    } catch {
      return 'week'
    }
  })
  const [anchorDate, setAnchorDate] = useState<Date>(() => localDay(new Date()))

  const weekStart = useMemo(() => startOfWeek(anchorDate, { weekStartsOn: 1 }), [anchorDate])
  const weekEnd = useMemo(() => addDays(weekStart, 4), [weekStart])
  const timeColumns = useMemo(
    () => (view === 'day' ? [localDay(anchorDate)] : Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))),
    [anchorDate, view, weekStart],
  )
  const monthStart = useMemo(() => startOfMonth(anchorDate), [anchorDate])
  const monthEnd = useMemo(() => endOfMonth(anchorDate), [anchorDate])
  const monthGridStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 1 }), [monthStart])
  const monthGridEnd = useMemo(() => endOfWeek(monthEnd, { weekStartsOn: 1 }), [monthEnd])
  const monthDays = useMemo(() => {
    const total = Math.round((monthGridEnd.getTime() - monthGridStart.getTime()) / 86400000) + 1
    return Array.from({ length: total }, (_, i) => addDays(monthGridStart, i))
  }, [monthGridStart, monthGridEnd])
  const visibleStart = useMemo(
    () => (view === 'month' ? localDay(monthGridStart) : view === 'week' ? localDay(weekStart) : localDay(anchorDate)),
    [anchorDate, monthGridStart, view, weekStart],
  )
  const visibleEndExclusive = useMemo(
    () =>
      view === 'month'
        ? addDays(localDay(monthGridEnd), 1)
        : view === 'week'
        ? addDays(localDay(weekEnd), 1)
        : addDays(localDay(anchorDate), 1),
    [anchorDate, monthGridEnd, view, weekEnd],
  )

  const { bookings, isLoading } = useScheduledBookings(undefined, permissions, visibleStart, visibleEndExclusive)
  const { jobs } = useJobs()
  const { data: needsScheduling = [] } = useNeedsSchedulingQueue()
  const { members, colorIndexByUser, nameByUser } = useWorkspaceCalendarMembers()
  const { run: runAction, syncingEventId, isSubmitting } = useCalendarEventAction()

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [jobFilter, setJobFilter] = useState<string | 'all'>('all')
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>(() => {
    try {
      return (localStorage.getItem(PEOPLE_KEY) as PeopleFilter) || 'all'
    } catch {
      return 'all'
    }
  })
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<{ top: number; left: number; right: number } | null>(null)
  const [menu, setMenu] = useState<{
    eventId: string
    dayIndex: number
    eventTop: number
  } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dialog, setDialog] = useState<{
    eventId: string
    mode: CalendarActionMode
    newStart?: Date
    newEnd?: Date
  } | null>(null)
  const [toast, setToast] = useState<CalendarToastState | null>(null)
  const gridBodyRef = useRef<HTMLDivElement>(null)
  const calendarCardRef = useRef<HTMLDivElement>(null)
  const [openSimpleSheet, setOpenSimpleSheet] = useState(false)
  const [scheduleTarget, setScheduleTarget] = useState<NeedsSchedulingItem | null>(null)

  const showToast = useCallback((t: Omit<CalendarToastState, 'id'>) => {
    setToast({ ...t, id: Date.now() })
  }, [])

  const closePopover = () => {
    setSelectedEventId(null)
    setPopoverAnchor(null)
  }

  useEffect(() => {
    setSelectedEventId(null)
    setPopoverAnchor(null)
    setMenu(null)
  }, [anchorDate, view])

  const setView = useCallback((next: ViewMode) => {
    setViewState(next)
    setSelectedEventId(null)
    setPopoverAnchor(null)
    setMenu(null)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PEOPLE_KEY, peopleFilter)
    } catch {
      /* ignore */
    }
  }, [peopleFilter])

  // Build events
  const allEvents: CalEvent[] = useMemo(() => {
    return (bookings || []).map(b => {
      const type = classifyEvent(b)
      return {
        id: b.id,
        type,
        title: eventTitle(b, type),
        start: parseISO(b.scheduled_start),
        end: parseISO(b.scheduled_end),
        jobId: b.job_id,
        jobTitle: b.job?.title ?? null,
        candidateId: b.candidate_id,
        candidateName: b.candidate_name || b.candidate?.candidate_name || null,
        interviewerId: b.interviewer_id,
        interviewerName: b.interviewer_profile
          ? `${b.interviewer_profile.first_name ?? ''} ${b.interviewer_profile.last_name ?? ''}`.trim() ||
            b.interviewer_profile.email
          : null,
        scheduledById: (b as any).booked_by ?? null,
        raw: b,
      }
    })
  }, [bookings])

  // Apply filters
  const events = useMemo(() => {
    return allEvents.filter(e => {
      if (e.raw.status === 'cancelled') return false
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (jobFilter !== 'all' && e.jobId !== jobFilter) return false
      if (peopleFilter === 'all') return true
      const who = peopleFilter === 'mine' ? user?.id : peopleFilter
      if (!who) return true
      if (e.type === 'busy') return peopleFilter === 'mine' && e.interviewerId === user?.id
      return e.interviewerId === who
    })
  }, [allEvents, typeFilter, jobFilter, peopleFilter, user?.id])

  const visibleEvents = useMemo(
    () =>
      events.filter(e =>
        isWithinInterval(e.start, {
          start: visibleStart,
          end: visibleEndExclusive,
        }),
      ),
    [events, visibleStart, visibleEndExclusive],
  )

  const counts = useMemo(() => {
    const c = { interview: 0, debrief: 0, hold: 0, busy: 0 }
    visibleEvents.forEach(e => {
      c[e.type]++
    })
    return c
  }, [visibleEvents])

  // Non-busy event count per member across the visible range (for the People menu)
  const countsByHost = useMemo(() => {
    const map = new Map<string, number>()
    allEvents.forEach(e => {
      if (e.type === 'busy' || e.raw.status === 'cancelled') return
      if (
        !isWithinInterval(e.start, {
          start: visibleStart,
          end: visibleEndExclusive,
        })
      )
        return
      if (!e.interviewerId) return
      map.set(e.interviewerId, (map.get(e.interviewerId) ?? 0) + 1)
    })
    return map
  }, [allEvents, visibleStart, visibleEndExclusive])

  const tone = useCallback(
    (e: CalEvent): CalendarTone => {
      if (e.type === 'busy') return BUSY_TONE
      if (e.type === 'debrief') return DEBRIEF_TONE
      return toneForHost(e.interviewerId, user?.id, colorIndexByUser)
    },
    [colorIndexByUser, user?.id],
  )

  const visibleHosts = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; tone: CalendarTone }>()
    visibleEvents.forEach(e => {
      if (e.type === 'busy' || e.type === 'debrief' || !e.interviewerId) return
      if (seen.has(e.interviewerId)) return
      seen.set(e.interviewerId, {
        id: e.interviewerId,
        name:
          e.interviewerId === user?.id
            ? 'You'
            : nameByUser.get(e.interviewerId) || e.interviewerName || 'Teammate',
        tone: toneForHost(e.interviewerId, user?.id, colorIndexByUser),
      })
    })
    return [...seen.values()]
  }, [visibleEvents, user?.id, nameByUser, colorIndexByUser])

  const selectedEvent = useMemo(
    () => visibleEvents.find(e => e.id === selectedEventId) ?? null,
    [visibleEvents, selectedEventId],
  )
  const menuEvent = useMemo(
    () => (menu ? visibleEvents.find(e => e.id === menu.eventId) ?? null : null),
    [menu, visibleEvents],
  )
  const dialogEvent = useMemo(
    () => (dialog ? allEvents.find(e => e.id === dialog.eventId) ?? null : null),
    [dialog, allEvents],
  )
  const dragEvent = useMemo(
    () => (drag ? visibleEvents.find(e => e.id === drag.eventId) ?? null : null),
    [drag, visibleEvents],
  )

  const todayInColumns = timeColumns.find(d => isToday(d))
  const now = new Date()
  const minutesSinceDayStart = now.getHours() * 60 + now.getMinutes() - DAY_START * 60
  const nowLineTop = (minutesSinceDayStart / 60) * HOUR_PX

  // ─── Permissions per event ───
  const canActOn = useCallback(
    (e: CalEvent) =>
      e.type !== 'busy' &&
      (permissions.isAdmin || e.interviewerId === user?.id || e.scheduledById === user?.id),
    [permissions.isAdmin, user?.id],
  )

  const isPast = (e: CalEvent) => e.start.getTime() <= Date.now()

  const openMoveDialogForDrop = useCallback(
    (event: CalEvent, newStart: Date, durationMin: number, keepDragGhost = false) => {
      const newEnd = new Date(newStart.getTime() + durationMin * 60000)
      if (isWeekend(newStart)) {
        setDrag(null)
        showToast({ title: "Weekends aren't bookable", detail: 'Drop it on a weekday', tone: 'error' })
        return
      }
      if (newStart.getTime() < Date.now()) {
        setDrag(null)
        showToast({ title: "Can't move into the past", detail: 'Drop it on a later slot', tone: 'error' })
        return
      }
      if (newStart.getTime() === event.start.getTime()) {
        setDrag(null)
        return
      }
      if (keepDragGhost) setDrag(d => (d ? { ...d, active: true, frozen: true } : d))
      else setDrag(null)
      setDialog({ eventId: event.id, mode: 'move', newStart, newEnd })
    },
    [showToast],
  )

  // ─── Drag & drop ───
  const slotFromPointer = useCallback(
    (clientX: number, clientY: number, grabOffsetMin: number, durationMin: number) => {
      const rect = gridBodyRef.current?.getBoundingClientRect()
      if (!rect) return null
      const columnCount = Math.max(1, timeColumns.length)
      const colWidth = (rect.width - GUTTER_PX) / columnCount
      const rawCol = Math.floor((clientX - rect.left - GUTTER_PX) / colWidth)
      const dayIndex = view === 'day' ? 0 : Math.min(columnCount - 1, Math.max(0, rawCol))

      const minutesFromTop = ((clientY - rect.top) / HOUR_PX) * 60 - grabOffsetMin
      const snapped = Math.round(minutesFromTop / SNAP_MIN) * SNAP_MIN
      const maxStart = (DAY_END - DAY_START) * 60 - durationMin
      const clamped = Math.min(Math.max(0, snapped), Math.max(0, maxStart))
      return { dayIndex, startMinutes: clamped }
    },
    [timeColumns.length, view],
  )

  const onEventPointerDown = (e: CalEvent, ev: React.PointerEvent<HTMLButtonElement>) => {
    if (ev.button !== 0 || dialog) return
    const draggable = canActOn(e) && !isPast(e)
    const rect = ev.currentTarget.getBoundingClientRect()
    const grabOffsetMin = ((ev.clientY - rect.top) / HOUR_PX) * 60

    if (!draggable) {
      // still allow selection; refusal toasts fire on an actual drag attempt
      setDrag({
        kind: 'time',
        eventId: e.id,
        pointerId: ev.pointerId,
        originX: ev.clientX,
        originY: ev.clientY,
        grabOffsetMin,
        active: false,
        dayIndex: 0,
        startMinutes: 0,
      })
      return
    }

    setDrag({
      kind: 'time',
      eventId: e.id,
      pointerId: ev.pointerId,
      originX: ev.clientX,
      originY: ev.clientY,
      grabOffsetMin,
      active: false,
      dayIndex: timeColumns.findIndex(d => isSameDay(d, e.start)),
      startMinutes: e.start.getHours() * 60 + e.start.getMinutes() - DAY_START * 60,
    })
  }

  const onMonthEventPointerDown = (e: CalEvent, ev: React.PointerEvent<HTMLButtonElement>) => {
    if (ev.button !== 0 || dialog) return
    const draggable = canActOn(e) && !isPast(e)
    const startMinutes = e.start.getHours() * 60 + e.start.getMinutes()
    const base = {
      kind: 'month' as const,
      eventId: e.id,
      pointerId: ev.pointerId,
      originX: ev.clientX,
      originY: ev.clientY,
      grabOffsetMin: 0,
      active: false,
      dayIndex: 0,
      startMinutes,
      sourceDateKey: dateKey(e.start),
      targetDateKey: dateKey(e.start),
    }

    if (!draggable) {
      setDrag(base)
      return
    }
    setDrag(base)
  }

  useEffect(() => {
    if (!drag) return
    if (drag.frozen) return
    const current = visibleEvents.find(e => e.id === drag.eventId)
    if (!current) {
      setDrag(null)
      return
    }
    const durationMin = Math.max(15, differenceInMinutes(current.end, current.start))
    const draggable = canActOn(current) && !isPast(current)

    const onMove = (ev: PointerEvent) => {
      const moved =
        Math.abs(ev.clientX - drag.originX) > DRAG_THRESHOLD ||
        Math.abs(ev.clientY - drag.originY) > DRAG_THRESHOLD
      if (!moved) return
      if (!draggable) return
      if (drag.kind === 'month') {
        const target = document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest('[data-cal-day]') as HTMLElement | null
        const key = target?.dataset.calDay
        if (!key) return
        setDrag(d => (d ? { ...d, active: true, targetDateKey: key } : d))
        return
      }
      const slot = slotFromPointer(ev.clientX, ev.clientY, drag.grabOffsetMin, durationMin)
      if (!slot) return
      setDrag(d => (d ? { ...d, active: true, ...slot } : d))
    }

    const onUp = (ev: PointerEvent) => {
      const moved =
        Math.abs(ev.clientX - drag.originX) > DRAG_THRESHOLD ||
        Math.abs(ev.clientY - drag.originY) > DRAG_THRESHOLD

      if (!moved) {
        setDrag(null)
        return
      }

      if (!draggable) {
        setDrag(null)
        showToast(
          current.type === 'busy'
            ? { title: "External events can't be moved here", detail: 'Edit it in Google Calendar' }
            : { title: "Past events can't be moved", detail: 'Use Rebook… from the event menu' },
        )
        return
      }

      if (!drag.active) {
        setDrag(null)
        return
      }

      if (drag.kind === 'month') {
        if (!drag.targetDateKey || drag.targetDateKey === drag.sourceDateKey) {
          setDrag(null)
          return
        }
        const targetDay = dateFromKey(drag.targetDateKey)
        const newStart = combineDateAndMinutes(targetDay, drag.startMinutes)
        openMoveDialogForDrop(current, newStart, durationMin, true)
        return
      }

      const target = new Date(timeColumns[drag.dayIndex])
      target.setHours(DAY_START, 0, 0, 0)
      const newStart = new Date(target.getTime() + drag.startMinutes * 60000)
      openMoveDialogForDrop(current, newStart, durationMin)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [drag, visibleEvents, canActOn, slotFromPointer, timeColumns, openMoveDialogForDrop, showToast])

  // ─── Menus ───
  function menuItemsFor(e: CalEvent): { items: EventMenuItem[]; note?: string } {
    if (e.type === 'busy') {
      return {
        items: [{ action: 'open-google', label: 'Open in Google Calendar', Icon: ExternalLink }],
        note: 'External event — edit it in Google Calendar.',
      }
    }
    if (!canActOn(e)) {
      return {
        items: [{ action: 'view-candidate', label: 'View candidate', Icon: User }],
        note: `${e.interviewerName || 'Another teammate'} owns this event.`,
      }
    }
    if (isPast(e)) {
      return {
        items: [
          { action: 'rebook', label: 'Rebook…', Icon: CalendarClock },
          ...(e.candidateId
            ? [{ action: 'view-candidate' as const, label: 'View candidate', Icon: User }]
            : []),
        ],
      }
    }
    if (e.type === 'hold') {
      return {
        items: [
          { action: 'confirm', label: 'Confirm slot…', Icon: CalendarCheck },
          { action: 'resend', label: 'Resend slot options…', Icon: Send },
          { action: 'reschedule', label: 'Reschedule…', Icon: CalendarClock },
          { action: 'release', label: 'Release hold…', Icon: X, danger: true, separatorBefore: true },
        ],
      }
    }
    const link = (e.raw as any).google_meet_link || e.raw.meeting_location
    return {
      items: [
        { action: 'reschedule', label: 'Reschedule…', Icon: CalendarClock },
        { action: 'resend', label: 'Resend invite…', Icon: Send },
        ...(link && /^https?:\/\//.test(link)
          ? [{ action: 'copy-link' as const, label: 'Copy meeting link', Icon: LinkIcon }]
          : []),
        ...(e.type === 'interview' && e.candidateId
          ? [
              {
                action: 'view-candidate' as const,
                label: 'View candidate',
                Icon: User,
                separatorBefore: true,
              },
            ]
          : []),
        {
          action: 'cancel' as const,
          label: e.type === 'debrief' ? 'Cancel debrief…' : 'Cancel interview…',
          Icon: X,
          danger: true,
          separatorBefore: true,
        },
      ],
    }
  }

  const openCandidate = (e: CalEvent, newTab = false) => {
    if (!e.candidateId) return
    const path = e.jobId
      ? `/jobs/${e.jobId}/candidates/${e.candidateId}`
      : `/candidates/${e.candidateId}`
    if (newTab) window.open(path, '_blank', 'noopener')
    else navigate(path)
  }

  function handleMenuAction(e: CalEvent, action: EventMenuAction) {
    switch (action) {
      case 'reschedule':
        setDialog({ eventId: e.id, mode: 'reschedule' })
        break
      case 'rebook':
        setDialog({ eventId: e.id, mode: 'rebook' })
        break
      case 'resend':
        setDialog({ eventId: e.id, mode: 'resend' })
        break
      case 'confirm':
        setDialog({ eventId: e.id, mode: 'confirm' })
        break
      case 'cancel':
      case 'release':
        setDialog({ eventId: e.id, mode: 'cancel' })
        break
      case 'view-candidate':
        openCandidate(e)
        break
      case 'copy-link': {
        const link = (e.raw as any).google_meet_link || e.raw.meeting_location
        if (link) {
          navigator.clipboard?.writeText(link)
          showToast({ title: 'Meeting link copied' })
        }
        break
      }
      case 'open-google':
        window.open('https://calendar.google.com/', '_blank', 'noopener')
        showToast({ title: 'Opened Google Calendar' })
        break
      case 'open-notes':
        if (e.candidateId) openCandidate(e)
        break
    }
  }

  // ─── Confirm an action ───
  async function confirmDialog(payload: CalendarActionPayload) {
    if (!dialog || !dialogEvent) return
    const e = dialogEvent
    const mode = dialog.mode
    const serverAction =
      mode === 'move' || mode === 'reschedule' || mode === 'rebook'
        ? 'reschedule'
        : mode === 'confirm'
        ? 'confirm'
        : mode === 'resend'
        ? 'resend'
        : 'cancel'

    const originalStart = e.start
    const originalEnd = e.end

    const result = await runAction({
      event_id: e.id,
      action: serverAction,
      new_start: payload.newStart?.toISOString(),
      new_end: payload.newEnd?.toISOString(),
      notify_candidate: payload.notifyCandidate,
      notify_interviewers: payload.notifyInterviewers,
      message: payload.message,
      reason: payload.reason,
      requeue: payload.requeue,
    })

    setDialog(null)
    setDrag(null)
    closePopover()

    if (!result.ok) {
      showToast({
        title: "Couldn't update Google Calendar — change reverted",
        detail: result.error?.slice(0, 160),
        tone: 'error',
        onRetry: () => setDialog({ eventId: e.id, mode, newStart: payload.newStart, newEnd: payload.newEnd }),
      })
      return
    }

    const notifiedParts = [
      payload.notifyCandidate ? 'candidate' : null,
      payload.notifyInterviewers ? 'interviewers' : null,
    ].filter(Boolean)
    const notified =
      notifiedParts.length === 0
        ? 'No one notified · Google Calendar updated'
        : `Update sent to ${notifiedParts.join(' and ')} · Google Calendar updated`

    const undo =
      serverAction === 'resend'
        ? undefined
        : async () => {
            const back = await runAction({
              event_id: e.id,
              action: serverAction === 'cancel' ? 'confirm' : 'reschedule',
              new_start: serverAction === 'cancel' ? undefined : originalStart.toISOString(),
              new_end: serverAction === 'cancel' ? undefined : originalEnd.toISOString(),
              notify_candidate: payload.notifyCandidate,
              notify_interviewers: payload.notifyInterviewers,
            })
            showToast(
              back.ok
                ? {
                    title: 'Change undone',
                    detail: 'Original invite restored · Google Calendar reverted',
                  }
                : { title: "Couldn't undo the change", detail: back.error?.slice(0, 160), tone: 'error' },
            )
          }

    if (serverAction === 'reschedule' && payload.newStart && payload.newEnd) {
      showToast({
        title: `Moved to ${format(payload.newStart, 'EEE MMM d')} · ${format(
          payload.newStart,
          'HH:mm',
        )}–${format(payload.newEnd, 'HH:mm')}`,
        detail: notified,
        onUndo: undo,
      })
    } else if (serverAction === 'cancel') {
      showToast({
        title: e.type === 'hold' ? 'Hold released' : 'Interview cancelled',
        detail: notifiedParts.length
          ? `Cancellation sent to ${notifiedParts.join(' and ')} · Google Calendar updated`
          : 'No one notified · Google Calendar updated',
        onUndo: undo,
      })
    } else if (serverAction === 'confirm') {
      showToast({ title: 'Slot confirmed', detail: notified, onUndo: undo })
    } else {
      showToast({ title: 'Invite resent', detail: notified })
    }

    if (result.warning) {
      console.warn('[calendar] ', result.warning)
    }
  }

  /** Non-blocking overlap notice for the dialog. */
  const overlapNoticeFor = (e: CalEvent, start?: Date, end?: Date) => {
    if (!start || !end) return null
    const clash = events.find(
      other =>
        other.id !== e.id &&
        other.start < end &&
        other.end > start &&
        (other.interviewerId === e.interviewerId || other.interviewerId === user?.id),
    )
    if (!clash) return null
    return `Overlaps ${clash.title} (${format(clash.start, 'H:mm')}–${format(
      clash.end,
      'H:mm',
    )}). You can still move it.`
  }

  // ─── Render helpers ───
  function renderEvent(e: CalEvent, lane = 0, lanes = 1, dayIndex = 0, wide = false) {
    const startMin = e.start.getHours() * 60 + e.start.getMinutes()
    const endMin = e.end.getHours() * 60 + e.end.getMinutes()
    const top = ((startMin - DAY_START * 60) / 60) * HOUR_PX
    const height = Math.max(20, ((endMin - startMin) / 60) * HOUR_PX - 3)
    const t = tone(e)
    const laneWidthPct = 100 / lanes
    const leftPct = lane * laneWidthPct
    const short = height < 48 || lanes > 2
    const isHold = e.type === 'hold'
    const isDragging = drag?.active && drag.eventId === e.id
    const isSyncing = syncingEventId === e.id
    const menuOpen = menu?.eventId === e.id
    const selected = selectedEventId === e.id
    const hostName = e.interviewerId === user?.id ? 'You' : e.interviewerName || 'Teammate'
    const showWideExtras = wide && lanes === 1

    return (
      <button
        key={e.id}
        type="button"
        onPointerDown={ev => onEventPointerDown(e, ev)}
        onClick={ev => {
          if (drag?.active) return
          ev.stopPropagation()
          setMenu(null)
          if (selectedEventId === e.id) {
            closePopover()
            return
          }

          const gridRect = gridBodyRef.current?.getBoundingClientRect()
          const eventRect = ev.currentTarget.getBoundingClientRect()
          if (!gridRect) return

          setPopoverAnchor({
            top: eventRect.top - gridRect.top,
            left: eventRect.left - gridRect.left,
            right: eventRect.right - gridRect.left,
          })
          setSelectedEventId(e.id)
        }}
        title={`${e.title} · ${format(e.start, 'H:mm')}–${format(e.end, 'H:mm')}${
          e.jobTitle ? ` · ${e.jobTitle}` : ''
        }`}
        className="group absolute text-left overflow-hidden focus:outline-none"
        style={{
          top,
          height,
          left: `calc(${leftPct}% + 3px)`,
          width: `calc(${laneWidthPct}% - 6px)`,
          zIndex: menuOpen || selected ? 5 : 1 + lane,
          background: isHold ? '#FFFFFF' : t.bg,
          color: t.text,
          borderRadius: 7,
          padding: short ? '3px 22px 3px 8px' : '5px 22px 5px 8px',
          opacity: isDragging ? 0.35 : 1,
          touchAction: 'none',
          outline: menuOpen || selected ? `2px solid ${t.edge}` : undefined,
          outlineOffset: menuOpen || selected ? 1 : undefined,
          boxShadow: lanes > 1 ? '0 1px 3px -1px rgba(13,13,9,0.18)' : undefined,
          ...(isHold
            ? { border: `1.5px dashed ${t.edge}` }
            : { borderLeft: `3px solid ${t.edge}` }),
        }}
      >
        <div
          className="font-inter"
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitLineClamp: short ? 1 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            whiteSpace: short ? 'nowrap' : 'normal',
            textOverflow: 'ellipsis',
          }}
        >
          {e.title}
        </div>
        {!short && (
          <div
            className="font-inter flex items-center gap-1"
            style={{ fontSize: 9.5, opacity: 0.75, marginTop: 1, lineHeight: 1.2 }}
          >
            {isSyncing ? (
              <>
                <RefreshCw size={9} strokeWidth={2} className="animate-spin" /> Syncing to Google…
              </>
            ) : (
              <>
                {format(e.start, 'H:mm')}–{format(e.end, 'H:mm')}
                {e.jobTitle ? ` · ${e.jobTitle}` : ''}
                {showWideExtras && e.interviewerName ? ` · ${hostName}` : ''}
              </>
            )}
          </div>
        )}

        {showWideExtras && height >= 50 && e.interviewerName && (
          <div className="pointer-events-none absolute bottom-1.5 right-2 flex flex-row-reverse">
            <span
              className="grid place-items-center font-poppins"
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: t.edge,
                boxShadow: '0 0 0 2px #fff',
                color: '#fff',
                fontSize: 8.5,
                fontWeight: 600,
                marginLeft: -8,
              }}
            >
              {initials(hostName).slice(0, 2)}
            </span>
          </div>
        )}

        {/* Ellipsis menu trigger */}
        <span
          role="button"
          tabIndex={-1}
          aria-label="Event actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onPointerDown={ev => {
            ev.stopPropagation()
          }}
          onClick={ev => {
            ev.stopPropagation()
            setSelectedEventId(null)
            setPopoverAnchor(null)
            setMenu(prev =>
              prev?.eventId === e.id ? null : { eventId: e.id, dayIndex, eventTop: top },
            )
          }}
          className={cn(
            'absolute grid place-items-center transition-opacity duration-[120ms] [@media(hover:none)]:opacity-100',
            menuOpen || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
          style={{
            top: height < 34 ? 1 : 3,
            right: 3,
            width: 18,
            height: 18,
            borderRadius: 5,
            padding: 0,
            border: 'none',
            background: menuOpen ? 'rgba(13,13,9,0.12)' : 'rgba(255,255,255,0.7)',
            color: t.text,
          }}
        >
          <Ellipsis size={12} strokeWidth={2.5} />
        </span>
      </button>
    )
  }


  // ─── UI ───
  const weekRangeLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'd, yyyy')}`
  const peopleLabel =
    peopleFilter === 'all'
      ? 'All'
      : peopleFilter === 'mine'
      ? 'Mine'
      : nameByUser.get(peopleFilter) || 'Teammate'

  const headerRangeLabel =
    view === 'day'
      ? format(anchorDate, 'EEEE, MMM d, yyyy')
      : view === 'month'
      ? format(monthStart, 'MMMM yyyy')
      : weekRangeLabel(weekStart, weekEnd)

  const todayVisible = rangeContainsDate(visibleStart, visibleEndExclusive, new Date())

  const goToday = useCallback(() => {
    if (todayVisible) return
    setAnchorDate(localDay(new Date()))
    closePopover()
    setMenu(null)
  }, [todayVisible])

  const goPrevious = useCallback(() => {
    setAnchorDate(d => {
      if (view === 'day') return previousWeekday(d)
      if (view === 'month') return firstBookableDayOfMonth(subMonths(d, 1))
      return subWeeks(d, 1)
    })
    closePopover()
    setMenu(null)
  }, [view])

  const goNext = useCallback(() => {
    setAnchorDate(d => {
      if (view === 'day') return nextWeekday(d)
      if (view === 'month') return firstBookableDayOfMonth(addMonths(d, 1))
      return addWeeks(d, 1)
    })
    closePopover()
    setMenu(null)
  }, [view])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (dialog || ev.metaKey || ev.ctrlKey || ev.altKey || tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (ev.key.toLowerCase() === 'd') setView('day')
      if (ev.key.toLowerCase() === 'w') setView('week')
      if (ev.key.toLowerCase() === 'm') setView('month')
      if (ev.key.toLowerCase() === 't') goToday()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, goToday, setView])

  const dragGhost = (() => {
    if (!drag?.active || !dragEvent) return null
    const durationMin = Math.max(15, differenceInMinutes(dragEvent.end, dragEvent.start))
    const target = drag.kind === 'month' && drag.targetDateKey ? dateFromKey(drag.targetDateKey) : new Date(timeColumns[drag.dayIndex])
    const start = drag.kind === 'month'
      ? combineDateAndMinutes(target, drag.startMinutes)
      : new Date(combineDateAndMinutes(target, DAY_START * 60).getTime() + drag.startMinutes * 60000)
    const end = new Date(start.getTime() + durationMin * 60000)
    const past = start.getTime() < Date.now()
    const t = tone(dragEvent)
    return { start, end, past, tone: t, durationMin }
  })()

  return (
    <AuthGate>
      <PermissionGate permission="canViewJobs">
        <div className="relative min-h-[100dvh] w-full" style={{ background: C.pageBg }}>
          <div style={{ padding: '24px 28px' }} className="mx-auto max-w-[1500px]">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1
                  className="font-poppins text-[#0d0d09]"
                  style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.1 }}
                >
                  Calendar
                </h1>
                <div
                  className="mt-1.5 flex flex-wrap items-center font-inter"
                  style={{ fontSize: 12, color: C.tertiary, gap: 8 }}
                >
                  <span>{weekRangeLabel}</span>
                  <span>·</span>
                  <span>{counts.interview} interviews · {counts.debrief} debriefs · {counts.hold} holds</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 font-poppins text-[13px] font-medium text-[#0d0d09] hover:bg-[#FAFAF7]"
                  style={{ borderColor: C.border }}
                  onClick={() => navigate('/settings?tab=availability')}
                >
                  <SettingsGlyph size={16} color="#5A6072" accent="#5A6072" />
                  Availability
                </button>
                <button
                  type="button"
                  onClick={() => setOpenSimpleSheet(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 font-poppins text-[13px] font-medium text-white"
                  style={{ background: C.purple }}
                >
                  <CalendarPlus size={14} strokeWidth={2} />
                  Schedule interview
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div
              className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-white"
              style={{ border: `1px solid ${C.border}`, padding: 10 }}
            >
              {/* Day/Week/Month */}
              <div className="inline-flex h-7 rounded-lg p-0.5" style={{ background: C.hairline }}>
                {(['day', 'week', 'month'] as const).map(v => {
                  const active = view === v
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      className={cn('px-2.5 rounded-md font-inter capitalize transition-colors')}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        background: active ? C.ink : 'transparent',
                        color: active ? '#fffcf9' : C.tertiary,
                      }}
                    >
                      {v}
                    </button>
                  )
                })}
              </div>

              {/* Nav cluster */}
              <button
                type="button"
                onClick={() => setWeekAnchor(d => subWeeks(d, 1))}
                className="grid place-items-center rounded-lg border bg-white text-[#5A6072] hover:bg-[#FAFAF7]"
                style={{ width: 28, height: 28, borderColor: C.border }}
                aria-label="Previous"
              >
                <ChevronLeft size={14} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor(new Date())}
                className="h-7 rounded-lg border bg-white px-3 font-inter text-[12px] font-medium text-[#0d0d09] hover:bg-[#FAFAF7]"
                style={{ borderColor: C.border }}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor(d => addWeeks(d, 1))}
                className="grid place-items-center rounded-lg border bg-white text-[#5A6072] hover:bg-[#FAFAF7]"
                style={{ width: 28, height: 28, borderColor: C.border }}
                aria-label="Next"
              >
                <ChevronRight size={14} strokeWidth={2} />
              </button>

              <div style={{ width: 1, height: 20, background: C.border, margin: '0 4px' }} />

              {/* Type pills — the fill colour now means the person, so these
                  swatches describe the shape of the event, not its colour. */}
              {(['all', 'interview', 'debrief', 'hold', 'busy'] as const).map(t => {
                const active = typeFilter === t
                const label = t === 'all' ? 'All' : TYPE_LABEL[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 font-inter"
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      background: active ? C.ink : 'white',
                      color: active ? '#fffcf9' : C.muted,
                      border: active ? 'none' : `1px solid ${C.border}`,
                    }}
                  >
                    {t !== 'all' && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          display: 'inline-block',
                          ...(t === 'interview'
                            ? { border: `1.5px solid ${C.purple}`, background: C.purpleLight }
                            : t === 'hold'
                            ? { border: `1.5px dashed ${C.holdBorder}` }
                            : t === 'debrief'
                            ? { background: DEBRIEF_TONE.edge }
                            : { background: C.busyBorder }),
                        }}
                      />
                    )}
                    {label}
                  </button>
                )
              })}

              <div className="ml-auto flex items-center gap-2">
                <select
                  value={jobFilter}
                  onChange={e => setJobFilter(e.target.value as any)}
                  className="h-7 rounded-lg bg-transparent px-2 font-inter text-[12px] text-[#5A6072] hover:bg-[#FAFAF7]"
                  aria-label="Filter by job"
                >
                  <option value="all">Job · All</option>
                  {jobs?.map(j => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>

                {/* People filter */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPeopleOpen(o => !o)}
                    className="inline-flex h-7 items-center gap-1 rounded-lg px-2 font-inter text-[12px] text-[#5A6072] hover:bg-[#FAFAF7]"
                    aria-haspopup="menu"
                    aria-expanded={peopleOpen}
                  >
                    People · {peopleLabel}
                    <ChevronDown size={13} strokeWidth={2} />
                  </button>
                  {peopleOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setPeopleOpen(false)} />
                      <div
                        role="menu"
                        className="absolute right-0 z-50 mt-1 bg-white"
                        style={{
                          width: 220,
                          borderRadius: 10,
                          border: `1px solid ${C.border}`,
                          boxShadow: '0 12px 32px -8px rgba(13,13,9,0.18)',
                          padding: 4,
                          maxHeight: 320,
                          overflowY: 'auto',
                        }}
                      >
                        {(
                          [
                            { key: 'mine', label: 'Mine' },
                            { key: 'all', label: 'All people' },
                          ] as const
                        ).map(opt => (
                          <button
                            key={opt.key}
                            type="button"
                            role="menuitemradio"
                            aria-checked={peopleFilter === opt.key}
                            onClick={() => {
                              setPeopleFilter(opt.key)
                              setPeopleOpen(false)
                            }}
                            className="flex w-full items-center rounded-md px-2.5 font-inter hover:bg-[#F1F0EC]"
                            style={{
                              height: 30,
                              fontSize: 12.5,
                              color: C.ink2,
                              background: peopleFilter === opt.key ? '#EDE4FF' : 'transparent',
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                        <div style={{ height: 1, background: C.hairline, margin: '4px 6px' }} />
                        {members.map(m => {
                          const t = toneForHost(m.userId, user?.id, colorIndexByUser)
                          const isMe = m.userId === user?.id
                          return (
                            <button
                              key={m.userId}
                              type="button"
                              role="menuitemradio"
                              aria-checked={peopleFilter === m.userId}
                              onClick={() => {
                                setPeopleFilter(m.userId)
                                setPeopleOpen(false)
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 font-inter hover:bg-[#F1F0EC]"
                              style={{
                                height: 30,
                                fontSize: 12.5,
                                color: C.ink2,
                                background: peopleFilter === m.userId ? '#EDE4FF' : 'transparent',
                              }}
                            >
                              <span
                                style={{ width: 8, height: 8, borderRadius: 3, background: t.edge }}
                              />
                              <span className="truncate">
                                {m.name}
                                {isMe ? ' (you)' : ''}
                              </span>
                              <span className="ml-auto" style={{ fontSize: 11, color: C.tertiary }}>
                                {countsByHost.get(m.userId) ?? 0}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Legend */}
            {view === 'week' && visibleHosts.length >= 2 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-inter" style={{ fontSize: 11, color: C.tertiary }}>
                  Colour = interviewer
                </span>
                {visibleHosts.map(h => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() =>
                      setPeopleFilter(prev => (prev === h.id ? 'all' : h.id))
                    }
                    className="inline-flex items-center gap-1.5 font-inter"
                    style={{
                      background: h.tone.bg,
                      color: h.tone.text,
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 9px',
                      outline: peopleFilter === h.id ? `1.5px solid ${h.tone.edge}` : 'none',
                    }}
                  >
                    <span
                      style={{ width: 8, height: 8, borderRadius: 3, background: h.tone.edge }}
                    />
                    {h.name}
                  </button>
                ))}
                <span className="ml-auto font-inter" style={{ fontSize: 11, color: C.disabled }}>
                  Drag an event to reschedule
                </span>
              </div>
            )}

            {/* Two-column layout */}
            <div
              className="mt-3.5 grid"
              style={{ gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 14 }}
            >
              {/* Calendar card */}
              <div
                className="relative rounded-xl bg-white overflow-hidden"
                style={{ border: `1px solid ${C.border}` }}
              >
                {view !== 'week' ? (
                  <div className="grid place-items-center font-inter text-[12px]" style={{ color: C.tertiary, height: 420 }}>
                    {view === 'day' ? 'Day view' : 'Month view'} coming soon — switch to Week.
                  </div>
                ) : (
                  <>
                    {/* Day header row */}
                    <div
                      className="grid"
                      style={{ gridTemplateColumns: `${GUTTER_PX}px repeat(5, 1fr)`, borderBottom: `1px solid ${C.border}` }}
                    >
                      <div />
                      {days.map((d, i) => {
                        const today = isToday(d)
                        const isDropDay = drag?.active && drag.dayIndex === i
                        return (
                          <div
                            key={i}
                            className="flex flex-col items-center justify-center py-2"
                            style={{
                              borderLeft: `1px solid ${C.hairline}`,
                              background: isDropDay ? C.dropTint : today ? C.purpleTint : 'transparent',
                            }}
                          >
                            <div
                              className="font-inter"
                              style={{ fontSize: 11, fontWeight: 600, color: today ? C.purple : C.muted }}
                            >
                              {format(d, 'EEE')}
                            </div>
                            <div
                              className="font-inter"
                              style={{ fontSize: 11, color: today ? C.purple : C.disabled }}
                            >
                              {format(d, 'MMM d')}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Grid body */}
                    <div
                      ref={gridBodyRef}
                      className="relative grid"
                      style={{
                        gridTemplateColumns: `${GUTTER_PX}px repeat(5, 1fr)`,
                        height: (DAY_END - DAY_START) * HOUR_PX,
                      }}
                    >
                      {/* Hour gutter */}
                      <div className="relative">
                        {Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => {
                          const hour = DAY_START + i
                          if (i === 0) return null
                          return (
                            <div
                              key={i}
                              className="absolute right-1.5 -translate-y-1/2 font-inter"
                              style={{ top: i * HOUR_PX, fontSize: 9.5, color: C.disabled }}
                            >
                              {hour}:00
                            </div>
                          )
                        })}
                      </div>
                      {/* Day columns */}
                      {days.map((d, di) => {
                        const today = isToday(d)
                        const isDropDay = drag?.active && drag.dayIndex === di
                        const dayEvents = layoutDayEvents(
                          weekEvents.filter(e => isSameDay(e.start, d)),
                        )
                        // Faint hatch over time that has already passed
                        const dayStart = new Date(d)
                        dayStart.setHours(DAY_START, 0, 0, 0)
                        const pastMin = Math.min(
                          Math.max(0, (Date.now() - dayStart.getTime()) / 60000),
                          (DAY_END - DAY_START) * 60,
                        )
                        return (
                          <div
                            key={di}
                            className="relative"
                            style={{
                              borderLeft: `1px solid ${C.hairline}`,
                              background: isDropDay ? C.purpleTint : today ? C.purpleTint : 'transparent',
                            }}
                          >
                            {/* Past hatch */}
                            {drag?.active && pastMin > 0 && (
                              <div
                                className="pointer-events-none absolute left-0 right-0 top-0"
                                style={{
                                  height: (pastMin / 60) * HOUR_PX,
                                  backgroundImage:
                                    'repeating-linear-gradient(45deg, rgba(13,13,9,0.05) 0 2px, transparent 2px 6px)',
                                }}
                              />
                            )}
                            {/* Hour lines */}
                            {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                              <div
                                key={i}
                                className="absolute left-0 right-0"
                                style={{ top: (i + 1) * HOUR_PX, borderBottom: `1px solid ${C.pageBg}` }}
                              />
                            ))}
                            {/* Now line */}
                            {today && todayInWeek && nowLineTop >= 0 && nowLineTop <= (DAY_END - DAY_START) * HOUR_PX && (
                              <div
                                className="pointer-events-none absolute left-0 right-0"
                                style={{ top: nowLineTop, height: 2, background: C.red, zIndex: 5 }}
                              >
                                <div
                                  className="absolute -left-1 -top-[3px] rounded-full"
                                  style={{ width: 8, height: 8, background: C.red }}
                                />
                              </div>
                            )}
                            {/* Events */}
                            {dayEvents.map(p => renderEvent(p.event, p.lane, p.lanes, di))}

                            {/* Event menu — lives in the day column so it scrolls with the grid */}
                            {menu && menuEvent && menu.dayIndex === di && (
                              <EventMenu
                                placement={
                                  menu.eventTop > (DAY_END - DAY_START) * HOUR_PX - 230
                                    ? { bottom: (DAY_END - DAY_START) * HOUR_PX - menu.eventTop + 4 }
                                    : { top: menu.eventTop + 24 }
                                }
                                items={menuItemsFor(menuEvent).items}
                                note={menuItemsFor(menuEvent).note}
                                onSelect={action => handleMenuAction(menuEvent, action)}
                                onClose={() => setMenu(null)}
                              />
                            )}

                            {/* Drag ghost */}
                            {dragGhost && drag?.dayIndex === di && (
                              <div
                                className="pointer-events-none absolute"
                                style={{
                                  top: (drag.startMinutes / 60) * HOUR_PX,
                                  height: Math.max(20, (dragGhost.durationMin / 60) * HOUR_PX - 3),
                                  left: 3,
                                  right: 3,
                                  zIndex: 20,
                                  borderRadius: 7,
                                  border: `1.5px dashed ${dragGhost.past ? C.red : dragGhost.tone.edge}`,
                                  background: dragGhost.past ? '#FFF1F1' : dragGhost.tone.bg,
                                  color: dragGhost.past ? '#B02020' : dragGhost.tone.text,
                                  boxShadow: '0 8px 20px -8px rgba(13,13,9,0.28)',
                                  padding: '4px 7px',
                                }}
                              >
                                <div className="font-inter" style={{ fontSize: 10.5, fontWeight: 700 }}>
                                  {format(dragGhost.start, 'HH:mm')}–{format(dragGhost.end, 'HH:mm')}
                                  {dragGhost.past ? ' · in the past' : ''}
                                </div>
                                <div
                                  className="font-inter truncate"
                                  style={{ fontSize: 9.5, opacity: 0.8 }}
                                >
                                  {dragEvent?.title}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Event detail popover — anchored beside the selected event */}
                      {selectedEvent && popoverAnchor && (
                        <EventPopover
                          event={selectedEvent}
                          anchor={popoverAnchor}
                          containerWidth={gridBodyRef.current?.clientWidth ?? 0}
                          containerHeight={gridBodyRef.current?.clientHeight ?? 0}
                          tone={tone(selectedEvent)}
                          isMine={selectedEvent.interviewerId === user?.id}
                          scheduledByMe={selectedEvent.scheduledById === user?.id}
                          onClose={closePopover}
                          onJoin={() => {
                            const loc =
                              (selectedEvent.raw as any).google_meet_link || selectedEvent.raw.meeting_location
                            if (loc && /^https?:\/\//.test(loc)) {
                              window.open(loc, '_blank', 'noopener')
                              showToast({ title: 'Opening the meeting' })
                            }
                          }}
                          onReschedule={() => {
                            closePopover()
                            setDialog({ eventId: selectedEvent.id, mode: 'reschedule' })
                          }}
                          onConfirmSlot={() => {
                            closePopover()
                            setDialog({ eventId: selectedEvent.id, mode: 'confirm' })
                          }}
                          onRelease={() => {
                            closePopover()
                            setDialog({ eventId: selectedEvent.id, mode: 'cancel' })
                          }}
                          onOpenNotes={() => {
                            closePopover()
                            handleMenuAction(selectedEvent, 'open-notes')
                          }}
                          canAct={canActOn(selectedEvent)}
                        />
                      )}
                    </div>
                  </>
                )}

                <CalendarToast toast={toast} onDismiss={() => setToast(null)} />
              </div>

              {/* Right rail */}
              <RailNeedsScheduling
                items={needsScheduling}
                onSchedule={item => setScheduleTarget(item)}
                onCandidateClick={(candidateId, jobId) => navigate(`/jobs/${jobId}/candidates/${candidateId}`)}
              />
            </div>
          </div>

          {/* Action dialog */}
          {dialog && dialogEvent && (
            <CalendarActionDialog
              open
              mode={dialog.mode}
              eventTitle={dialogEvent.title}
              jobTitle={dialogEvent.jobTitle}
              start={dialogEvent.start}
              end={dialogEvent.end}
              proposedStart={dialog.newStart}
              proposedEnd={dialog.newEnd}
              isHold={dialogEvent.type === 'hold'}
              isDebrief={dialogEvent.type === 'debrief'}
              candidate={
                dialogEvent.candidateName
                  ? {
                      name: dialogEvent.candidateName,
                      email: dialogEvent.raw.candidate_email ?? null,
                    }
                  : null
              }
              interviewers={
                dialogEvent.interviewerName
                  ? [
                      {
                        name: dialogEvent.interviewerName,
                        email: dialogEvent.raw.interviewer_profile?.email ?? null,
                      },
                    ]
                  : []
              }
              overlapNotice={overlapNoticeFor(dialogEvent, dialog.newStart, dialog.newEnd)}
              weekDays={days}
              submitting={isSubmitting}
              onCancel={() => {
                setDialog(null)
                setDrag(null)
              }}
              onConfirm={confirmDialog}
            />
          )}

          {/* Sheets */}
          {organizationId && user && (
            <SimpleScheduleInterviewSheet
              open={openSimpleSheet}
              onOpenChange={setOpenSimpleSheet}
              candidateId=""
              candidateName=""
              candidateEmail=""
              organizationId={organizationId}
            />
          )}
          {scheduleTarget && (
            <ScheduleInterviewSheet
              open={!!scheduleTarget}
              onOpenChange={(o) => !o && setScheduleTarget(null)}
              candidateId={scheduleTarget.candidateId}
              candidateName={scheduleTarget.candidateName}
              candidateEmail={scheduleTarget.candidateEmail}
              candidatePhone={scheduleTarget.candidatePhone ?? undefined}
              jobId={scheduleTarget.jobId}
              jobTitle={scheduleTarget.jobTitle}
              organizationId={scheduleTarget.organizationId || organizationId || ''}
              jhsId={scheduleTarget.jhsId}
              stageName={scheduleTarget.stageName}
              associationId={scheduleTarget.associationId}
            />
          )}
        </div>
      </PermissionGate>
    </AuthGate>
  )
}

// ─── Event detail popover ────────────────────────────────────
/** Anchored beside the clicked event. Opens on click, never on hover. */
function EventPopover({
  event,
  anchor,
  containerWidth,
  containerHeight,
  tone,
  isMine,
  scheduledByMe,
  canAct,
  onClose,
  onJoin,
  onReschedule,
  onConfirmSlot,
  onRelease,
  onOpenNotes,
}: {
  event: CalEvent
  anchor: { top: number; left: number; right: number }
  containerWidth: number
  containerHeight: number
  tone: CalendarTone
  isMine: boolean
  scheduledByMe: boolean
  canAct: boolean
  onClose: () => void
  onJoin: () => void
  onReschedule: () => void
  onConfirmSlot: () => void
  onRelease: () => void
  onOpenNotes: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardHeight, setCardHeight] = useState(260)

  useLayoutEffect(() => {
    const nextHeight = cardRef.current?.offsetHeight
    if (nextHeight && nextHeight !== cardHeight) setCardHeight(nextHeight)
  }, [cardHeight, event.id])

  useEffect(() => {
    const onPointerDown = (ev: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(ev.target as Node)) onClose()
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const candidatePath =
    event.candidateId && event.jobId
      ? `/jobs/${event.jobId}/candidates/${event.candidateId}`
      : event.candidateId
      ? `/candidates/${event.candidateId}`
      : null

  const typeLabel = TYPE_LABEL[event.type].replace(/s$/, '')
  const kind = event.candidateName && event.title.includes(' · ') ? event.title.split(' · ')[0] : null
  const link = (event.raw as any).google_meet_link || event.raw.meeting_location
  const hasLink = !!link && /^https?:\/\//.test(link)
  const notEnded = event.end.getTime() > Date.now()
  const cardWidth = 290
  const edgeGap = 8
  const roomOnRight = anchor.right + edgeGap + cardWidth <= containerWidth - edgeGap
  const preferredLeft = roomOnRight
    ? anchor.right + edgeGap
    : anchor.left - cardWidth - edgeGap
  const left = Math.max(edgeGap, Math.min(preferredLeft, containerWidth - cardWidth - edgeGap))
  const top = Math.max(edgeGap, Math.min(anchor.top, containerHeight - cardHeight - edgeGap))

  const ownerLine = (() => {
    if (event.type === 'busy' || isMine) return null
    const who = event.interviewerName || 'a teammate'
    return scheduledByMe
      ? `Scheduled by you for ${who}`
      : `${who}'s ${typeLabel.toLowerCase()}`
  })()

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: 11.5,
    color: '#5A6072',
  }

  const btnBase: React.CSSProperties = {
    height: 28,
    padding: '0 10px',
    borderRadius: 8,
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 500,
    fontSize: 12,
    letterSpacing: '-0.005em',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  }
  const primaryBtn: React.CSSProperties = {
    ...btnBase,
    background: '#0d0d09',
    color: '#fffcf9',
    border: '1px solid transparent',
    boxShadow: '0 1px 2px rgba(13,13,9,0.08)',
  }
  const secondaryBtn: React.CSSProperties = {
    ...btnBase,
    background: '#fff',
    color: '#1F2230',
    border: '1px solid #E0DDD3',
  }

  return (
    <div
      ref={cardRef}
      onPointerDown={ev => ev.stopPropagation()}
      onClick={ev => ev.stopPropagation()}
      style={{
        position: 'absolute',
        top,
        left,
        width: cardWidth,
        background: '#fff',
        border: '1px solid #E7E8EE',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 16px 40px -12px rgba(13,13,9,0.25)',
        zIndex: 30,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid #F1F0EC',
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
        }}
      >
        <span
          style={{ width: 8, height: 8, borderRadius: 3, background: tone.edge, marginTop: 4, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: 12.5,
              color: '#1F2230',
              lineHeight: 1.4,
            }}
          >
            {event.candidateName && candidatePath ? (
              <>
                {kind ? `${kind} · ` : ''}
                <Link
                  to={candidatePath}
                  title={`Open ${event.candidateName}'s profile for ${event.jobTitle || 'this job'}`}
                  style={{
                    color: '#5B21B6',
                    textDecoration: 'underline',
                    textDecorationColor: '#D7C5FB',
                    textUnderlineOffset: 2,
                  }}
                  onMouseEnter={ev => {
                    ev.currentTarget.style.color = '#6F3FF5'
                    ev.currentTarget.style.textDecorationColor = 'currentColor'
                  }}
                  onMouseLeave={ev => {
                    ev.currentTarget.style.color = '#5B21B6'
                    ev.currentTarget.style.textDecorationColor = '#D7C5FB'
                  }}
                >
                  {event.candidateName}
                </Link>
              </>
            ) : (
              event.title
            )}
          </div>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: 11,
              color: '#8B8F9E',
              marginTop: 2,
            }}
          >
            {format(event.start, 'EEE MMM d')} · {format(event.start, 'H:mm')}–
            {format(event.end, 'H:mm')} · {typeLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', lineHeight: 0 }}
        >
          <X size={13} strokeWidth={2.25} color="#8B8F9E" />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ownerLine && (
          <div style={rowStyle}>
            <span style={{ width: 12, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: tone.edge }} />
            </span>
            {ownerLine}
          </div>
        )}
        {event.jobTitle && (
          <div style={rowStyle}>
            <Briefcase size={12} strokeWidth={2} color="#8B8F9E" style={{ flexShrink: 0 }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {event.jobTitle}
            </span>
          </div>
        )}
        {event.interviewerName && (
          <div style={rowStyle}>
            <Users size={12} strokeWidth={2} color="#8B8F9E" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {event.interviewerName}
            </span>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: tone.edge,
                boxShadow: '0 0 0 2px #fff',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: 10,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {event.interviewerName.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        {event.type === 'hold' && (
          <div
            style={{
              ...rowStyle,
              alignItems: 'flex-start',
              background: '#FEF3C7',
              color: '#92400E',
              borderRadius: 7,
              padding: '6px 9px',
            }}
          >
            <Clock size={12} strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }} />
            Tentative slot — awaiting candidate pick.
          </div>
        )}

        {/* Actions */}
        {event.type === 'busy' ? (
          <div
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 11, color: '#8B8F9E' }}
          >
            Synced from Google Calendar
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            {event.type === 'interview' && hasLink && (
              <>
                <button type="button" onClick={onJoin} style={primaryBtn}>
                  <Video size={14} strokeWidth={2} /> Join
                </button>
                {canAct && notEnded && (
                  <button type="button" onClick={onReschedule} style={secondaryBtn}>
                    <CalendarClock size={14} strokeWidth={2} /> Reschedule
                  </button>
                )}
              </>
            )}
            {event.type === 'interview' && !hasLink && canAct && notEnded && (
              <button type="button" onClick={onReschedule} style={secondaryBtn}>
                <CalendarClock size={14} strokeWidth={2} /> Reschedule
              </button>
            )}
            {event.type === 'hold' && canAct && (
              <>
                <button type="button" onClick={onConfirmSlot} style={primaryBtn}>
                  <Check size={14} strokeWidth={2} /> Confirm slot
                </button>
                <button type="button" onClick={onRelease} style={secondaryBtn}>
                  <X size={14} strokeWidth={2} /> Release
                </button>
              </>
            )}
            {event.type === 'debrief' && (
              <button type="button" onClick={onOpenNotes} style={secondaryBtn}>
                <FileText size={14} strokeWidth={2} /> Open notes
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


// ─── Right rail ──────────────────────────────────────────────
function RailNeedsScheduling({
  items,
  onSchedule,
  onCandidateClick,
}: {
  items: NeedsSchedulingItem[]
  onSchedule: (item: NeedsSchedulingItem) => void
  onCandidateClick: (candidateId: string, jobId: string) => void
}) {
  return (
    <div
      className="rounded-xl bg-white flex flex-col"
      style={{
        border: `1px solid ${C.border}`,
        maxHeight: 'calc(100dvh - 220px)',
        position: 'sticky',
        top: 16,
      }}
    >
      <div className="px-3.5 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CalendarClock size={14} strokeWidth={2} color={C.ink2} />
          <span className="font-poppins" style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
            Needs scheduling
          </span>
          <span
            className="ml-auto inline-flex items-center font-inter"
            style={{
              background: C.hairline,
              color: C.tertiary,
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 999,
              padding: '1px 8px',
            }}
          >
            {items.length}
          </span>
        </div>
        <div className="mt-1 font-inter" style={{ fontSize: 11, color: C.tertiary }}>
          Candidates in an interview stage with nothing on the calendar.
        </div>
      </div>

      <div className="px-3 pb-3 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <CheckCircle2 size={20} color={C.green} strokeWidth={2} />
            <div className="font-inter" style={{ fontSize: 12, color: C.muted }}>
              Everyone's scheduled.
            </div>
          </div>
        ) : (
          items.map(item => {
            const urgent = item.waitDays > 7
            const justNow = item.waitDays === 0
            return (
              <div
                key={item.associationId}
                className="bg-white"
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '9px 11px',
                }}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="grid place-items-center flex-shrink-0 font-poppins font-semibold text-white"
                    style={{ width: 22, height: 22, borderRadius: 999, background: C.purple, fontSize: 9.5 }}
                  >
                    {initials(item.candidateName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onCandidateClick(item.candidateId, item.jobId)}
                      className="font-inter truncate cursor-pointer hover:underline text-left"
                      style={{ fontSize: 11.5, fontWeight: 600, color: C.ink, background: 'none', border: 'none', padding: 0 }}
                    >
                      {item.candidateName}
                    </button>
                    <div className="font-inter truncate" style={{ fontSize: 10, color: C.tertiary }}>
                      {item.jobTitle}
                    </div>
                  </div>
                  <span
                    className="font-inter flex-shrink-0"
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      borderRadius: 999,
                      padding: '2px 7px',
                      background: urgent ? C.redBg : C.hairline,
                      color: urgent ? C.redText : C.muted,
                    }}
                  >
                    {justNow ? 'just now' : `${item.waitDays}d`}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="font-inter flex-1 min-w-0 truncate"
                    style={{ fontSize: 10, color: C.tertiary }}
                  >
                    {item.stageName}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSchedule(item)}
                    className="font-inter flex-shrink-0"
                    style={{
                      height: 24,
                      borderRadius: 7,
                      background: C.purpleLight,
                      color: C.purpleText,
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '0 10px',
                    }}
                  >
                    Schedule
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
