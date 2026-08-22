/** Monospace placeholder token pill. JetBrains Mono is used here and nowhere else. */
export function PlaceholderPill({
  name,
  onClick,
  title,
}: {
  name: string
  onClick?: () => void
  title?: string
}) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      title={title}
      className="inline-flex items-center"
      style={{
        height: 20,
        padding: '0 7px',
        borderRadius: 5,
        background: '#EDE4FF',
        color: '#5B21B6',
        fontWeight: 500,
        fontSize: 11.5,
        fontFamily: "'JetBrains Mono', Menlo, monospace",
        margin: '0 1px',
        border: 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {`{{${name}}}`}
    </Tag>
  )
}

export default PlaceholderPill
