/**
 * Lexical Placeholder Utilities
 * 
 * Handles conversion between:
 * - Template strings with {{placeholder}} syntax
 * - Lexical editor state
 * - HTML output (for email sending)
 */
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $insertNodes,
  LexicalEditor,
  LexicalNode,
  ParagraphNode,
  TextNode,
} from 'lexical';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { $createPlaceholderNode, PlaceholderNode, $isPlaceholderNode } from '../nodes/PlaceholderNode';

/**
 * Pattern to match {{placeholder}} tokens in text
 */
const PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g;

/**
 * Parse a template string and create Lexical nodes
 * Converts "Hello {{name}}, welcome!" into [TextNode, PlaceholderNode, TextNode]
 */
export function parseTemplateToNodes(template: string): LexicalNode[] {
  const nodes: LexicalNode[] = [];
  let lastIndex = 0;
  
  const matches = [...template.matchAll(PLACEHOLDER_REGEX)];
  
  for (const match of matches) {
    const [fullMatch, placeholderKey] = match;
    const matchIndex = match.index!;
    
    // Add text before the placeholder
    if (matchIndex > lastIndex) {
      const textBefore = template.slice(lastIndex, matchIndex);
      if (textBefore) {
        nodes.push($createTextNode(textBefore));
      }
    }
    
    // Add the placeholder node
    nodes.push($createPlaceholderNode(placeholderKey.trim()));
    
    lastIndex = matchIndex + fullMatch.length;
  }
  
  // Add remaining text after the last placeholder
  if (lastIndex < template.length) {
    const textAfter = template.slice(lastIndex);
    if (textAfter) {
      nodes.push($createTextNode(textAfter));
    }
  }
  
  return nodes;
}

/**
 * Convert Lexical editor state to template string
 * Traverses all nodes and builds the output string
 */
export function editorStateToTemplateString(editor: LexicalEditor): string {
  let result = '';
  
  editor.getEditorState().read(() => {
    const root = $getRoot();
    const children = root.getChildren();
    
    const processNode = (node: LexicalNode): string => {
      if ($isPlaceholderNode(node)) {
        return `{{${node.getPlaceholderKey()}}}`;
      }
      if (node instanceof TextNode) {
        return node.getTextContent();
      }
      if (node instanceof ParagraphNode) {
        const paragraphChildren = node.getChildren();
        return paragraphChildren.map(processNode).join('');
      }
      // For other nodes, try to get their children
      if ('getChildren' in node && typeof node.getChildren === 'function') {
        const children = (node as { getChildren: () => LexicalNode[] }).getChildren();
        return children.map(processNode).join('');
      }
      return node.getTextContent();
    };
    
    result = children.map((node, index) => {
      const content = processNode(node);
      // Add newlines between paragraphs for body editor (not subject)
      return content;
    }).join('\n');
  });
  
  return result;
}

/**
 * Convert Lexical editor state to HTML (for email sending)
 * Placeholder nodes become {{placeholder}} in the output
 */
export function editorStateToHtml(editor: LexicalEditor): string {
  let html = '';
  
  editor.getEditorState().read(() => {
    html = $generateHtmlFromNodes(editor, null);
  });
  
  // Clean up placeholder wrapper spans and extract just the badge content
  // The HTML export will have the placeholder badge spans from exportDOM
  return html;
}

/**
 * Load a template string into the editor
 * Clears the editor and populates with parsed nodes
 */
export function loadTemplateIntoEditor(editor: LexicalEditor, template: string, singleLine: boolean = false): void {
  editor.update(() => {
    const root = $getRoot();
    root.clear();
    
    if (singleLine) {
      // For subject editor - single paragraph with inline nodes
      const paragraph = $createParagraphNode();
      const nodes = parseTemplateToNodes(template);
      nodes.forEach(node => paragraph.append(node));
      root.append(paragraph);
    } else {
      // For body editor - split by newlines into paragraphs
      const lines = template.split('\n');
      lines.forEach(line => {
        const paragraph = $createParagraphNode();
        const nodes = parseTemplateToNodes(line);
        if (nodes.length > 0) {
          nodes.forEach(node => paragraph.append(node));
        }
        root.append(paragraph);
      });
    }
  });
}

/**
 * Load HTML content into the editor (for body editor loading from DB)
 * Parses HTML and converts existing placeholder badges to PlaceholderNodes
 */
export function loadHtmlIntoEditor(editor: LexicalEditor, html: string): void {
  editor.update(() => {
    const root = $getRoot();
    root.clear();
    
    // First, convert any {{placeholder}} in the HTML to temporary markers
    // Then parse the HTML into nodes
    const parser = new DOMParser();
    const dom = parser.parseFromString(html || '<p></p>', 'text/html');
    
    // Find all existing badge spans and convert them to placeholder markers
    const badges = dom.querySelectorAll('.placeholder-badge, .placeholder-input-badge, .lexical-placeholder-badge');
    badges.forEach(badge => {
      const key = badge.getAttribute('data-placeholder');
      if (key) {
        // Replace the badge with a text marker that we'll convert later
        const textNode = dom.createTextNode(`{{${key}}}`);
        badge.parentNode?.replaceChild(textNode, badge);
      }
    });
    
    // Also find and convert any raw {{placeholder}} patterns that might be in the text
    const walker = dom.createTreeWalker(
      dom.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (PLACEHOLDER_REGEX.test(node.textContent || '')) {
        textNodes.push(node);
      }
    }
    
    // Import the DOM as Lexical nodes
    const nodes = $generateNodesFromDOM(editor, dom);
    
    // For each paragraph, process and convert {{placeholder}} to PlaceholderNodes
    nodes.forEach(node => {
      if (node instanceof ParagraphNode) {
        processAndReplacePlaceholders(node);
      }
      root.append(node);
    });
    
    // If we got no nodes, add an empty paragraph
    if (root.getChildrenSize() === 0) {
      root.append($createParagraphNode());
    }
  });
}

/**
 * Process a paragraph node and convert any text containing {{placeholder}} 
 * into proper PlaceholderNodes
 */
function processAndReplacePlaceholders(paragraph: ParagraphNode): void {
  const children = paragraph.getChildren();
  
  children.forEach(child => {
    if (child instanceof TextNode) {
      const text = child.getTextContent();
      if (PLACEHOLDER_REGEX.test(text)) {
        // This text node contains placeholder patterns
        const nodes = parseTemplateToNodes(text);
        if (nodes.length > 0) {
          // Replace the text node with the parsed nodes
          nodes.forEach((newNode, index) => {
            if (index === 0) {
              child.replace(newNode);
            } else {
              // Insert after previous node
              const prev = nodes[index - 1];
              prev.insertAfter(newNode);
            }
          });
        }
      }
    }
  });
}

/**
 * Insert a placeholder at the current selection
 */
export function insertPlaceholderAtSelection(editor: LexicalEditor, placeholderKey: string): void {
  editor.update(() => {
    const placeholderNode = $createPlaceholderNode(placeholderKey);
    const spaceNode = $createTextNode(' ');
    $insertNodes([placeholderNode, spaceNode]);
  });
}
