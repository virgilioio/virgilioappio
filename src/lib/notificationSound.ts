/**
 * The notification sound (Allan, 2026-10-18): "Pebble, low, tighter" from the
 * sound lab. Two warm wooden taps stepping up for a mention; a short run of
 * four for an offer that needs your approval. Made live with the Web Audio
 * API (no audio files): each tap is a sine that settles onto its note with a
 * quiet click on top, in a small room.
 *
 * Browsers only allow sound after the person has interacted with the page,
 * so the audio is unlocked on the first click or key press. Only one tab
 * plays a given moment (a Web Lock where the browser has them, a timestamp in
 * localStorage otherwise), and a burst of notifications plays once.
 */

export type NotificationSoundKind = 'mention' | 'approval'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let room: ConvolverNode | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.42
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.ratio.value = 3
  master.connect(comp).connect(ctx.destination)
  // A small room: a generated impulse, mixed in low.
  room = ctx.createConvolver()
  const len = Math.floor(ctx.sampleRate * 1.4)
  const ir = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2)
  }
  room.buffer = ir
  const wet = ctx.createGain()
  wet.gain.value = 0.22
  room.connect(wet).connect(master)
  return ctx
}

const hz = (note: number) => 440 * Math.pow(2, (note - 69) / 12)

function tone(
  c: AudioContext,
  t: number,
  freq: number,
  { gain, decay, glide = 0, reverb = 0.6 }: { gain: number; decay: number; glide?: number; reverb?: number },
) {
  if (!master || !room) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(freq * (glide ? Math.pow(2, glide / 12) : 1), t)
  if (glide) o.frequency.exponentialRampToValueAtTime(freq, t + 0.06)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.004 + decay)
  o.connect(g)
  g.connect(master)
  if (reverb) {
    const send = c.createGain()
    send.gain.value = reverb
    g.connect(send).connect(room)
  }
  o.start(t)
  o.stop(t + decay + 0.06)
}

/** One wooden tap: the note, settling from just above, and a short click. */
function tap(c: AudioContext, t: number, note: number, gain: number, decay: number) {
  tone(c, t, hz(note), { gain, decay, glide: 0.6, reverb: 0.6 })
  tone(c, t, hz(note) * 4, { gain: gain * 0.18, decay: 0.05, reverb: 0.2 })
}

function render(c: AudioContext, kind: NotificationSoundKind) {
  const t = c.currentTime + 0.03
  if (kind === 'mention') {
    tap(c, t, 67, 0.36, 0.26)
    tap(c, t + 0.07, 72, 0.34, 0.28)
  } else {
    ;[60, 64, 67, 72].forEach((n, i) => tap(c, t + i * 0.075, n, i === 3 ? 0.28 : 0.34, i === 3 ? 0.34 : 0.24))
  }
}

/** Resume the audio on the first interaction; browsers refuse sound before one. */
export function installSoundUnlock() {
  if (typeof window === 'undefined') return () => {}
  const unlock = () => {
    const c = audio()
    if (c && c.state === 'suspended') void c.resume()
  }
  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock)
  return () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
}

const QUIET_GAP_MS = 3000
const LAST_KEY = 'gio.sound.last'

/** Whether this tab may play now: one tab, and at most one sound every few seconds. */
async function claim(): Promise<boolean> {
  const fresh = () => {
    try {
      const last = Number(window.localStorage.getItem(LAST_KEY) || 0)
      if (Date.now() - last < QUIET_GAP_MS) return false
      window.localStorage.setItem(LAST_KEY, String(Date.now()))
    } catch {
      /* storage unavailable: this tab decides alone */
    }
    return true
  }
  const locks = (navigator as Navigator & { locks?: LockManager }).locks
  if (!locks) return fresh()
  return locks.request('gio-notification-sound', { ifAvailable: true }, async (lock) => {
    if (!lock) return false
    return fresh()
  })
}

/** Play the sound for a notification (respecting the one-tab and few-seconds rules). */
export async function playNotificationSound(kind: NotificationSoundKind) {
  const c = audio()
  if (!c) return
  if (c.state === 'suspended') {
    try {
      await c.resume()
    } catch {
      return
    }
    // Still locked: the person hasn't interacted with the page yet.
    if ((c.state as AudioContextState) !== 'running') return
  }
  if (!(await claim())) return
  render(c, kind)
}

/** Play it now, for the preview button in the settings: no tab or timing rules. */
export async function previewNotificationSound(kind: NotificationSoundKind) {
  const c = audio()
  if (!c) return
  if (c.state === 'suspended') await c.resume().catch(() => undefined)
  render(c, kind)
}

/** Whether `now` falls inside quiet hours (start and end as "HH:MM" in `tz`; may cross midnight). */
export function inQuietHours(start: string | null, end: string | null, tz: string, now = new Date()): boolean {
  if (!start || !end) return false
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const cur = h * 60 + m
  const toMin = (s: string) => {
    const [hh, mm] = s.split(':').map(Number)
    return (hh || 0) * 60 + (mm || 0)
  }
  const a = toMin(start)
  const b = toMin(end)
  if (a === b) return false
  return a < b ? cur >= a && cur < b : cur >= a || cur < b
}
