/**
 * PlaceholderPlugin - Handles placeholder insertion and transformation
 * 
 * This plugin:
 * - Detects when user types {{placeholder}} and converts to PlaceholderNode
 * - Provides insertPlaceholder function for UI-triggered insertion
 */
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $isNodeSelection,
  $isElementNode,
  $isTextNode,
  TextNode,
  $createTextNode,
  $createParagraphNode,
  $getRoot,
  COMMAND_PRIORITY_LOW,
  type LexicalEditor,
  KEY_ENTER_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type LexicalNode,
  type RangeSelection,
} from 'lexical';
import { $createPlaceholderNode, $isPlaceholderNode } from '../nodes/PlaceholderNode';
import { normalizePlaceholderKey } from '@/utils/templateUtils';

interface PlaceholderPluginProps {
  singleLine?: boolean;
}

const PLACEHOLDER_PATTERN = /\{\{([^}]+)\}\}/;

export function PlaceholderPlugin({ singleLine = false }: PlaceholderPluginProps): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Listen for text changes and convert {{placeholder}} patterns
    const removeTextTransform = editor.registerNodeTransform(TextNode, (node) => {
      const text = node.getTextContent();
      const match = PLACEHOLDER_PATTERN.exec(text);
      
      if (match) {
        // Only move the caret when it was in this text (typing "}}"), never for text
        // elsewhere (a paste, a loaded template).
        const sel = $getSelection();
        const caretHere = $isRangeSelection(sel) && sel.isCollapsed() && sel.anchor.key === node.getKey();
        const place = (n: TextNode, offset: number) => { if (caretHere) n.select(offset, offset); };
        const [fullMatch, placeholderKey] = match;
        const matchIndex = match.index;
        
        // Split the text node around the placeholder
        const before = text.slice(0, matchIndex);
        const after = text.slice(matchIndex + fullMatch.length);
        
        // Create the placeholder node with normalized key
        const normalizedKey = normalizePlaceholderKey(placeholderKey);
        const placeholderNode = $createPlaceholderNode(normalizedKey);
        
        // Replace the text node with: [before text] [placeholder] [after text]
        if (before) {
          node.setTextContent(before);
          node.insertAfter(placeholderNode);
          if (after) {
            const afterNode = $createTextNode(after);
            placeholderNode.insertAfter(afterNode);
            // Move selection to after the placeholder
            place(afterNode, 0);
          } else {
            // Add space after placeholder for cursor anchoring
            const spaceNode = $createTextNode(' ');
            placeholderNode.insertAfter(spaceNode);
            place(spaceNode, 1);
          }
        } else {
          // Placeholder is at the start
          node.replace(placeholderNode);
          if (after) {
            const afterNode = $createTextNode(after);
            placeholderNode.insertAfter(afterNode);
            place(afterNode, 0);
          } else {
            const spaceNode = $createTextNode(' ');
            placeholderNode.insertAfter(spaceNode);
            place(spaceNode, 1);
          }
        }
      }
    });

    return () => {
      removeTextTransform();
    };
  }, [editor]);

  useEffect(() => {
    // For single-line editor (subject), prevent Enter key
    if (!singleLine) return;

    const removeEnterHandler = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (event) {
          event.preventDefault();
        }
        return true; // Handled, don't propagate
      },
      COMMAND_PRIORITY_LOW
    );

    return () => {
      removeEnterHandler();
    };
  }, [editor, singleLine]);

  // Backspace and Delete next to a pill remove the whole pill, from any caret position:
  // a text point beside it, an element point (a line ending or starting with a pill),
  // or the pill itself selected (2026-11-06).
  useEffect(() => {
    const removeSelected = () => {
      const sel = $getSelection();
      if (!$isNodeSelection(sel)) return false;
      const pills = sel.getNodes().filter($isPlaceholderNode);
      if (!pills.length) return false;
      pills[0].selectPrevious();
      pills.forEach((n) => n.remove());
      return true;
    };
    const neighbour = (sel: RangeSelection, backward: boolean): LexicalNode | null => {
      const { anchor } = sel;
      const node = anchor.getNode();
      if (anchor.type === 'text' && $isTextNode(node)) {
        if (backward) return anchor.offset === 0 ? node.getPreviousSibling() : null;
        return anchor.offset === node.getTextContentSize() ? node.getNextSibling() : null;
      }
      if ($isElementNode(node)) return node.getChildAtIndex(backward ? anchor.offset - 1 : anchor.offset);
      return null;
    };
    const handler = (backward: boolean) => (event: KeyboardEvent | null) => {
      if (removeSelected()) {
        event?.preventDefault();
        return true;
      }
      const sel = $getSelection();
      if (!$isRangeSelection(sel) || !sel.isCollapsed()) return false;
      const pill = neighbour(sel, backward);
      if (!$isPlaceholderNode(pill)) return false;
      event?.preventDefault();
      // The caret stays where it was: before the next node, or after the one before.
      if (backward) pill.selectPrevious();
      else pill.selectNext(0, 0);
      pill.remove();
      return true;
    };
    const removeBackspaceHandler = editor.registerCommand(KEY_BACKSPACE_COMMAND, handler(true), COMMAND_PRIORITY_LOW);
    const removeDeleteHandler = editor.registerCommand(KEY_DELETE_COMMAND, handler(false), COMMAND_PRIORITY_LOW);
    return () => {
      removeBackspaceHandler();
      removeDeleteHandler();
    };
  }, [editor]);

  return null;
}

/**
 * Put a pill where the caret is, or at the end of the text when the box was never
 * clicked into, followed by a space for the caret (2026-11-06). Call inside an update.
 */
export function $insertPill(placeholderKey: string) {
  const pill = $createPlaceholderNode(normalizePlaceholderKey(placeholderKey));
  const space = $createTextNode(' ');
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    selection.removeText();
    selection.insertNodes([pill, space]);
  } else {
    const root = $getRoot();
    const last = root.getLastChild();
    const line = $isElementNode(last) ? last : $createParagraphNode();
    if (line !== last) root.append(line);
    // Never glued to the last word: "open {{…}}", not "open{{…}}".
    const text = line.getTextContent();
    if (text && !/\s$/.test(text)) line.append($createTextNode(' '));
    line.append(pill, space);
  }
  space.select(1, 1);
}

/** Inserts a pill and gives the text its focus back. */
export function insertPillInto(editor: LexicalEditor, placeholderKey: string) {
  editor.update(() => $insertPill(placeholderKey), { onUpdate: () => editor.focus() });
}

/**
 * Hook to get placeholder insertion function
 * The placeholderKey is automatically normalized (braces stripped)
 */
export function useInsertPlaceholder() {
  const [editor] = useLexicalComposerContext();
  return (placeholderKey: string) => insertPillInto(editor, placeholderKey);
}
