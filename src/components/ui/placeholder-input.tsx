import React, { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { convertPlaceholdersToHtml, convertHtmlToPlaceholders } from '@/utils/placeholderUtils';

export interface PlaceholderInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onFocus'> {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  success?: boolean;
  onFocus?: () => void;
}

export interface PlaceholderInputHandle {
  insertPlaceholder: (placeholder: string) => void;
}

const PLACEHOLDER_BADGE_STYLES = `
  .placeholder-input-badge {
    background-color: rgb(168 85 247 / 0.15);
    color: rgb(147 51 234);
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 500;
    font-size: 0.875rem;
    display: inline-block;
    margin: 0 2px;
    user-select: none;
    cursor: default;
    border: 1px solid rgb(168 85 247 / 0.4);
    white-space: nowrap;
  }
  
  .dark .placeholder-input-badge {
    background-color: rgb(168 85 247 / 0.2);
    color: rgb(192 132 252);
    border-color: rgb(168 85 247 / 0.5);
  }
`;

export const PlaceholderInput = forwardRef<PlaceholderInputHandle, PlaceholderInputProps>(
  ({ className, value, onChange, error, success, placeholder, disabled, onFocus, ...props }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isUpdatingRef = useRef(false);

    const processPlaceholders = useCallback((text: string): string => {
      return convertPlaceholdersToHtml(text.replace(/class="placeholder-badge"/g, 'class="placeholder-input-badge"'));
    }, []);

    const updateContent = useCallback((html: string) => {
      if (isUpdatingRef.current) return;
      
      const plainText = convertHtmlToPlaceholders(html);
      onChange(plainText);
    }, [onChange]);

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (isUpdatingRef.current) return;
    
    const target = e.target as HTMLDivElement;
    
    // Save cursor position BEFORE any processing
    const selection = window.getSelection();
    let cursorOffset = 0;
    let anchorNode = selection?.anchorNode;
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      cursorOffset = range.startOffset;
      anchorNode = range.startContainer;
    }
    
    // Normalize and process placeholders
    const normalized = convertHtmlToPlaceholders(target.innerHTML);
    const processed = processPlaceholders(normalized);
    
    if (processed !== target.innerHTML) {
      target.innerHTML = processed;
      
      // Restore cursor position
      requestAnimationFrame(() => {
        try {
          const selection = window.getSelection();
          if (selection && target.firstChild) {
            const range = document.createRange();
            const textNode = target.firstChild;
            const offset = Math.min(cursorOffset, textNode.textContent?.length || 0);
            range.setStart(textNode, offset);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } catch (error) {
          console.debug('Failed to restore cursor:', error);
        }
      });
    }
    
    updateContent(target.innerHTML);
  }, [processPlaceholders, updateContent]);

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
      
      if (editorRef.current) {
        const processed = processPlaceholders(editorRef.current.innerText || '');
        editorRef.current.innerHTML = processed;
        updateContent(processed);
      }
    }, [processPlaceholders, updateContent]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      const selection = window.getSelection();
      if (!selection || !selection.anchorNode) return;
      
      const anchorElement = selection.anchorNode.parentElement;
      const isBadge = anchorElement?.classList.contains('placeholder-input-badge');
      const nextSibling = selection.anchorNode.nextSibling as HTMLElement;
      const prevSibling = selection.anchorNode.previousSibling as HTMLElement;
      
      if (e.key === 'Backspace' && prevSibling?.classList?.contains('placeholder-input-badge')) {
        e.preventDefault();
        prevSibling.remove();
        if (editorRef.current) updateContent(editorRef.current.innerHTML);
      } else if (e.key === 'Delete' && nextSibling?.classList?.contains('placeholder-input-badge')) {
        e.preventDefault();
        nextSibling.remove();
        if (editorRef.current) updateContent(editorRef.current.innerHTML);
      } else if (isBadge) {
        e.preventDefault();
      }
    }, [updateContent]);

    const insertPlaceholder = useCallback((placeholder: string) => {
      if (!editorRef.current || disabled) return;
      
      editorRef.current.focus();
      
      const badgeHtml = processPlaceholders(placeholder);
      
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = badgeHtml;
        const badge = tempDiv.firstElementChild;
        
        if (badge) {
          range.insertNode(badge);
          const space = document.createTextNode(' ');
          range.insertNode(space);
          range.setStartAfter(space);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else {
        editorRef.current.innerHTML += badgeHtml + ' ';
      }
      
      updateContent(editorRef.current.innerHTML);
    }, [processPlaceholders, updateContent, disabled]);

    useImperativeHandle(ref, () => ({
      insertPlaceholder
    }));

    // Inject styles
    useEffect(() => {
      if (!document.getElementById('placeholder-input-badge-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'placeholder-input-badge-styles';
        styleEl.textContent = PLACEHOLDER_BADGE_STYLES;
        document.head.appendChild(styleEl);
      }
    }, []);

    // Update when value changes externally
    useEffect(() => {
      if (!editorRef.current || isUpdatingRef.current) return;
      
      const processed = processPlaceholders(value);
      if (editorRef.current.innerHTML !== processed) {
        isUpdatingRef.current = true;
        editorRef.current.innerHTML = processed;
        requestAnimationFrame(() => {
          isUpdatingRef.current = false;
        });
      }
    }, [value, processPlaceholders]);

    return (
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        data-placeholder={placeholder}
        className={cn(
          "flex h-[var(--input-height)] w-full rounded-brand border bg-surface-primary px-3 py-2 text-sm ring-offset-background transition-all duration-200 ease-out shadow-[var(--shadow-xs)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-accent hover:shadow-[var(--shadow-button)] hover:-translate-y-0.5",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-secondary",
          error && "border-destructive ring-destructive focus-visible:ring-destructive shadow-[0_0_0_1px_hsl(var(--destructive))]",
          success && "border-success ring-success focus-visible:ring-success shadow-[0_0_0_1px_hsl(var(--success))]",
          !error && !success && "border-border hover:border-accent/60",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-text-tertiary",
          className
        )}
        {...props}
      />
    );
  }
);

PlaceholderInput.displayName = 'PlaceholderInput';
