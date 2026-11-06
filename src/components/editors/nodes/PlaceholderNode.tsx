/**
 * PlaceholderNode - Lexical Decorator Node for {{placeholder}} tokens
 * 
 * This node represents a placeholder as an atomic, inline entity.
 * It renders as a purple badge and handles copy/paste, serialization,
 * and cursor navigation correctly.
 */
import {
  DecoratorNode,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
  $applyNodeReplacement,
  LexicalEditor,
} from 'lexical';
import { ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { $getNodeByKey, COMMAND_PRIORITY_LOW, KEY_ENTER_COMMAND } from 'lexical';
import { Check, Trash2 } from 'lucide-react';
import { normalizePlaceholderKey } from '@/utils/templateUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PillVariablesContext } from '../placeholderMenu';

export type SerializedPlaceholderNode = Spread<
  {
    placeholderKey: string;
  },
  SerializedLexicalNode
>;

/**
 * A variable pill (2026-11-06): one unit. A click or the arrow keys select it (a
 * ring), Backspace or Delete removes it, and a click or Enter on a selected pill
 * opens a menu to swap it for another variable or remove it.
 */
function PlaceholderComponent({ placeholderKey, nodeKey }: { placeholderKey: string; nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const editable = useLexicalEditable();
  const [selected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const variables = useContext(PillVariablesContext);
  const [open, setOpen] = useState(false);

  // Enter on a selected pill opens its menu.
  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (e: KeyboardEvent | null) => {
          if (!selected || !editable) return false;
          e?.preventDefault();
          setOpen(true);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor, selected, editable],
  );

  const groups = useMemo(() => {
    const out: { group: string; items: typeof variables }[] = [];
    for (const v of variables) {
      const g = v.group ?? '';
      let bucket = out.find((x) => x.group === g);
      if (!bucket) out.push((bucket = { group: g, items: [] }));
      bucket.items.push(v);
    }
    return out;
  }, [variables]);
  const known = variables.some((v) => v.key === placeholderKey);
  const label = variables.find((v) => v.key === placeholderKey)?.label;

  const swap = (key: string) =>
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isPlaceholderNode(node)) return;
      if (key !== node.getPlaceholderKey()) node.setPlaceholderKey(key);
      node.selectNext(0, 0);
    });
  const remove = () =>
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!node) return;
      node.selectPrevious();
      node.remove();
    });

  const pill = (
    <span
      className="lexical-placeholder-badge"
      data-placeholder={placeholderKey}
      data-selected={selected || undefined}
      data-open={open || undefined}
      contentEditable={false}
      suppressContentEditableWarning
      aria-label={label ? `Variable: ${label}` : `Variable ${placeholderKey}`}
      onMouseDown={(e) => {
        if (!editable) return;
        // Select the pill itself, not a caret beside it.
        e.preventDefault();
        if (!e.shiftKey) clearSelection();
        setSelected(true);
      }}
    >
      {`{{${placeholderKey}}}`}
    </span>
  );
  if (!editable) return pill;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>{pill}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-[260px] max-h-[min(340px,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto"
        onCloseAutoFocus={(e) => {
          // Back to the text, with the caret where the menu left it.
          e.preventDefault();
          editor.focus();
        }}
      >
        {!known && (
          <>
            <DropdownMenuLabel>Not a variable this email fills in</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {groups.map((g, gi) => (
          <div key={g.group || gi}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{g.group ? g.group : 'Change to'}</DropdownMenuLabel>
            {g.items.map((v) => (
              <DropdownMenuItem key={v.key} onSelect={() => swap(v.key)}>
                <span className="min-w-0 flex-1 truncate">{v.label}</span>
                {v.key === placeholderKey && (
                  <span className="gio-mrow-check" aria-hidden>
                    <Check />
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem data-danger onSelect={remove}>
          <Trash2 />
          <span className="min-w-0 flex-1 truncate">Remove</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export class PlaceholderNode extends DecoratorNode<ReactNode> {
  __placeholderKey: string;

  static getType(): string {
    return 'placeholder';
  }

  static clone(node: PlaceholderNode): PlaceholderNode {
    return new PlaceholderNode(node.__placeholderKey, node.__key);
  }

  constructor(placeholderKey: string, key?: NodeKey) {
    super(key);
    // Always normalize the key to strip any accidental braces
    this.__placeholderKey = normalizePlaceholderKey(placeholderKey);
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'lexical-placeholder-wrapper';
    return span;
  }

  updateDOM(): false {
    return false;
  }

  getPlaceholderKey(): string {
    return this.__placeholderKey;
  }

  setPlaceholderKey(key: string): void {
    const writable = this.getWritable();
    writable.__placeholderKey = normalizePlaceholderKey(key);
  }

  // Export to DOM (for HTML output)
  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const element = document.createElement('span');
    element.className = 'lexical-placeholder-badge';
    element.setAttribute('data-placeholder', this.__placeholderKey);
    element.setAttribute('contenteditable', 'false');
    element.textContent = `{{${this.__placeholderKey}}}`;
    return { element };
  }

  // Import from DOM (for HTML parsing)
  static importDOM(): DOMConversionMap | null {
    return {
      span: (node: HTMLElement) => {
        // Handle existing placeholder badges
        if (node.classList.contains('placeholder-badge') || 
            node.classList.contains('placeholder-input-badge') ||
            node.classList.contains('lexical-placeholder-badge')) {
          const placeholder = node.getAttribute('data-placeholder');
          if (placeholder) {
            return {
              conversion: (element: HTMLElement): DOMConversionOutput | null => {
                const key = element.getAttribute('data-placeholder');
                if (key) {
                  // Normalize key when importing
                  return { node: $createPlaceholderNode(normalizePlaceholderKey(key)) };
                }
                return null;
              },
              priority: 1,
            };
          }
        }
        return null;
      },
    };
  }

  // Serialize to JSON
  exportJSON(): SerializedPlaceholderNode {
    return {
      type: 'placeholder',
      placeholderKey: this.__placeholderKey,
      version: 1,
    };
  }

  // Deserialize from JSON
  static importJSON(serializedNode: SerializedPlaceholderNode): PlaceholderNode {
    // Normalize key when deserializing
    return $createPlaceholderNode(normalizePlaceholderKey(serializedNode.placeholderKey));
  }

  // For copy/paste - export as the template string
  getTextContent(): string {
    return `{{${this.__placeholderKey}}}`;
  }

  // This is a decorator node - renders React component
  decorate(): ReactNode {
    return <PlaceholderComponent placeholderKey={this.__placeholderKey} nodeKey={this.__key} />;
  }

  // Inline and atomic: the caret moves around it, never into it. Not isolated, so the
  // editor's own Backspace, Delete and arrow keys reach it (2026-11-06; isolated pills
  // couldn't be removed from most caret positions).
  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }
}

export function $createPlaceholderNode(placeholderKey: string): PlaceholderNode {
  // Normalize on creation to ensure clean keys
  return $applyNodeReplacement(new PlaceholderNode(normalizePlaceholderKey(placeholderKey)));
}

export function $isPlaceholderNode(
  node: LexicalNode | null | undefined
): node is PlaceholderNode {
  return node instanceof PlaceholderNode;
}
