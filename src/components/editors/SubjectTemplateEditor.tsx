/**
 * SubjectTemplateEditor - Single-line Lexical editor for email subjects
 * 
 * Features:
 * - Single line only (no newlines)
 * - Placeholder badges rendered inline
 * - Cursor navigation works correctly around badges
 * - Copy/paste works
 * - Undo/redo works
 * - No innerHTML hacks
 */
import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { 
  $getRoot, 
  $createParagraphNode, 
  $createLineBreakNode,
  $createTextNode,
  LexicalEditor,
  $getSelection,
  $isRangeSelection,
  ParagraphNode,
} from 'lexical';

import { cn } from '@/lib/utils';
import { lexicalTheme, LEXICAL_EDITOR_STYLES } from './lexicalTheme';
import { PlaceholderNode, $createPlaceholderNode } from './nodes/PlaceholderNode';
import { PlaceholderPlugin, insertPillInto } from './plugins/PlaceholderPlugin';
import { DEFAULT_PILL_VARIABLES, PillVariablesContext, type PillVariable } from './placeholderMenu';
import { CLEAR_HISTORY_COMMAND } from 'lexical';
import { SingleLinePlugin } from './plugins/SingleLinePlugin';
import { OnChangePlugin } from './plugins/OnChangePlugin';
import { parseTemplateToNodes } from './utils/placeholderLexicalUtils';

export interface SubjectTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
  success?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  id?: string;
  /** What a pill can be swapped for (its click menu); the general email list when left out. */
  variables?: PillVariable[];
  /**
   * Several lines of plain text (2026-11-06): Enter adds a line break and the value keeps
   * its "\n"s, for plain-text emails such as Gio Sign's message.
   */
  multiline?: boolean;
  /** With `multiline`: the box's height before it grows. */
  minHeight?: string;
  ariaLabel?: string;
}

/** The value as one paragraph: text, pills, and a line break per "\n" when multiline. */
function $loadPlain(value: string, multiline: boolean) {
  const root = $getRoot();
  root.clear();
  const paragraph = $createParagraphNode();
  const lines = multiline ? value.split('\n') : [value];
  lines.forEach((line, i) => {
    parseTemplateToNodes(line).forEach((node) => paragraph.append(node));
    if (i < lines.length - 1) paragraph.append($createLineBreakNode());
  });
  root.append(paragraph);
}

export interface SubjectTemplateEditorHandle {
  insertPlaceholder: (placeholder: string) => void;
  focus: () => void;
}

// Inner component that has access to the Lexical context
function SubjectEditorInner({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  error,
  success,
  onFocus,
  onBlur,
  id,
  multiline = false,
  minHeight = '96px',
  ariaLabel,
  editorRef,
}: SubjectTemplateEditorProps & { editorRef: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  const [isFocused, setIsFocused] = useState(false);
  const lastValueRef = useRef(value);
  const isInitializedRef = useRef(false);

  // Store editor reference for imperative handle
  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);

  // Initialize editor with initial value
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    if (value) {
      editor.update(() => $loadPlain(value, multiline));
      lastValueRef.current = value;
      // Opening a template isn't something to undo: ⌘Z right away would empty the box.
      editor.update(() => {}, { onUpdate: () => editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined) });
    }
  }, [editor, value, multiline]);

  // Handle external value changes (but not while focused)
  useEffect(() => {
    if (isFocused) return;
    if (value === lastValueRef.current) return;

    editor.update(() => $loadPlain(value, multiline));
    lastValueRef.current = value;
  }, [editor, value, isFocused, multiline]);

  const handleChange = useCallback((newValue: string) => {
    lastValueRef.current = newValue;
    onChange(newValue);
  }, [onChange]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  return (
    <div className="relative">
      <PlainTextPlugin
        contentEditable={
          <ContentEditable
            id={id}
            // The field look (Input's: same border, focus ring and hover), never moving on hover (§12).
            className={cn(
              multiline ? "lexical-subject-editor lexical-plain-multiline" : "lexical-subject-editor",
              "flex w-full rounded-lg border bg-surface-primary px-3 py-2 text-sm ring-offset-background gio-field shadow-[var(--shadow-xs)]",
              multiline ? "items-start" : "items-center min-h-[var(--input-height)]",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-transparent focus-visible:border-[var(--input-border-focus)] focus-visible:shadow-input hover:shadow-[var(--shadow-button)]",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-secondary",
              error && "border-destructive shadow-[0_0_0_1px_hsl(var(--destructive))]",
              success && "border-success shadow-[0_0_0_1px_hsl(var(--success))]",
              !error && !success && "border-virgilio-border hover:border-virgilio-purple/50",
              className
            )}
            style={multiline ? { minHeight } : undefined}
            aria-label={ariaLabel}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            aria-disabled={disabled}
          />
        }
        placeholder={
          <div className={cn("lexical-editor-placeholder absolute left-3 pointer-events-none", multiline ? "top-2" : "top-1/2 -translate-y-1/2")}>
            {placeholder}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <PlaceholderPlugin singleLine={!multiline} />
      {!multiline && <SingleLinePlugin />}
      <OnChangePlugin onChange={handleChange} singleLine />
      <HistoryPlugin />
    </div>
  );
}

export const SubjectTemplateEditor = forwardRef<SubjectTemplateEditorHandle, SubjectTemplateEditorProps>(
  (props, ref) => {
    const editorRef = useRef<LexicalEditor | null>(null);
    const [isStylesInjected, setIsStylesInjected] = useState(false);

    // Inject styles on mount
    useEffect(() => {
      if (!document.getElementById('lexical-editor-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'lexical-editor-styles';
        styleEl.textContent = LEXICAL_EDITOR_STYLES;
        document.head.appendChild(styleEl);
      }
      setIsStylesInjected(true);
    }, []);

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      insertPlaceholder: (placeholder: string) => {
        const editor = editorRef.current;
        if (editor) insertPillInto(editor, placeholder);
      },
      focus: () => {
        editorRef.current?.focus();
      }
    }));

    const initialConfig = {
      namespace: 'SubjectTemplateEditor',
      theme: lexicalTheme,
      nodes: [PlaceholderNode],
      onError: (error: Error) => {
        console.error('Lexical error:', error);
      },
      editable: !props.disabled,
    };

    if (!isStylesInjected) {
      return null;
    }

    return (
      <LexicalComposer initialConfig={initialConfig}>
        <PillVariablesContext.Provider value={props.variables ?? DEFAULT_PILL_VARIABLES}>
          <SubjectEditorInner {...props} editorRef={editorRef} />
        </PillVariablesContext.Provider>
      </LexicalComposer>
    );
  }
);

SubjectTemplateEditor.displayName = 'SubjectTemplateEditor';
