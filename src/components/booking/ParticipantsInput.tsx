import { useState, KeyboardEvent, ClipboardEvent } from 'react';
import { X } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().email().max(255);

interface Props {
  emails: string[];
  onChange: (emails: string[]) => void;
  ownEmail?: string;
  max?: number;
}

/** Public-safe tag input: type an email, press space/comma/Enter to turn it into a chip. */
export function ParticipantsInput({ emails, onChange, ownEmail, max = 10 }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const commit = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...emails];
    const invalid: string[] = [];
    let capped = false;
    for (const p of parts) {
      const r = emailSchema.safeParse(p);
      if (!r.success) { invalid.push(p); continue; }
      const e = r.data;
      if (next.includes(e) || e === ownEmail?.trim().toLowerCase()) continue;
      if (next.length >= max) { capped = true; continue; }
      next.push(e);
    }
    onChange(next);
    setValue(invalid.join(' '));
    setError(invalid.length ? `"${invalid[0]}" isn't a valid email` : capped ? `Up to ${max} participants` : null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === ',' || e.key === 'Enter' || e.key === ';') {
      if (value.trim()) { e.preventDefault(); commit(value); }
      else if (e.key === 'Enter') e.preventDefault();
    } else if (e.key === 'Backspace' && !value && emails.length) {
      onChange(emails.slice(0, -1));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (/[\s,;]/.test(text)) { e.preventDefault(); commit(value + ' ' + text); }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-virgilio-muted">Add participants (optional)</label>
      <div className="min-h-11 flex flex-wrap items-center gap-1.5 rounded-lg border border-virgilio-border bg-background px-2 py-1.5 focus-within:border-virgilio-purple focus-within:ring-1 focus-within:ring-virgilio-purple">
        {emails.map((e) => (
          <span key={e} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-virgilio-text">
            {e}
            <button type="button" aria-label={`Remove ${e}`} onClick={() => onChange(emails.filter((x) => x !== e))} className="rounded p-0.5 hover:bg-foreground/10">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          inputMode="email"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => value.trim() && commit(value)}
          disabled={emails.length >= max}
          placeholder={emails.length ? '' : 'name@company.com, another@company.com'}
          className="flex-1 min-w-[160px] bg-transparent text-sm outline-none py-1 placeholder:text-virgilio-muted/70"
        />
      </div>
      {error ? (
        <p className="text-xs text-virgilio-error">{error}</p>
      ) : (
        <p className="text-xs text-virgilio-muted">They'll get the calendar invite too. Separate emails with a space or comma.</p>
      )}
    </div>
  );
}
