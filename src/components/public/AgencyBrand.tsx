/**
 * Agency brand lockup for the public reference pages.
 *
 * Three cases only: a logo lockup, a wordmark (the default), or a registered
 * name whose legal suffix drops onto a second line. Never a placeholder box,
 * never a monogram, and never a Gio fallback — Gio appears once, in the footer.
 */

interface AgencyBrandProps {
  name: string
  logoUrl?: string | null
}

const SUFFIX = /\s+(Ltd\.?|Limited|LLC|Inc\.?|GmbH|B\.?V\.?|S\.?A\.?|SARL|AB|Oy|Pty Ltd|PLC)$/i

export function AgencyBrand({ name, logoUrl }: AgencyBrandProps) {
  if (logoUrl) {
    return (
      <span className="flex items-center" style={{ gap: 12 }}>
        <img
          src={logoUrl}
          alt={name}
          style={{ height: 26, width: 'auto', display: 'block' }}
          loading="eager"
        />
        <span style={{ width: 1, height: 20, background: '#E6E3DA' }} aria-hidden />
        <span
          className="font-inter"
          style={{ fontSize: 12.5, color: '#8B8F9E', letterSpacing: '-0.005em' }}
        >
          {name}
        </span>
      </span>
    )
  }

  const match = name.match(SUFFIX)
  if (match) {
    const base = name.slice(0, match.index).trim()
    return (
      <span className="flex flex-col" style={{ lineHeight: 1.1 }}>
        <span
          className="font-poppins"
          style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.04em', color: '#1F2230' }}
        >
          {base}
        </span>
        <span className="font-inter" style={{ fontSize: 10.5, color: '#8B8F9E', marginTop: 2 }}>
          {match[1]}
        </span>
      </span>
    )
  }

  return (
    <span
      className="font-poppins"
      style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.04em', color: '#1F2230' }}
    >
      {name}
    </span>
  )
}
