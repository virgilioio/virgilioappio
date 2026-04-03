import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, ChevronLeft, ChevronRight, Trash2, Sun, Moon, Sunrise, Sunset } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimezoneEntry {
  id: string
  timezone: string
  label: string
}

const POPULAR_TIMEZONES: { timezone: string; label: string; city: string }[] = [
  { timezone: 'America/New_York', label: 'New York', city: 'New York' },
  { timezone: 'America/Chicago', label: 'Chicago', city: 'Chicago' },
  { timezone: 'America/Denver', label: 'Denver', city: 'Denver' },
  { timezone: 'America/Los_Angeles', label: 'Los Angeles', city: 'Los Angeles' },
  { timezone: 'America/Anchorage', label: 'Anchorage', city: 'Anchorage' },
  { timezone: 'Pacific/Honolulu', label: 'Honolulu', city: 'Honolulu' },
  { timezone: 'America/Toronto', label: 'Toronto', city: 'Toronto' },
  { timezone: 'America/Mexico_City', label: 'Mexico City', city: 'Mexico City' },
  { timezone: 'America/Sao_Paulo', label: 'São Paulo', city: 'São Paulo' },
  { timezone: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires', city: 'Buenos Aires' },
  { timezone: 'America/Bogota', label: 'Bogotá', city: 'Bogotá' },
  { timezone: 'America/Lima', label: 'Lima', city: 'Lima' },
  { timezone: 'Europe/London', label: 'London', city: 'London' },
  { timezone: 'Europe/Paris', label: 'Paris', city: 'Paris' },
  { timezone: 'Europe/Berlin', label: 'Berlin', city: 'Berlin' },
  { timezone: 'Europe/Madrid', label: 'Madrid', city: 'Madrid' },
  { timezone: 'Europe/Rome', label: 'Rome', city: 'Rome' },
  { timezone: 'Europe/Amsterdam', label: 'Amsterdam', city: 'Amsterdam' },
  { timezone: 'Europe/Athens', label: 'Athens', city: 'Athens' },
  { timezone: 'Europe/Moscow', label: 'Moscow', city: 'Moscow' },
  { timezone: 'Europe/Istanbul', label: 'Istanbul', city: 'Istanbul' },
  { timezone: 'Asia/Dubai', label: 'Dubai', city: 'Dubai' },
  { timezone: 'Asia/Kolkata', label: 'Mumbai', city: 'Mumbai' },
  { timezone: 'Asia/Shanghai', label: 'Shanghai', city: 'Shanghai' },
  { timezone: 'Asia/Hong_Kong', label: 'Hong Kong', city: 'Hong Kong' },
  { timezone: 'Asia/Tokyo', label: 'Tokyo', city: 'Tokyo' },
  { timezone: 'Asia/Seoul', label: 'Seoul', city: 'Seoul' },
  { timezone: 'Asia/Singapore', label: 'Singapore', city: 'Singapore' },
  { timezone: 'Asia/Bangkok', label: 'Bangkok', city: 'Bangkok' },
  { timezone: 'Australia/Sydney', label: 'Sydney', city: 'Sydney' },
  { timezone: 'Australia/Melbourne', label: 'Melbourne', city: 'Melbourne' },
  { timezone: 'Pacific/Auckland', label: 'Auckland', city: 'Auckland' },
  { timezone: 'Africa/Cairo', label: 'Cairo', city: 'Cairo' },
  { timezone: 'Africa/Lagos', label: 'Lagos', city: 'Lagos' },
  { timezone: 'Africa/Johannesburg', label: 'Johannesburg', city: 'Johannesburg' },
]

const STORAGE_KEY = 'dashboard-world-clock'

function loadTimezones(): TimezoneEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone
  const match = POPULAR_TIMEZONES.find(t => t.timezone === local)
  return [{ id: crypto.randomUUID(), timezone: local, label: match?.label ?? local.split('/').pop()?.replace(/_/g, ' ') ?? 'Local' }]
}

function saveTimezones(zones: TimezoneEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(zones))
  } catch {}
}

function getUtcOffset(timezone: string): string {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
    const parts = formatter.formatToParts(now)
    const tzPart = parts.find(p => p.type === 'timeZoneName')
    return tzPart?.value?.replace('GMT', 'UTC') ?? ''
  } catch {
    return ''
  }
}

function getTimeOfDay(timezone: string): 'night' | 'dawn' | 'day' | 'dusk' {
  const now = new Date()
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now)
  )
  if (hour >= 6 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 18) return 'day'
  if (hour >= 18 && hour < 20) return 'dusk'
  return 'night'
}

