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
} from 'lexical';
import { $createPlaceholderNode } from '../nodes/PlaceholderNode';

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
        
        // Create the placeholder node
        const placeholderNode = $createPlaceholderNode(placeholderKey.trim());
        
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

  return null;
}

/**
 * Hook to get placeholder insertion function
 */
export function useInsertPlaceholder() {
  const [editor] = useLexicalComposerContext();

  return (placeholderKey: string) => {
    editor.update(() => {
      const selection = $getSelection();
      
      if ($isRangeSelection(selection)) {
        // Delete any selected content first
        selection.removeText();
        
        // Insert placeholder and space
        const placeholderNode = $createPlaceholderNode(placeholderKey);
        const spaceNode = $createTextNode(' ');
        
        selection.insertNodes([placeholderNode, spaceNode]);
        
        // Move cursor after the space
        spaceNode.select(1, 1);
      }
    });
  };
}
