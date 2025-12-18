/**
 * OnChangePlugin - Handles editor state changes
 * 
 * Reports changes to parent component as both:
 * - Template string (for storage)
 * - Editor state JSON (for potential future use)
 */
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, ParagraphNode, TextNode } from 'lexical';
import { $isPlaceholderNode } from '../nodes/PlaceholderNode';

interface OnChangePluginProps {
  onChange: (templateString: string) => void;
  singleLine?: boolean;
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
            let paragraphContent = '';
            const paragraphChildren = child.getChildren();
            
            paragraphChildren.forEach(node => {
              if ($isPlaceholderNode(node)) {
                paragraphContent += `{{${node.getPlaceholderKey()}}}`;
              } else if (node instanceof TextNode) {
                paragraphContent += node.getTextContent();
              } else {
                paragraphContent += node.getTextContent();
              }
            });
            
            paragraphStrings.push(paragraphContent);
          }
        });
        
        // For single line, join without newlines
        // For body, join with newlines
        const output = singleLine 
          ? paragraphStrings.join(' ')
          : paragraphStrings.join('\n');
        
        onChange(output);
      });
    });
  }, [editor, onChange, singleLine]);

  return null;
}
