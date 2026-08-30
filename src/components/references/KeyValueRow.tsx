/**
 * One label/value pair inside the expanded referee frame. Two per row on
 * desktop, stacked on narrow widths. An absent value renders an em dash — never
 * a blank cell.
 */
export function KeyValueRow({
  label,
  value,
  valueColor = '#1F2230',
}: {
  label: string
  value?: React.ReactNode
  valueColor?: string
}) {
  const empty = value === null || value === undefined || value === ''
  return (
    <div className="min-w-0">
      <p className="font-inter" style={{ fontSize: 10.5, color: '#8B8F9E', letterSpacing: '0.02em' }}>
        {label}
      </p>
      <p
        className="font-inter truncate"
        style={{ fontSize: 12, color: empty ? '#B5B9C4' : valueColor, marginTop: 2 }}
      >
        {empty ? '—' : value}
      </p>
    </div>
  )
}

export default KeyValueRow
