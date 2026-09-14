type GlyphProps = { size?: number; color?: string; accent?: string };

export function SettingsGlyph({ size = 20, color = "#fffcf9", accent = "#D7C5FB" }: GlyphProps) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label="Settings">
      <rect x="9" y="13" width="30" height="9" rx="4.5" fill={color} />
      <circle cx="30" cy="17.5" r="6.5" fill={accent} />
      <rect x="9" y="27" width="30" height="9" rx="4.5" fill={color} />
      <circle cx="18" cy="31.5" r="6.5" fill={color} />
    </svg>
  );
}