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
    display: inline-flex;
    align-items: center;
    margin: 0 2px;
    user-select: none;
    cursor: default;
    border: 1px solid rgb(168 85 247 / 0.4);
    white-space: nowrap;
    flex-shrink: 0;
    vertical-align: middle;
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
    const html = target.innerHTML;
    
    // Convert current HTML to plain text with placeholder syntax
    const normalized = convertHtmlToPlaceholders(html);
    
    // Only re-process DOM if there are NEW unprocessed placeholder patterns
    // (i.e., user manually typed "{{something}}" that needs to become a badge)
    const hasUnprocessedPlaceholders = /\{\{[^}]+\}\}/.test(normalized);
    
    if (hasUnprocessedPlaceholders) {
      const selection = window.getSelection();
      const processed = processPlaceholders(normalized);
      
      isUpdatingRef.current = true;
      target.innerHTML = processed;
      
      // Position cursor at end after processing new badges
      requestAnimationFrame(() => {
        isUpdatingRef.current = false;
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(target);
          range.collapse(false); // Collapse to end
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });
    }
    
    // Always update the value (without modifying DOM for normal typing)
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
          // Insert badge at cursor position
          range.insertNode(badge);
          
          // Create a non-breaking space AFTER the badge using DOM API (not range.insertNode)
          const space = document.createTextNode('\u00A0');
          badge.after(space);
          
          // Position cursor after the space
          range.setStartAfter(space);
          range.setEndAfter(space);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else {
        // Fallback: append and position cursor at end
        editorRef.current.innerHTML += badgeHtml + '\u00A0';
        
        // Position cursor at the end
        const newSelection = window.getSelection();
        if (newSelection) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false); // Collapse to end
          newSelection.removeAllRanges();
          newSelection.addRange(range);
        }
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
      
      // Compare normalized content to avoid unnecessary updates
      const currentNormalized = convertHtmlToPlaceholders(editorRef.current.innerHTML);
      
      // Only update DOM if the actual content changed
      if (currentNormalized !== value) {
        const processed = processPlaceholders(value);
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
          "flex items-center min-h-[var(--input-height)] w-full rounded-brand border bg-surface-primary px-3 py-2 text-sm ring-offset-background transition-all duration-200 ease-out shadow-[var(--shadow-xs)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-accent hover:shadow-[var(--shadow-button)] hover:-translate-y-0.5",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-secondary",
          error && "border-destructive ring-destructive focus-visible:ring-destructive shadow-[0_0_0_1px_hsl(var(--destructive))]",
          success && "border-success ring-success focus-visible:ring-success shadow-[0_0_0_1px_hsl(var(--success))]",
          !error && !success && "border-border hover:border-accent/60",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-text-tertiary",
          "whitespace-nowrap overflow-x-auto",
          className
        )}
        {...props}
      />
    );
  }
);

PlaceholderInput.displayName = 'PlaceholderInput';
