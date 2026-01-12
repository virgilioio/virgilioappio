/**
 * BodyTemplateEditor - Rich text Lexical editor for email body
 * 
 * Features:
 * - Rich text formatting (bold, italic, underline, lists)
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
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { HeadingNode } from '@lexical/rich-text';
import { 
  $getRoot, 
  $createParagraphNode, 
  $createTextNode,
  LexicalEditor,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  ParagraphNode,
} from 'lexical';
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { Bold, Italic, Underline, List, ListOrdered } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { lexicalTheme, LEXICAL_EDITOR_STYLES } from './lexicalTheme';
import { PlaceholderNode, $createPlaceholderNode } from './nodes/PlaceholderNode';
import { PlaceholderPlugin } from './plugins/PlaceholderPlugin';
import { OnChangePlugin } from './plugins/OnChangePlugin';
import { parseTemplateToNodes } from './utils/placeholderLexicalUtils';
import { convertHtmlToPlaceholders } from '@/utils/placeholderUtils';

export interface BodyTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
  onFocus?: () => void;
}

export interface BodyTemplateEditorHandle {
  insertPlaceholder: (placeholder: string) => void;
  focus: () => void;
}

// Toolbar component
function Toolbar() {
  const [editor] = useLexicalComposerContext();

  return (
    <div className="flex items-center gap-1 p-2 border-b border-border bg-surface-secondary/50 rounded-t-brand">
      <Toggle
        size="sm"
        aria-label="Bold"
        onPressedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Italic"
        onPressedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Underline"
        onPressedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
      >
        <Underline className="h-4 w-4" />
      </Toggle>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Toggle
        size="sm"
        aria-label="Bullet List"
        onPressedChange={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
      >
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Numbered List"
        onPressedChange={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
      >
        <ListOrdered className="h-4 w-4" />
      </Toggle>
    </div>
  );
}

// Inner component with Lexical context access
function BodyEditorInner({
  value,
  onChange,
  placeholder,
  className,
  minHeight = '200px',
  disabled,
  onFocus,
  editorRef,
}: BodyTemplateEditorProps & { editorRef: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  const [isFocused, setIsFocused] = useState(false);
  const lastValueRef = useRef(value);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);

  // Initialize with value
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    if (value) {
      // Normalize: strip any HTML and convert to plain text with {{placeholders}}
      const plainText = convertHtmlToPlaceholders(value);
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const lines = plainText.split('\n');
        lines.forEach(line => {
          const paragraph = $createParagraphNode();
          const nodes = parseTemplateToNodes(line);
          nodes.forEach(node => paragraph.append(node));
          root.append(paragraph);
        });
      });
      lastValueRef.current = value;
    }
  }, [editor, value]);

  // Handle external value changes
  useEffect(() => {
    if (isFocused) return;
    if (value === lastValueRef.current) return;

    // Normalize: strip any HTML and convert to plain text with {{placeholders}}
    const plainText = convertHtmlToPlaceholders(value);
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      const lines = plainText.split('\n');
      lines.forEach(line => {
        const paragraph = $createParagraphNode();
        const nodes = parseTemplateToNodes(line);
        nodes.forEach(node => paragraph.append(node));
        root.append(paragraph);
      });
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
  }, []);

  return (
    <div className={cn("border rounded-brand bg-surface-primary", className)}>
      <Toolbar />
      <div className="relative" style={{ minHeight }}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className={cn(
                "lexical-root p-3 outline-none",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              style={{ minHeight }}
              onFocus={handleFocus}
              onBlur={handleBlur}
              disabled={disabled}
            />
          }
          placeholder={
            <div className="lexical-editor-placeholder absolute left-3 top-3 pointer-events-none">
              {placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <PlaceholderPlugin />
        <OnChangePlugin onChange={handleChange} />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
      </div>
    </div>
  );
}

export const BodyTemplateEditor = forwardRef<BodyTemplateEditorHandle, BodyTemplateEditorProps>(
  (props, ref) => {
    const editorRef = useRef<LexicalEditor | null>(null);
    const [isStylesInjected, setIsStylesInjected] = useState(false);

    useEffect(() => {
      if (!document.getElementById('lexical-editor-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'lexical-editor-styles';
        styleEl.textContent = LEXICAL_EDITOR_STYLES;
        document.head.appendChild(styleEl);
      }
      setIsStylesInjected(true);
    }, []);

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
          }
        });
      },
      focus: () => {
        editorRef.current?.focus();
      }
    }));

    const initialConfig = {
      namespace: 'BodyTemplateEditor',
      theme: lexicalTheme,
      nodes: [PlaceholderNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, HeadingNode],
      onError: (error: Error) => {
        console.error('Lexical error:', error);
      },
      editable: !props.disabled,
    };

    if (!isStylesInjected) return null;

    return (
      <LexicalComposer initialConfig={initialConfig}>
        <BodyEditorInner {...props} editorRef={editorRef} />
      </LexicalComposer>
    );
  }
);

BodyTemplateEditor.displayName = 'BodyTemplateEditor';
