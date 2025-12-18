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
import { ReactNode } from 'react';

export type SerializedPlaceholderNode = Spread<
  {
    placeholderKey: string;
  },
  SerializedLexicalNode
>;

function PlaceholderComponent({ placeholderKey }: { placeholderKey: string }) {
  return (
    <span
      className="lexical-placeholder-badge"
      data-placeholder={placeholderKey}
      contentEditable={false}
      suppressContentEditableWarning
    >
      {`{{${placeholderKey}}}`}
    </span>
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
    this.__placeholderKey = placeholderKey;
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
    writable.__placeholderKey = key;
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
                  return { node: $createPlaceholderNode(key) };
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
    return $createPlaceholderNode(serializedNode.placeholderKey);
  }

  // For copy/paste - export as the template string
  getTextContent(): string {
    return `{{${this.__placeholderKey}}}`;
  }

  // This is a decorator node - renders React component
  decorate(): ReactNode {
    return <PlaceholderComponent placeholderKey={this.__placeholderKey} />;
  }

  // Treat as atomic for selection (cursor moves around it, not into it)
  isInline(): boolean {
    return true;
  }

  // Prevent cursor from entering
  isIsolated(): boolean {
    return true;
  }
}

export function $createPlaceholderNode(placeholderKey: string): PlaceholderNode {
  return $applyNodeReplacement(new PlaceholderNode(placeholderKey));
}

export function $isPlaceholderNode(
  node: LexicalNode | null | undefined
): node is PlaceholderNode {
  return node instanceof PlaceholderNode;
}