function TimeOfDayIcon({ timezone, className }: { timezone: string; className?: string }) {
  const tod = getTimeOfDay(timezone)
  switch (tod) {
    case 'dawn': return <Sunrise className={cn('text-amber-500', className)} />
    case 'day': return <Sun className={cn('text-yellow-500', className)} />
    case 'dusk': return <Sunset className={cn('text-orange-500', className)} />
    case 'night': return <Moon className={cn('text-indigo-400', className)} />
  }
}

export function WorldClockWidget() {
  const [timezones, setTimezones] = useState<TimezoneEntry[]>(loadTimezones)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [now, setNow] = useState(new Date())
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    saveTimezones(timezones)
  }, [timezones])

  const safeIndex = Math.min(currentIndex, Math.max(0, timezones.length - 1))
  const current = timezones[safeIndex]

  const goNext = useCallback(() => {
    setCurrentIndex(i => (i + 1) % timezones.length)
  }, [timezones.length])

  const goPrev = useCallback(() => {
    setCurrentIndex(i => (i - 1 + timezones.length) % timezones.length)
  }, [timezones.length])

  const addTimezone = useCallback((tz: typeof POPULAR_TIMEZONES[0]) => {
    setTimezones(prev => {
      if (prev.some(t => t.timezone === tz.timezone)) return prev
      return [...prev, { id: crypto.randomUUID(), timezone: tz.timezone, label: tz.label }]
    })
    setAddOpen(false)
    setSearch('')
  }, [])

  const removeTimezone = useCallback((id: string) => {
    setTimezones(prev => {
      if (prev.length <= 1) return prev
      const next = prev.filter(t => t.id !== id)
      setCurrentIndex(i => Math.min(i, next.length - 1))
      return next
    })
  }, [])

  if (!current) return null

  const timeString = new Intl.DateTimeFormat('en-US', {
    timeZone: current.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)

  const utcOffset = getUtcOffset(current.timezone)

  const filteredTimezones = POPULAR_TIMEZONES.filter(tz =>
    !search || tz.city.toLowerCase().includes(search.toLowerCase()) ||
    tz.timezone.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <Card className="overflow-hidden bg-accent/40 border-accent/60">
        <CardContent className="p-4">
          {/* Top row: City name + UTC badge */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-poppins font-semibold text-foreground truncate">
              {current.label}
            </h3>
            <Badge variant="default" className="text-[10px] font-mono shrink-0 px-1.5 py-0">
              {utcOffset}
            </Badge>
          </div>

          {/* Time display - big and centered */}
          <div className="font-poppins text-5xl font-bold tracking-tight text-foreground tabular-nums leading-none text-center py-2">
            {timeString}
          </div>

          {/* Bottom row: dots (left) + nav arrows + "+" button (right) */}
          <div className="flex items-center justify-between mt-3">
            {/* Dot indicators */}
            <div className="flex items-center gap-1.5">
              {timezones.length > 1 && timezones.map((tz, i) => (
                <button
                  key={tz.id}
                  onClick={() => setCurrentIndex(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    i === safeIndex
                      ? 'w-4 bg-accent-foreground'
                      : 'w-1.5 bg-accent-foreground/30 hover:bg-accent-foreground/50'
                  )}
                />
              ))}
            </div>

            {/* Nav arrows + Add button */}
            <div className="flex items-center gap-0.5">
              {timezones.length > 1 && (
                <>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={goPrev}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={goNext}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add timezone dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Timezone</DialogTitle>
            <DialogDescription>Search for a city to add to your world clock.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Search cities..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-[280px] overflow-y-auto space-y-0.5 -mx-1 px-1">
            {filteredTimezones.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No cities found</p>
            ) : (
              filteredTimezones.map(tz => {
                const alreadyAdded = timezones.some(t => t.timezone === tz.timezone)
                return (
                  <button
                    key={tz.timezone}
                    disabled={alreadyAdded}
                    onClick={() => addTimezone(tz)}
                    className={cn(
                      'w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors',
                      alreadyAdded
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-accent cursor-pointer'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <TimeOfDayIcon timezone={tz.timezone} className="h-3.5 w-3.5" />
                      <div>
                        <p className="text-sm font-medium">{tz.city}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {getUtcOffset(tz.timezone)}
                        </p>
                      </div>
                    </div>
                    {alreadyAdded ? (
                      <span className="text-[10px] text-muted-foreground">Added</span>
                    ) : (
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                )
              })
            )}
          </div>

          {timezones.length > 1 && (
            <div className="border-t border-border pt-3 mt-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Your clocks</p>
              <div className="space-y-1">
                {timezones.map(tz => (
                  <div key={tz.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <TimeOfDayIcon timezone={tz.timezone} className="h-3 w-3" />
                      <span className="text-sm">{tz.label}</span>
                    </div>
                    {timezones.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeTimezone(tz.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
