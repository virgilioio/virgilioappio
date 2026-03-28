import { useState, useRef, useEffect, useCallback, KeyboardEvent, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { X, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useCustomerMembers, Member } from '@/hooks/useCustomerMembers';

interface GuestEmailInputProps {
  emails: string[];
  onChange: (emails: string[]) => void;
  max?: number;
  organizationId?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getInitials(first: string | null, last: string | null): string {
  return [(first || '')[0], (last || '')[0]].filter(Boolean).join('').toUpperCase() || '?';
}

function getInitialColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-purple-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function GuestEmailInput({ emails, onChange, max = 10, organizationId }: GuestEmailInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: members } = useCustomerMembers(organizationId || '');

  // Build email->member lookup
  const memberByEmail = useMemo(() => {
    const map = new Map<string, Member>();
    members?.forEach(m => {
      if (m.profile?.email) map.set(m.profile.email.toLowerCase(), m);
    });
    return map;
  }, [members]);

  // Filter suggestions
  const suggestions = useMemo(() => {
    if (!members || !inputValue.trim()) return [];
    const q = inputValue.trim().toLowerCase();
    return members.filter(m => {
      const email = m.profile?.email?.toLowerCase() || '';
      const first = m.profile?.first_name?.toLowerCase() || '';
      const last = m.profile?.last_name?.toLowerCase() || '';
      if (emails.includes(email)) return false;
      return email.includes(q) || first.includes(q) || last.includes(q) || `${first} ${last}`.includes(q);
    }).slice(0, 8);
  }, [members, inputValue, emails]);

  useEffect(() => {
    setHighlightIndex(-1);
    setShowDropdown(inputValue.trim().length >= 1 && suggestions.length > 0);
  }, [inputValue, suggestions]);

  // Calculate dropdown position relative to viewport
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (showDropdown) {
      updateDropdownPosition();
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [showDropdown, updateDropdownPosition]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addEmail = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!email) return;

    if (!EMAIL_REGEX.test(email)) {
      setError('Invalid email format');
      return;
    }
    if (emails.includes(email)) {
      setError('Email already added');
      return;
    }
    if (emails.length >= max) {
      setError(`Maximum ${max} guests allowed`);
      return;
    }

    setError(null);
    onChange([...emails, email]);
    setInputValue('');
    setShowDropdown(false);
  };

  const removeEmail = (email: string) => {
    onChange(emails.filter(e => e !== email));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex(i => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex(i => Math.max(i - 1, -1));
        return;
      }
      if (e.key === 'Enter' && highlightIndex >= 0 && highlightIndex < suggestions.length) {
        e.preventDefault();
        const member = suggestions[highlightIndex];
        if (member.profile?.email) addEmail(member.profile.email);
        return;
      }
      if (e.key === 'Escape') {
        setShowDropdown(false);
        return;
      }
    }

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(inputValue);
    }
    if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      removeEmail(emails[emails.length - 1]);
    }
  };

  const handleBlur = () => {
    // Delay to allow dropdown click
    setTimeout(() => {
      if (inputValue.trim() && !showDropdown) {
        addEmail(inputValue);
      }
    }, 200);
  };

  const getMemberName = (email: string): string | null => {
    const m = memberByEmail.get(email.toLowerCase());
    if (!m?.profile) return null;
    const name = [m.profile.first_name, m.profile.last_name].filter(Boolean).join(' ');
    return name || null;
  };

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          Add Guests (optional)
        </Label>
        <p className="text-xs text-text-secondary -mt-1">
          Guests will receive a calendar invite via email
        </p>

        {emails.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {emails.map(email => {
              const name = getMemberName(email);
              return (
                <Tooltip key={email}>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                      {name || email}
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </TooltipTrigger>
                  {name && (
                    <TooltipContent side="top" className="text-xs">
                      {email}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
        )}

        <div className="relative">
          <Input
            ref={inputRef}
            type="email"
            placeholder="Search team members or enter email"
            value={inputValue}
            onChange={e => {
              setInputValue(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={() => { if (inputValue.trim().length >= 1 && suggestions.length > 0) setShowDropdown(true); }}
            error={!!error}
            disabled={emails.length >= max}
          />

          {showDropdown && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto"
            >
              {suggestions.map((member, idx) => {
                const first = member.profile?.first_name || '';
                const last = member.profile?.last_name || '';
                const email = member.profile?.email || '';
                const fullName = [first, last].filter(Boolean).join(' ');
                const initials = getInitials(first, last);
                const colorClass = getInitialColor(fullName || email);

                return (
                  <button
                    key={member.id}
                    className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-2 ${
                      idx === highlightIndex ? 'bg-accent' : ''
                    }`}
                    onMouseDown={(e) => { e.preventDefault(); if (email) addEmail(email); }}
                    onMouseEnter={() => setHighlightIndex(idx)}
                  >
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarImage src={member.profile?.avatar_url || undefined} />
                      <AvatarFallback className={`${colorClass} text-white text-[9px]`}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-foreground font-medium">{fullName || 'Unknown'}</span>
                    <span className="text-muted-foreground truncate ml-auto">{email}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        {emails.length > 0 && (
          <p className="text-xs text-text-secondary">{emails.length}/{max} guests</p>
        )}
      </div>
    </TooltipProvider>
  );
}
