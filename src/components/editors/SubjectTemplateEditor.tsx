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
  $createTextNode,
  LexicalEditor,
  $getSelection,
  $isRangeSelection,
  ParagraphNode,
} from 'lexical';

import { cn } from '@/lib/utils';
import { lexicalTheme, LEXICAL_EDITOR_STYLES } from './lexicalTheme';
import { PlaceholderNode, $createPlaceholderNode } from './nodes/PlaceholderNode';
import { PlaceholderPlugin } from './plugins/PlaceholderPlugin';
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
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        const nodes = parseTemplateToNodes(value);
        nodes.forEach(node => paragraph.append(node));
        root.append(paragraph);
      });
      lastValueRef.current = value;
    }
  }, [editor, value]);

  // Handle external value changes (but not while focused)
  useEffect(() => {
    if (isFocused) return;
    if (value === lastValueRef.current) return;

    editor.update(() => {
      const root = $getRoot();
      root.clear();
      const paragraph = $createParagraphNode();
      const nodes = parseTemplateToNodes(value);
      nodes.forEach(node => paragraph.append(node));
      root.append(paragraph);
    });
    lastValueRef.current = value;
  }, [editor, value, isFocused]);

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
            className={cn(
              "lexical-subject-editor",
              "flex items-center min-h-[var(--input-height)] w-full rounded-brand border bg-surface-primary px-3 py-2 text-sm ring-offset-background transition-all duration-200 ease-out shadow-[var(--shadow-xs)]",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:border-accent hover:shadow-[var(--shadow-button)] hover:-translate-y-0.5",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-secondary",
              error && "border-destructive ring-destructive focus:ring-destructive shadow-[0_0_0_1px_hsl(var(--destructive))]",
              success && "border-success ring-success focus:ring-success shadow-[0_0_0_1px_hsl(var(--success))]",
              !error && !success && "border-border hover:border-accent/60",
              className
            )}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            aria-disabled={disabled}
          />
        }
        placeholder={
          <div className="lexical-editor-placeholder absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {placeholder}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <PlaceholderPlugin singleLine />
      <SingleLinePlugin />
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
        if (!editor) return;

        editor.update(() => {
          const selection = $getSelection();
          
          if ($isRangeSelection(selection)) {
            selection.removeText();
            const placeholderNode = $createPlaceholderNode(placeholder);
            const spaceNode = $createTextNode(' ');
            selection.insertNodes([placeholderNode, spaceNode]);
            spaceNode.select(1, 1);
          } else {
            // No selection, append to end
            const root = $getRoot();
            const lastChild = root.getLastChild();
            if (lastChild instanceof ParagraphNode) {
              const placeholderNode = $createPlaceholderNode(placeholder);
              const spaceNode = $createTextNode(' ');
              lastChild.append(placeholderNode);
              lastChild.append(spaceNode);
              spaceNode.select(1, 1);
            }
          }
        });
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
        <SubjectEditorInner {...props} editorRef={editorRef} />
      </LexicalComposer>
    );
  }
);

SubjectTemplateEditor.displayName = 'SubjectTemplateEditor';
