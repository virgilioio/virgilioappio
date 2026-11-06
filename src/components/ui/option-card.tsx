import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OptionTone } from '@/lib/optionTones';

/**
 * The option card (2026-11-06): the stage automation's "Do" look, shared so every
 * "pick one kind of thing" grid reads the same (Do, Slack's When). A tinted icon
 * tile, a Poppins label and a one-line description; the chosen card has a 2px purple
 * border (padding shrinks by 1px so nothing moves); "Soon" options are disabled.
 * Tints come from `OPTION_TONES` (src/lib/optionTones.ts).
 */
interface OptionCardProps {
  icon: LucideIcon;
  tone: OptionTone;
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  soon?: boolean;
  /** Inside a `role="radiogroup"`: a radio (aria-checked); otherwise a toggle (aria-pressed). */
  radio?: boolean;
  className?: string;
}

export function OptionCard({ icon: Icon, tone, label, description, selected, onSelect, soon, radio, className }: OptionCardProps) {
  return (
    <button
      type="button"
      disabled={soon}
      role={radio ? 'radio' : undefined}
      aria-checked={radio ? selected : undefined}
      aria-pressed={radio ? undefined : selected}
      onClick={onSelect}
      className={cn(
        'gio-pressable text-left rounded-xl flex items-start gap-3 bg-white transition-colors duration-hover disabled:opacity-50 disabled:cursor-not-allowed',
        !soon && !selected && 'hover:bg-[#FAFAF7]',
        className,
      )}
      style={{ border: selected ? '2px solid #6F3FF5' : '1px solid #E8E6E0', padding: selected ? 11 : 12 }}
    >
      <span className="h-8 w-8 rounded-lg shrink-0 inline-flex items-center justify-center" style={{ background: tone.bg, color: tone.fg }} aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-poppins truncate" style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09' }}>
          {label}
          {soon && <span className="ml-1.5 font-inter" style={{ fontSize: 10, color: '#8B8F9E', fontWeight: 500 }}>Soon</span>}
        </span>
        {description && (
          <span className="block font-inter" style={{ fontSize: 11.5, color: '#8B8F9E', lineHeight: 1.35 }}>{description}</span>
        )}
      </span>
    </button>
  );
}
