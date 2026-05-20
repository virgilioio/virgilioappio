import React from 'react'

/**
 * Wrap matched substring in a soft yellow highlight.
 * Per Gio Foundation: #FFF4B8 wash, never bold, never purple.
 */
export function highlight(text: string | null | undefined, query: string): React.ReactNode {
  if (!text) return null
  const q = query.trim()
  if (!q) return text
  const lower = text.toLowerCase()
  const lowerQ = q.toLowerCase()
  const idx = lower.indexOf(lowerQ)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#FFF4B8] text-inherit rounded-[2px] px-[1px] -mx-[1px]">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}
