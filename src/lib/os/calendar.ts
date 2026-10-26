import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/integrations/supabase/client'

/**
 * Birthdays, work anniversaries and holidays (People & Access dashboard,
 * 2026-10-24). Everything is counted on the server: os_people_dashboard for
 * admins, os_team_calendar for every member (birthdays as day and month only,
 * holidays where you live plus the workspace's own). Public holidays come from
 * Nager.Date (os_holidays_sync, hourly); admins add the workspace's own days
 * off here, archived with Undo, never erased. Days are Mexico City days.
 */

export interface CalendarPerson {
  user_id: string
  member_id?: string
  name: string
  avatar_url: string | null
  /** The next day it falls on (YYYY-MM-DD), never the birth year. */
  date: string
  mine?: boolean
}

export interface Anniversary extends CalendarPerson {
  years: number
}

export interface Holiday {
  id: string
  date: string
  name: string
  local_name: string | null
  country_code: string
  /** The workspace's own day off (admins added it). */
  own: boolean
  people: number
  names: string[]
}

export interface TeamCalendar {
  today: string
  country_code: string | null
  birthdays: CalendarPerson[]
  holidays: Holiday[]
}

export interface MissingRow {
  user_id: string
  member_id: string
  name: string
  avatar_url: string | null
  missing: ('country' | 'tax_id' | 'bank' | 'birthday')[]
}

export interface LoadRow {
  user_id: string
  member_id: string
  name: string
  avatar_url: string | null
  open_jobs: number
  max_open_jobs: number
  load: 'near' | 'over'
}

export interface PlacePerson {
  user_id: string
  member_id: string
  name: string
  avatar_url: string | null
}

export interface PeoplePlace {
  country_code: string
  city: string | null
  region: string | null
  lat: number | null
  lng: number | null
  people: PlacePerson[]
}

export interface PeopleDashboard {
  today: string
  active: number
  invited: number
  complete: number
  near_capacity: number
  over_capacity: number
  birthdays: (CalendarPerson & { member_id: string })[]
  anniversaries: (Anniversary & { member_id: string })[]
  holidays: Holiday[]
  by_country: { country_code: string | null; people: number }[]
  /** Where people live, city by city; lat/lng are null when the city isn't listed or isn't set. */
  places?: PeoplePlace[]
  missing: MissingRow[]
  load: LoadRow[]
}

const dashKey = (tenantId?: string) => ['os-people-dashboard', tenantId] as const
const calKey = (tenantId?: string) => ['os-team-calendar', tenantId] as const

export function usePeopleDashboard(tenantId: string | undefined) {
  return useQuery({
    queryKey: dashKey(tenantId),
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<PeopleDashboard> => {
      const { data, error } = await supabase.rpc('os_people_dashboard', { _tenant_id: tenantId! })
      if (error) throw error
      return data as unknown as PeopleDashboard
    },
  })
}

export function useTeamCalendar(tenantId: string | undefined) {
  return useQuery({
    queryKey: calKey(tenantId),
    enabled: !!tenantId,
    queryFn: async (): Promise<TeamCalendar> => {
      const { data, error } = await supabase.rpc('os_team_calendar', { _tenant_id: tenantId! })
      if (error) throw error
      return data as unknown as TeamCalendar
    },
  })
}

function useRefresh(tenantId: string | undefined) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: dashKey(tenantId) })
    void qc.invalidateQueries({ queryKey: calKey(tenantId) })
  }
}

/** A workspace day off. Everyone in the workspace sees it; the country says where it's observed. */
export function useAddDayOff(tenantId: string | undefined) {
  const refresh = useRefresh(tenantId)
  return useMutation({
    mutationFn: async ({ name, day, country }: { name: string; day: string; country: string }) => {
      const { data, error } = await supabase
        .from('os_holidays')
        .insert({ tenant_id: tenantId!, country_code: country, day, name: name.trim(), source: 'manual' })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: refresh,
  })
}

export function useArchiveDayOff(tenantId: string | undefined) {
  const refresh = useRefresh(tenantId)
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('os_holidays')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

/** A calendar day as a local date (no time zone shift). */
export const dayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "Today", "Tomorrow", or "Tue, Oct 28", counted from the server's today. */
export function whenLabel(iso: string, today: string) {
  const diff = Math.round((dayOf(iso).getTime() - dayOf(today).getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return dayOf(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** How many days away, for "in 5 days". */
export const daysAway = (iso: string, today: string) =>
  Math.round((dayOf(iso).getTime() - dayOf(today).getTime()) / 86_400_000)
