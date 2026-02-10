import { useState, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { X, UserPlus } from 'lucide-react';

interface GuestEmailInputProps {
  emails: string[];
  onChange: (emails: string[]) => void;
  max?: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GuestEmailInput({ emails, onChange, max = 10 }: GuestEmailInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

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
  };

  const removeEmail = (email: string) => {
    onChange(emails.filter(e => e !== email));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(inputValue);
    }
    if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      removeEmail(emails[emails.length - 1]);
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addEmail(inputValue);
    }
  };

  return (
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
          {emails.map(email => (
            <Badge key={email} variant="secondary" className="gap-1 pr-1 text-xs">
              {email}
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Input
        type="email"
        placeholder="Enter email and press Enter"
        value={inputValue}
        onChange={e => {
          setInputValue(e.target.value);
          setError(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        error={!!error}
        disabled={emails.length >= max}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      {emails.length > 0 && (
        <p className="text-xs text-text-secondary">{emails.length}/{max} guests</p>
      )}
    </div>
  );
}
