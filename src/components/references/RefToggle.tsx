/**
 * 32×18 reference toggle. Deliberately not the shadcn Switch.
 */
export function RefToggle({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        onChange(!checked)
      }}
      style={{
        position: 'relative',
        width: 32,
        height: 18,
        borderRadius: 999,
        border: 'none',
        flexShrink: 0,
        padding: 0,
        background: checked ? '#6F3FF5' : '#D1D0CB',
        transition: 'background 140ms ease',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 16 : 2,
          width: 14,
          height: 14,
          borderRadius: 999,
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          transition: 'left 140ms ease',
        }}
      />
    </button>
  )
}

export default RefToggle
