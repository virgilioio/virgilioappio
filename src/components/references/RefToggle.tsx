/**
 * 32×18 reference toggle. Deliberately not the shadcn Switch, but it moves like
 * one (Motion & Feel §2): `gio-switch` gives the track colour its 150ms and the
 * thumb its transform at --dur-switch and the 0.92 press scale.
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
      className="gio-switch"
      style={{
        position: 'relative',
        width: 32,
        height: 18,
        borderRadius: 999,
        border: 'none',
        flexShrink: 0,
        padding: 0,
        background: checked ? '#6F3FF5' : '#D1D0CB',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="gio-switch-thumb"
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          transform: checked ? 'translateX(14px)' : 'translateX(0)',
          width: 14,
          height: 14,
          borderRadius: 999,
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  )
}

export default RefToggle
