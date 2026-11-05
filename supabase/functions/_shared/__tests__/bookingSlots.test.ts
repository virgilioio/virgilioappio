import { describe, expect, it } from 'vitest'
import { freeSlots, generatePotentialSlots, startInterval, type WeeklySchedule } from '../bookingSlots'

const day = (start: string, end: string): WeeklySchedule => ({
  thursday: { enabled: true, start, end },
})
// Thursday 5 Nov 2026, Mexico City (UTC-6, no daylight saving).
const from = new Date('2026-11-05T06:00:00Z')
const to = new Date('2026-11-05T23:00:00Z')
const tz = 'America/Mexico_City'
const local = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)

describe('booking start times', () => {
  it('reads only the grid steps it knows', () => {
    expect([15, 30, 60, '30'].map(startInterval)).toEqual([15, 30, 60, 30])
    expect([0, null, undefined, 45, 'x'].map(startInterval)).toEqual([null, null, null, null, null])
  })

  it('back to back keeps today\'s behaviour: one after another with the buffer between', () => {
    const slots = generatePotentialSlots(from, to, day('09:00', '12:00'), 45, 0, tz, null)
    expect(slots.map((s) => local(s.start))).toEqual(['09:00', '09:45', '10:30', '11:15'])
  })

  it('on the half hour: :00 and :30 only, and the meeting fits before the day ends', () => {
    const slots = generatePotentialSlots(from, to, day('09:00', '12:00'), 45, 15, tz, 30)
    expect(slots.map((s) => local(s.start))).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00'])
    expect(local(slots[slots.length - 1].end)).toBe('11:45')
  })

  it('a day that starts off the grid begins at the next grid time', () => {
    expect(generatePotentialSlots(from, to, day('09:10', '11:00'), 30, 0, tz, 30).map((s) => local(s.start)))
      .toEqual(['09:30', '10:00', '10:30'])
    expect(generatePotentialSlots(from, to, day('09:15', '12:00'), 60, 0, tz, 60).map((s) => local(s.start)))
      .toEqual(['10:00', '11:00'])
    expect(generatePotentialSlots(from, to, day('09:00', '10:00'), 30, 0, tz, 15).map((s) => local(s.start)))
      .toEqual(['09:00', '09:15', '09:30'])
  })

  it('on a grid the buffer keeps room around what\'s already there', () => {
    const slots = generatePotentialSlots(from, to, day('09:00', '12:00'), 30, 15, tz, 30)
    // A call from 9:30 to 10:00 local.
    const call = { start: new Date('2026-11-05T15:30:00Z'), end: new Date('2026-11-05T16:00:00Z') }
    expect(freeSlots(slots, [call], 15, true).map((s) => local(s.start))).toEqual(['10:30', '11:00', '11:30'])
    // Without a buffer only the clashing time goes.
    expect(freeSlots(slots, [call], 0, true).map((s) => local(s.start))).toEqual(['09:00', '10:00', '10:30', '11:00', '11:30'])
  })

  it('back to back ignores the buffer around existing events, as before', () => {
    const slots = generatePotentialSlots(from, to, day('09:00', '11:00'), 30, 0, tz, null)
    const call = { start: new Date('2026-11-05T15:30:00Z'), end: new Date('2026-11-05T16:00:00Z') }
    expect(freeSlots(slots, [call], 15, false).map((s) => local(s.start))).toEqual(['09:00', '10:00', '10:30'])
  })

  it('a day off offers nothing', () => {
    expect(generatePotentialSlots(from, to, { thursday: { enabled: false, start: '09:00', end: '17:00' } }, 30, 0, tz, 30)).toEqual([])
  })
})
