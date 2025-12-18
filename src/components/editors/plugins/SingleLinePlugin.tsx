/**
 * SingleLinePlugin - Enforces single-line behavior for subject editors
 * 
 * This plugin:
 * - Prevents Enter key from creating new lines
 * - Removes any paragraph breaks that might be pasted
 * - Keeps all content in a single paragraph
 */
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getRoot,
  $createParagraphNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  PASTE_COMMAND,
  ParagraphNode,
} from 'lexical';

export function SingleLinePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Prevent Enter key
    const removeEnterHandler = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (event) {
          event.preventDefault();
        }
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    // Handle paste - strip newlines and merge paragraphs
    const removePasteHandler = editor.registerCommand(
      PASTE_COMMAND,
      () => {
        // Let the default paste happen, then clean up
        setTimeout(() => {
          editor.update(() => {
            const root = $getRoot();
            const children = root.getChildren();
            
            if (children.length > 1) {
              // Multiple paragraphs - merge them into one
              const firstParagraph = children[0];
              
              if (firstParagraph instanceof ParagraphNode) {
                for (let i = 1; i < children.length; i++) {
                  const child = children[i];
                  if (child instanceof ParagraphNode) {
                    // Move all children from this paragraph to the first
                    const paragraphChildren = child.getChildren();
                    paragraphChildren.forEach(grandChild => {
                      firstParagraph.append(grandChild);
                    });
                    child.remove();
                  }
                }
              }
            }
          });
        }, 0);
        
        return false; // Don't block the paste
      },
      COMMAND_PRIORITY_HIGH
    );

    return () => {
      removeEnterHandler();
      removePasteHandler();
    };
  }, [editor]);

  return null;
}
