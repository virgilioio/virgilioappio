import gioAvatar from '@/assets/gio-avatar.png'
import { SLACK_DETAILS, PERSON_DETAILS, slackTagsIn, type SlackDetail, type SlackTag } from '@/lib/slack'

/**
 * How the message will read in Slack, with example details (2026-10-27): Gio's
 * name and APP badge, the text with tags as Slack mentions and the candidate
 * and job as links, then the quiet "Gio ATS · job · Open in Gio" line. It
 * follows the box as you type; nothing moves but the text.
 */
type Part = { kind: 'text'; text: string } | { kind: 'mention'; text: string } | { kind: 'link'; text: string }

function parts(message: string, picked: SlackTag[], details: SlackDetail[]): Part[] {
  const tags = slackTagsIn(message, picked).map((t) => t.name)
  const tagSrc = tags.map((n) => `@${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).join('|')
  const re = new RegExp(`${tagSrc ? `(${tagSrc})(?![\\p{L}\\p{N}])|` : ''}\\{\\s*([a-z_]+)\\s*\\}`, 'gu')
  const out: Part[] = []
  let last = 0
  for (const m of message.matchAll(re)) {
    const at = m.index ?? 0
    if (at > last) out.push({ kind: 'text', text: message.slice(last, at) })
    const tag = tagSrc ? m[1] : undefined
    const key = (tagSrc ? m[2] : m[1]) as SlackDetail | undefined
    if (tag) out.push({ kind: 'mention', text: tag })
    else if (key && details.includes(key)) {
      const ex = SLACK_DETAILS[key].example
      if (PERSON_DETAILS.has(key)) out.push({ kind: 'mention', text: `@${ex}` })
      else if (key === 'candidate' || key === 'job') out.push({ kind: 'link', text: ex })
      else out.push({ kind: 'text', text: ex })
    } else out.push({ kind: 'text', text: m[0] })
    last = at + m[0].length
  }
  if (last < message.length) out.push({ kind: 'text', text: message.slice(last) })
  return out
}

export function SlackPreview({
  message,
  picked,
  details,
}: {
  message: string
  picked: SlackTag[]
  details: SlackDetail[]
}) {
  const body = parts(message, picked, details)
  return (
    <div className="rounded-xl border border-[#E7E8EE] bg-white p-3.5" aria-label="Preview in Slack">
      <div className="flex gap-2.5">
        <img src={gioAvatar} alt="" aria-hidden className="h-9 w-9 shrink-0 rounded-[8px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-inter text-[13.5px] font-bold text-[#1D1C1D]">Gio</span>
            <span className="rounded-[3px] bg-[#EEEEEE] px-1 py-px font-inter text-[10px] font-semibold uppercase text-[#616061]">App</span>
            <span className="font-inter text-[11.5px] text-[#616061]">9:41 AM</span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words font-inter text-[13.5px] leading-[1.46] text-[#1D1C1D]">
            {message.trim() ? (
              body.map((p, i) =>
                p.kind === 'mention' ? (
                  <span key={i} className="rounded-[3px] bg-[#E8F5FA] px-0.5 text-[#1264A3]">{p.text}</span>
                ) : p.kind === 'link' ? (
                  <span key={i} className="text-[#1264A3]">{p.text}</span>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )
            ) : (
              <span className="text-[#8B8F9E]">Your message shows here.</span>
            )}
          </p>
          <p className="mt-1 font-inter text-[11.5px] text-[#616061]">
            Gio ATS · {SLACK_DETAILS.job.example} · {SLACK_DETAILS.client.example} · <span className="text-[#1264A3]">Open in Gio</span>
          </p>
        </div>
      </div>
    </div>
  )
}
