/**
 * OnChangePlugin - Handles editor state changes
 * 
 * Reports changes to parent component as both:
 * - Template string (for storage)
 * - Editor state JSON (for potential future use)
 */
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, ParagraphNode, TextNode, ElementNode } from 'lexical';
import { $isLinkNode, LinkNode } from '@lexical/link';
import { $isPlaceholderNode } from '../nodes/PlaceholderNode';

interface OnChangePluginProps {
  onChange: (templateString: string) => void;
  singleLine?: boolean;
}

function serializeNodes(nodes: ReturnType<ElementNode['getChildren']>): string {
  let content = '';
  nodes.forEach(node => {
    if ($isPlaceholderNode(node)) {
      content += `{{${node.getPlaceholderKey()}}}`;
    } else if ($isLinkNode(node)) {
      const url = node.getURL();
      const linkText = serializeNodes(node.getChildren());
      content += `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText || url}</a>`;
    } else if (node instanceof TextNode) {
      let text = node.getTextContent();
      if (node.hasFormat('bold')) text = `<strong>${text}</strong>`;
      if (node.hasFormat('italic')) text = `<em>${text}</em>`;
      if (node.hasFormat('underline')) text = `<u>${text}</u>`;
      content += text;
    } else if (node instanceof ElementNode) {
      content += serializeNodes(node.getChildren());
    } else {
      content += node.getTextContent();
    }
  });
  return content;
}

export function OnChangePlugin({ onChange, singleLine = false }: OnChangePluginProps): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        
        const paragraphStrings: string[] = [];
        
        children.forEach(child => {
          if (child instanceof ParagraphNode) {
            const content = serializeNodes(child.getChildren());
            paragraphStrings.push(content);
          }
        });
        
        const output = singleLine 
          ? paragraphStrings.join(' ')
          : paragraphStrings.map(p => `<p>${p}</p>`).join('');
        
        onChange(output);
      });
    });
  }, [editor, onChange, singleLine]);

  return null;
}
