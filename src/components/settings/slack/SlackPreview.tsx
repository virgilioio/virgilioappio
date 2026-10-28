import { GioGlyph } from '@/components/icons/GioGlyph'
import { LINK_DETAILS, SLACK_DETAILS, PERSON_DETAILS, linkLabel, openLabel, slackTagsIn, type SlackDetail, type SlackEvent, type SlackTag } from '@/lib/slack'

/**
 * How the message will read in Slack, with example details (2026-10-27): Gio's
 * name and APP badge, the text with tags as Slack mentions and the candidate
 * and job as links, then the quiet "Gio ATS · job · Review the offer" line
 * (2026-10-28: the link reads as where it goes) and, under the card, where that
 * link opens. It follows the box as you type; nothing moves but the text.
 */
type Part = { kind: 'text'; text: string } | { kind: 'mention'; text: string } | { kind: 'link'; text: string }

function parts(message: string, picked: SlackTag[], details: SlackDetail[], event?: SlackEvent | null): Part[] {
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
      else if (LINK_DETAILS.has(key)) out.push({ kind: 'link', text: linkLabel(key, event) })
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
  people = false,
  event,
  dm = false,
}: {
  message: string
  picked: SlackTag[]
  details: SlackDetail[]
  /** A People message: about a team member, no job line. */
  people?: boolean
  event?: SlackEvent | null
  /** It only goes by DM to the person it's for (their own scorecard, their own profile). */
  dm?: boolean
}) {
  const body = parts(message, picked, details, event)
  const open = openLabel(event, dm)
  return (
    <div className="rounded-xl border border-[#E7E8EE] bg-white p-3.5" aria-label="Preview in Slack">
      <div className="flex gap-2.5">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-[#ECEBE6] bg-[#FFFCF9]">
          <GioGlyph size={20} />
        </span>
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
            Gio ATS{people ? null : <> · {SLACK_DETAILS.job.example} · {SLACK_DETAILS.client.example}</>}
            {open && <> · <span className="text-[#1264A3]">{open.label}</span></>}
          </p>
        </div>
      </div>
      <p className="mt-2.5 border-t border-[#F1F0EC] pt-2 font-inter text-[11.5px] text-text-tertiary">
        {open
          ? <>“{open.label}” opens {open.where}.</>
          : 'Posted in a channel, a welcome has no link: My profile is different for everyone who reads it.'}
      </p>
    </div>
  )
}
