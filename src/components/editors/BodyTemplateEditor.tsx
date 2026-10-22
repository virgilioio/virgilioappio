/**
 * BodyTemplateEditor - Rich text Lexical editor for email body
 *
 * Wears the ATS's formatted text box look (FormattedTextBox, the scorecard's
 * editor; Allan, 2026-10-22): the same frame, toolbar, link popover, typing
 * shortcuts and Tab nesting. It stays Lexical because email bodies hold
 * merge-tag chips. `toolbarExtra` puts a composer's own controls (variables,
 * Rewrite, Preview) on the toolbar's right.
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
import { LinkNode, AutoLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { HeadingNode, QuoteNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { 
  $getRoot, 
  $createParagraphNode, 
  $createTextNode,
  LexicalEditor,
  $getSelection,
  $isRangeSelection,
  $isParagraphNode,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  KEY_TAB_COMMAND,
  KEY_SPACE_COMMAND,
  COMMAND_PRIORITY_LOW,
  ParagraphNode,
} from 'lexical';
import { $generateNodesFromDOM } from '@lexical/html';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  $isListItemNode,
} from '@lexical/list';
import { $isLinkNode, $createLinkNode } from '@lexical/link';
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils';
import { Link as LinkIcon, Unlink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { IconTip } from '@/components/ui/tooltip';
import { BTN, FORMATTED_TEXT_STYLES, isMac } from '@/components/ui/formatted-text';
import { lexicalTheme, LEXICAL_EDITOR_STYLES } from './lexicalTheme';
import { PlaceholderNode, $createPlaceholderNode } from './nodes/PlaceholderNode';
import { PlaceholderPlugin } from './plugins/PlaceholderPlugin';
import { OnChangePlugin } from './plugins/OnChangePlugin';
import { AutoLinkPlugin } from './plugins/AutoLinkPlugin';
import { parseTemplateToNodes, loadHtmlIntoEditor } from './utils/placeholderLexicalUtils';
import { convertHtmlToPlaceholders } from '@/utils/placeholderUtils';

const HTML_TAG_REGEX = /<\/?[a-z][\s\S]*>/i;

export interface BodyTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  maxHeight?: string;
  disabled?: boolean;
  onFocus?: () => void;
  hideToolbar?: boolean;
  /** A composer's own controls, on the toolbar's right (variables, Rewrite, Preview). */
  toolbarExtra?: React.ReactNode;
  /** Read by screen readers; the field's visible label. */
  ariaLabel?: string;
}

export type BodyEditorCommand = 'bold' | 'italic' | 'underline' | 'ul' | 'ol' | 'quote' | 'link';

export interface BodyTemplateEditorHandle {
  insertPlaceholder: (placeholder: string) => void;
  insertHtml: (html: string) => void;
  focus: () => void;
  /** Drive formatting from an external toolbar. `link` takes a URL (empty string removes the link). */
  exec: (command: BodyEditorCommand, arg?: string) => void;
}

type ToolbarState = {
  bold: boolean; italic: boolean; underline: boolean; strikethrough: boolean;
  ul: boolean; ol: boolean; inLi: boolean; nested: boolean; link: string | null;
};
const EMPTY_STATE: ToolbarState = {
  bold: false, italic: false, underline: false, strikethrough: false,
  ul: false, ol: false, inLi: false, nested: false, link: null,
};

/** Reads the toolbar's state from the selection: marks, list kind and depth, link. */
function readState(): ToolbarState {
  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return EMPTY_STATE;
  const node = sel.anchor.getNode();
  const li = $getNearestNodeOfType(node, ListItemNode);
  const list = li?.getParent();
  const linkNode = $isLinkNode(node) ? node : $isLinkNode(node.getParent()) ? node.getParent() : null;
  return {
    bold: sel.hasFormat('bold'),
    italic: sel.hasFormat('italic'),
    underline: sel.hasFormat('underline'),
    strikethrough: sel.hasFormat('strikethrough'),
    ul: $isListNode(list) && list.getListType() === 'bullet',
    ol: $isListNode(list) && list.getListType() === 'number',
    inLi: !!li,
    nested: !!li && $isListItemNode(list?.getParent()),
    link: linkNode && $isLinkNode(linkNode) ? linkNode.getURL() : null,
  };
}

