import { useMemo, useState } from 'react';
import { Braces, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { menuPanel, menuItem, menuGroupLabel } from '@/lib/menu-classes';
import { cn } from '@/lib/utils';
import type { PillVariable } from './placeholderMenu';

/**
 * The variable picker inside an email editor (2026-11-07, from the stage automation
 * composer): a small "{ } Variable" button on the Subject line and "{ } Insert variable"
 * in the body's toolbar, each opening a searchable §19 menu grouped by kind, with the
 * readable name and the code. Picking one inserts a pill where the caret was in that
 * field. Only the variables the email fills are offered (`legacy` ones stay out).
 */
interface VariableMenuProps {
  variables: PillVariable[];
  onInsert: (key: string) => void;
  /** `subject`: the small button over the Subject line; `toolbar`: the body toolbar's. */
  variant: 'subject' | 'toolbar';
}

export function VariableMenu({ variables, onInsert, variant }: VariableMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const m = new Map<string, PillVariable[]>();
    for (const v of variables) {
      if (v.legacy) continue;
      if (q && !v.label.toLowerCase().includes(q) && !v.key.includes(q)) continue;
      const g = v.group || 'Variables';
      m.set(g, [...(m.get(g) || []), v]);
    }
    return Array.from(m.entries());
  }, [variables, query]);

  const pick = (key: string) => {
    onInsert(key);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover modal open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        {variant === 'subject' ? (
          // Keeps the caret where it was, so the variable lands there.
          <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-6 px-1.5 rounded-md inline-flex items-center gap-1 font-inter hover:bg-[#F1F0EC]" style={{ fontSize: 11.5, color: '#6F3FF5' }}>
            <Braces className="h-3 w-3" /> Variable
          </button>
        ) : (
          <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 px-2 rounded-md inline-flex items-center gap-1.5 font-inter hover:bg-[#F1F0EC]" style={{ fontSize: 12, color: '#6F3FF5' }}>
            <Braces className="h-3.5 w-3.5" /> Insert variable
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className={cn(menuPanel, 'w-[280px] p-0 z-[1300]')}>
        <div className="flex items-center gap-2 px-3 h-9" style={{ borderBottom: '1px solid #F1F0EC' }}>
          <Search className="h-3.5 w-3.5" style={{ color: '#8B8F9E' }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search variables"
            aria-label="Search variables"
            className="flex-1 bg-transparent outline-none font-inter"
            style={{ fontSize: 12.5 }}
          />
        </div>
        <div className="p-1 max-h-[280px] overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()}>
          {groups.length === 0 && <div className="px-3 py-2 font-inter" style={{ fontSize: 12.5, color: '#8B8F9E' }}>No matches</div>}
          {groups.map(([group, vars]) => (
            <div key={group}>
              <div className={menuGroupLabel}>{group}</div>
              {vars.map((v) => (
                <button key={v.key} type="button" className={cn(menuItem, 'w-full justify-between')} onClick={() => pick(v.key)}>
                  <span className="truncate">{v.label}</span>
                  <span className="font-mono shrink-0" style={{ fontSize: 10.5, color: '#8B8F9E' }}>{`{{${v.key}}}`}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
