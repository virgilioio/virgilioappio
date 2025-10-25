import React, { useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SubjectInputWithBadgesProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const SubjectInputWithBadges = ({
  value,
  onChange,
  placeholder = '',
  className,
  id,
}: SubjectInputWithBadgesProps) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync external value changes to editor
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // Handle content changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // Prevent line breaks and handle badge deletion
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Prevent Enter key (no line breaks in subject)
    if (e.key === 'Enter') {
      e.preventDefault();
      return;
    }

    const selection = window.getSelection();
    if (!selection || !selection.anchorNode) return;
    
    const anchorElement = selection.anchorNode.parentElement;
    const isBadge = anchorElement?.classList.contains('placeholder-badge');
    const nextSibling = selection.anchorNode.nextSibling as HTMLElement;
    const prevSibling = selection.anchorNode.previousSibling as HTMLElement;
    
    // Prevent backspace/delete from partially deleting badges
    if (e.key === 'Backspace' && prevSibling?.classList?.contains('placeholder-badge')) {
      e.preventDefault();
      prevSibling.remove();
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    } else if (e.key === 'Delete' && nextSibling?.classList?.contains('placeholder-badge')) {
      e.preventDefault();
      nextSibling.remove();
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    } else if (isBadge) {
      // Prevent typing inside badges
      e.preventDefault();
    }
  }, [onChange]);

  // Handle paste - strip line breaks
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(/\n/g, ' ');
    document.execCommand('insertText', false, text);
  }, []);

  return (
    <div
      ref={editorRef}
      id={id}
      contentEditable
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
        "text-sm ring-offset-background",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "overflow-x-auto whitespace-nowrap",
        "[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground [&:empty]:before:pointer-events-none",
        className
      )}
      data-placeholder={placeholder}
      suppressContentEditableWarning
    />
  );
};