/** The formatted text box's toolbar, driving Lexical. */
function FormatToolbar({ extra, disabled }: { extra?: React.ReactNode; disabled?: boolean }) {
  const [editor] = useLexicalComposerContext();
  const [st, setSt] = useState<ToolbarState>(EMPTY_STATE);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(
    () => editor.registerUpdateListener(({ editorState }) => editorState.read(() => setSt(readState()))),
    [editor],
  );

  // ⌘K opens the link box; the formatted text box's other shortcuts.
  useEffect(() => {
    const onOpen = () => { setLinkUrl(editor.getEditorState().read(() => readState().link) || ''); setLinkOpen(true); };
    const el = editor.getRootElement();
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'k') { e.preventDefault(); onOpen(); }
      else if (mod && e.shiftKey && k === 'x') { e.preventDefault(); editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough'); }
      else if (mod && e.shiftKey && (e.code === 'Digit8' || k === '*')) { e.preventDefault(); run('ul'); }
      else if (mod && e.shiftKey && (e.code === 'Digit7' || k === '&')) { e.preventDefault(); run('ol'); }
    };
    el?.addEventListener('keydown', onKey);
    return () => el?.removeEventListener('keydown', onKey);
  });

  const run = (key: string) => {
    editor.focus();
    switch (key) {
      case 'bold': case 'italic': case 'underline':
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, key); return;
      case 'strikeThrough':
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough'); return;
      case 'ul':
        editor.dispatchCommand(st.ul ? REMOVE_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND, undefined); return;
      case 'ol':
        editor.dispatchCommand(st.ol ? REMOVE_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined); return;
      case 'indent':
        if (st.inLi) editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined); return;
      case 'outdent':
        if (st.nested) editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined); return;
      case 'link':
        setLinkUrl(st.link || ''); setLinkOpen(true); return;
    }
  };

  const closeLink = () => { setLinkOpen(false); editor.focus(); };
  const applyLink = () => {
    let url = linkUrl.trim();
    setLinkOpen(false);
    editor.focus();
    if (!url) { editor.dispatchCommand(TOGGLE_LINK_COMMAND, null); return; }
    if (!/^(https?:|mailto:)/i.test(url)) url = `https://${url}`;
    const collapsed = editor.getEditorState().read(() => {
      const sel = $getSelection();
      return $isRangeSelection(sel) && sel.isCollapsed();
    });
    if (collapsed && !st.link) {
      // Nothing selected: the link's own address becomes its text.
      editor.update(() => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel)) return;
        const link = $createLinkNode(url, { target: '_blank', rel: 'noopener noreferrer' });
        link.append($createTextNode(url));
        sel.insertNodes([link, $createTextNode(' ')]);
      });
      return;
    }
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, { url, target: '_blank', rel: 'noopener noreferrer' });
  };
  const unlink = () => { setLinkOpen(false); editor.focus(); editor.dispatchCommand(TOGGLE_LINK_COMMAND, null); };

  const on: Record<string, boolean> = {
    bold: st.bold, italic: st.italic, underline: st.underline, strikeThrough: st.strikethrough,
    ul: st.ul, ol: st.ol, link: !!st.link,
  };

  return (
    <>
      <div className="gne-tb" role="toolbar" aria-label="Formatting">
        {BTN.map((b, i) => {
          if (b === '|') return <span key={`d${i}`} className="gne-div" />;
          const active = !!on[b.key];
          const off = disabled || (b.key === 'indent' && !st.inLi) || (b.key === 'outdent' && !st.nested);
          const Icon = b.icon;
          return (
            <IconTip key={b.key} label={b.title} side="top">
              <button
                type="button"
                className="gne-btn"
                aria-label={b.title}
                aria-pressed={active}
                data-active={active}
                disabled={off}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(b.key)}
              >
                <Icon size={14} strokeWidth={active ? 2.1 : 1.75} />
              </button>
            </IconTip>
          );
        })}
        {extra && (
          <>
            <span className="gne-div" />
            {extra}
          </>
        )}
      </div>
      {linkOpen && (
        <div className="gne-pop">
          <LinkIcon size={13} color="#8B8F9E" />
          <input
            autoFocus
            value={linkUrl}
            placeholder="Paste or type a link…"
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeLink(); }
            }}
          />
          {st.link && (
            <IconTip label="Remove link" side="top">
              <button type="button" className="gne-btn" aria-label="Remove link" onMouseDown={(e) => e.preventDefault()} onClick={unlink}>
                <Unlink size={13} />
              </button>
            </IconTip>
          )}
          <button type="button" className="gne-apply" onMouseDown={(e) => e.preventDefault()} onClick={applyLink}>Apply</button>
        </div>
      )}
    </>
  );
}

