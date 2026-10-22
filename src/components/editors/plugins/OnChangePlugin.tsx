/**
 * OnChangePlugin - Handles editor state changes
 * 
 * Reports changes to parent component as both:
 * - Template string (for storage)
 * - Editor state JSON (for potential future use)
 */
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $isLineBreakNode, $isParagraphNode, TextNode, ElementNode, type LexicalNode } from 'lexical';
import { $isLinkNode } from '@lexical/link';
import { $isListNode, $isListItemNode, type ListNode } from '@lexical/list';
import { $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import { $isPlaceholderNode } from '../nodes/PlaceholderNode';

interface OnChangePluginProps {
  onChange: (templateString: string) => void;
  singleLine?: boolean;
}

const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function serializeNodes(nodes: LexicalNode[], html: boolean): string {
  let content = '';
  nodes.forEach(node => {
    if ($isPlaceholderNode(node)) {
      content += `{{${node.getPlaceholderKey()}}}`;
    } else if ($isLinkNode(node)) {
      const url = node.getURL();
      const linkText = serializeNodes(node.getChildren(), html);
      content += `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText || url}</a>`;
    } else if (node instanceof TextNode) {
      let text = html ? escapeHtml(node.getTextContent()) : node.getTextContent();
      if (node.hasFormat('bold')) text = `<strong>${text}</strong>`;
      if (node.hasFormat('italic')) text = `<em>${text}</em>`;
      if (node.hasFormat('underline')) text = `<u>${text}</u>`;
      if (html && node.hasFormat('strikethrough')) text = `<s>${text}</s>`;
      content += text;
    } else if (html && $isLineBreakNode(node)) {
      content += '<br>';
    } else if (node instanceof ElementNode) {
      content += serializeNodes(node.getChildren(), html);
    } else {
      content += node.getTextContent();
    }
  });
  return content;
}

/** A list as HTML; Lexical keeps a nested list in an item of its own, HTML puts it inside the item before. */
function serializeList(list: ListNode): string {
  const tag = list.getListType() === 'number' ? 'ol' : 'ul';
  const items: string[] = [];
  list.getChildren().forEach(item => {
    if (!$isListItemNode(item)) return;
    const kids = item.getChildren();
    const nested = kids.filter($isListNode).map(serializeList).join('');
    const own = serializeNodes(kids.filter(k => !$isListNode(k)), true);
    if (!own && nested && items.length) items[items.length - 1] += nested;
    else items.push(own + nested);
  });
  return `<${tag}>${items.map(i => `<li>${i}</li>`).join('')}</${tag}>`;
}

/** Paragraphs, headings, quotes and lists, as stored for an email body. */
function serializeBlock(block: LexicalNode): string {
  if ($isListNode(block)) return serializeList(block);
  if ($isHeadingNode(block)) return `<${block.getTag()}>${serializeNodes(block.getChildren(), true)}</${block.getTag()}>`;
  if ($isQuoteNode(block)) return `<blockquote>${serializeNodes(block.getChildren(), true)}</blockquote>`;
  if ($isParagraphNode(block)) return `<p>${serializeNodes(block.getChildren(), true)}</p>`;
  return '';
}

export function OnChangePlugin({ onChange, singleLine = false }: OnChangePluginProps): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const children = $getRoot().getChildren();
        const output = singleLine
          ? children.filter($isParagraphNode).map(p => serializeNodes(p.getChildren(), false)).join(' ')
          : children.map(serializeBlock).join('');
        onChange(output);
      });
    });
  }, [editor, onChange, singleLine]);

  return null;
}
