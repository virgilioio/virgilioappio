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
  TextNode,
  $createTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
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
            afterNode.select(0, 0);
          } else {
            // Add space after placeholder for cursor anchoring
            const spaceNode = $createTextNode(' ');
            placeholderNode.insertAfter(spaceNode);
            spaceNode.select(1, 1);
          }
        } else {
          // Placeholder is at the start
          node.replace(placeholderNode);
          if (after) {
            const afterNode = $createTextNode(after);
            placeholderNode.insertAfter(afterNode);
            afterNode.select(0, 0);
          } else {
            const spaceNode = $createTextNode(' ');
            placeholderNode.insertAfter(spaceNode);
            spaceNode.select(1, 1);
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

  // Handle backspace/delete for PlaceholderNodes
  useEffect(() => {
    // Handle backspace when cursor is right after a PlaceholderNode
    const removeBackspaceHandler = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event: KeyboardEvent | null) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }

        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();
        
        // Check if we're at the start of a text node following a placeholder
        if (anchor.offset === 0) {
          const previousSibling = anchorNode.getPreviousSibling();
          if ($isPlaceholderNode(previousSibling)) {
            event?.preventDefault();
            previousSibling.remove();
            return true;
          }
        }
        
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    // Handle delete when cursor is right before a PlaceholderNode
    const removeDeleteHandler = editor.registerCommand(
      KEY_DELETE_COMMAND,
      (event: KeyboardEvent | null) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }

        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();
        const textLength = anchorNode.getTextContentSize();
        
        // Check if we're at the end of a text node before a placeholder
        if (anchor.offset === textLength) {
          const nextSibling = anchorNode.getNextSibling();
          if ($isPlaceholderNode(nextSibling)) {
            event?.preventDefault();
            nextSibling.remove();
            return true;
          }
        }
        
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    return () => {
      removeBackspaceHandler();
      removeDeleteHandler();
    };
  }, [editor]);

  return null;
}

/**
 * Hook to get placeholder insertion function
 * The placeholderKey is automatically normalized (braces stripped)
 */
export function useInsertPlaceholder() {
  const [editor] = useLexicalComposerContext();

  return (placeholderKey: string) => {
    editor.update(() => {
      const selection = $getSelection();
      
      if ($isRangeSelection(selection)) {
        // Delete any selected content first
        selection.removeText();
        
        // Normalize the key before creating the node
        const normalizedKey = normalizePlaceholderKey(placeholderKey);
        
        // Insert placeholder and space
        const placeholderNode = $createPlaceholderNode(normalizedKey);
        const spaceNode = $createTextNode(' ');
        
        selection.insertNodes([placeholderNode, spaceNode]);
        
        // Move cursor after the space
        spaceNode.select(1, 1);
      }
    });
  };
}