/** Tab nests list items; "* ", "- " and "1. " at the start of a line start a list. */
function ShortcutsPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => mergeRegister(
    // Command handlers run inside an update, so $ functions are read directly.
    editor.registerCommand(KEY_TAB_COMMAND, (e: KeyboardEvent) => {
      if (!readState().inLi) return false;
      e.preventDefault();
      editor.dispatchCommand(e.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND, undefined);
      return true;
    }, COMMAND_PRIORITY_LOW),
    editor.registerCommand(KEY_SPACE_COMMAND, (e: KeyboardEvent) => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel) || !sel.isCollapsed()) return false;
      const block = sel.anchor.getNode().getTopLevelElement();
      if (!$isParagraphNode(block)) return false;
      const text = block.getTextContent();
      if (sel.anchor.offset !== text.length || !sel.anchor.getNode().is(block.getFirstChild())) return false;
      const kind = text === '*' || text === '-' ? 'ul' : /^1[.)]$/.test(text) ? 'ol' : null;
      if (!kind) return false;
      block.getFirstChild()?.remove();
      block.select(0, 0);
      e.preventDefault();
      editor.dispatchCommand(kind === 'ul' ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined);
      return true;
    }, COMMAND_PRIORITY_LOW),
  ), [editor]);
  return null;
}

// Inner component with Lexical context access
function BodyEditorInner({
  value,
  onChange,
  placeholder,
  className,
  minHeight = '200px',
  maxHeight = '400px',
  disabled,
  onFocus,
  hideToolbar,
  toolbarExtra,
  ariaLabel,
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
      if (HTML_TAG_REGEX.test(value)) {
        loadHtmlIntoEditor(editor, value);
      } else {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const lines = value.split('\n');
          lines.forEach(line => {
            const paragraph = $createParagraphNode();
            const nodes = parseTemplateToNodes(line);
            nodes.forEach(node => paragraph.append(node));
            root.append(paragraph);
          });
        });
      }
      lastValueRef.current = value;
    }
  }, [editor, value]);

  // Handle external value changes
  useEffect(() => {
    if (isFocused) return;
    if (value === lastValueRef.current) return;

    if (HTML_TAG_REGEX.test(value)) {
      loadHtmlIntoEditor(editor, value);
    } else {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const lines = value.split('\n');
        lines.forEach(line => {
          const paragraph = $createParagraphNode();
          const nodes = parseTemplateToNodes(line);
          nodes.forEach(node => paragraph.append(node));
          root.append(paragraph);
        });
      });
    }
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
    <div className={cn('gne', className)} data-disabled={disabled}>
      <style>{FORMATTED_TEXT_STYLES}</style>
      {!hideToolbar && <FormatToolbar extra={toolbarExtra} disabled={disabled} />}
      <div className="relative overflow-y-auto" style={{ minHeight, maxHeight }}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="lexical-root gne-ed"
              style={{ minHeight }}
              onFocus={handleFocus}
              onBlur={handleBlur}
              disabled={disabled}
              aria-label={ariaLabel}
            />
          }
          placeholder={
            <div className="gne-ph" style={{ top: 14 }}>
              {placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <ShortcutsPlugin />
        <PlaceholderPlugin />
        <OnChangePlugin onChange={handleChange} />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <AutoLinkPlugin />
      </div>
      {!hideToolbar && !disabled && (
        <div className="gne-hint" aria-hidden="true">
          <span><span className="gne-kbd">*</span>bullets</span>
          <span><span className="gne-kbd">1.</span>numbered</span>
          <span><span className="gne-kbd">Tab</span>nest</span>
          <span><span className="gne-kbd">{isMac ? '⌘K' : 'Ctrl+K'}</span>link</span>
        </div>
      )}
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
      insertHtml: (html: string) => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        editor.update(() => {
          const dom = new DOMParser().parseFromString(html, 'text/html');
          const nodes = $generateNodesFromDOM(editor, dom);
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes(nodes);
          } else {
            const root = $getRoot();
            nodes.forEach((n) => root.append(n));
          }
        });
      },
      focus: () => {
        editorRef.current?.focus();
      },
      exec: (command: BodyEditorCommand, arg?: string) => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        switch (command) {
          case 'bold':
          case 'italic':
          case 'underline':
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, command);
            break;
          case 'ul':
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
            break;
          case 'ol':
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
            break;
          case 'quote':
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createQuoteNode());
            });
            break;
          case 'link':
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, arg ? arg : null);
            break;
        }
      },
    }));

    const initialConfig = {
      namespace: 'BodyTemplateEditor',
      theme: lexicalTheme,
      nodes: [PlaceholderNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, HeadingNode, QuoteNode],
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
