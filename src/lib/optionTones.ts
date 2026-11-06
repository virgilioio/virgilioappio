/** Option-card tints (2026-11-06), one per kind of thing: `OptionCard` in ui/option-card.tsx. */
export interface OptionTone {
  bg: string;
  fg: string;
}

/** The tints option cards use, one per kind of thing. */
export const OPTION_TONES = {
  purple: { bg: '#EFE9FE', fg: '#6F3FF5' },
  sky: { bg: '#E3F4FD', fg: '#0EA5E9' },
  amber: { bg: '#FBF0DF', fg: '#E0891A' },
  green: { bg: '#E4F5EA', fg: '#12B886' },
  red: { bg: '#FDECEC', fg: '#FA5252' },
  pink: { bg: '#FCE7F3', fg: '#BE185D' },
  neutral: { bg: '#F1F0EC', fg: '#5A6072' },
} satisfies Record<string, OptionTone>;
