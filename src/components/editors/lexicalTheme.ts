/**
 * Lexical Theme Configuration
 * Matches GoGio design system for consistent styling
 */
import type { EditorThemeClasses } from 'lexical';

export const lexicalTheme: EditorThemeClasses = {
  root: 'lexical-root',
  paragraph: 'lexical-paragraph',
  heading: {
    h1: 'lexical-heading-h1',
    h2: 'lexical-heading-h2',
    h3: 'lexical-heading-h3',
  },
  text: {
    bold: 'lexical-text-bold',
    italic: 'lexical-text-italic',
    underline: 'lexical-text-underline',
    strikethrough: 'lexical-text-strikethrough',
    code: 'lexical-text-code',
  },
  list: {
    ul: 'lexical-list-ul',
    ol: 'lexical-list-ol',
    listitem: 'lexical-listitem',
    nested: {
      listitem: 'lexical-nested-listitem',
    },
  },
  link: 'lexical-link',
  placeholder: 'lexical-placeholder-node',
};

/**
 * CSS styles for Lexical editor components
 * Matches the existing GoGio badge and editor styling
 */
export const LEXICAL_EDITOR_STYLES = `
  /* Base editor root styling */
  .lexical-root {
    outline: none;
    min-height: inherit;
    overflow-wrap: break-word;
  }
  
  .lexical-paragraph {
    margin: 0 0 0.5em 0;
  }
  
  .lexical-paragraph:last-child {
    margin-bottom: 0;
  }
  
  /* Text formatting */
  .lexical-text-bold {
    font-weight: 700;
  }
  
  .lexical-text-italic {
    font-style: italic;
  }
  
  .lexical-text-underline {
    text-decoration: underline;
  }
  
  .lexical-text-strikethrough {
    text-decoration: line-through;
  }
  
  .lexical-text-code {
    font-family: monospace;
    background-color: hsl(var(--muted));
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
  }
  
  /* Headings */
  .lexical-heading-h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 0.75em 0;
  }
  
  .lexical-heading-h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 0.5em 0;
  }
  
  .lexical-heading-h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.5em 0;
  }
  
  /* Lists */
  .lexical-list-ul,
  .lexical-list-ol {
    margin: 0 0 0.5em 0;
    padding-left: 1.5em;
  }
  
  .lexical-list-ul {
    list-style-type: disc;
  }
  
  .lexical-list-ol {
    list-style-type: decimal;
  }
  
  .lexical-listitem {
    margin: 0.25em 0;
  }
  
  /* Links */
  .lexical-link {
    color: hsl(var(--primary));
    text-decoration: underline;
    cursor: pointer;
  }
  
  .lexical-link:hover {
    opacity: 0.8;
  }
  
  /* Placeholder Node (Badge) Styling - matches existing GoGio style */
  .lexical-placeholder-badge {
    background-color: rgb(168 85 247 / 0.15);
    color: rgb(147 51 234);
    padding: 2px 8px;
    border-radius: 6px;
    font-weight: 500;
    font-size: 0.875em;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    margin: 0 2px;
    max-width: 100%;
    user-select: none;
    cursor: default;
    border: 1px solid rgb(168 85 247 / 0.4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
  }

  /* Tighter pill inside the single-line subject input */
  .lexical-subject-editor .lexical-placeholder-badge {
    font-size: 12px;
    padding: 1px 7px;
  }
  
  .dark .lexical-placeholder-badge {
    background-color: rgb(168 85 247 / 0.2);
    color: rgb(192 132 252);
    border-color: rgb(168 85 247 / 0.5);
  }
  
  .lexical-placeholder-badge:hover {
    background-color: rgb(168 85 247 / 0.25);
    border-color: rgb(168 85 247 / 0.6);
  }
  
  /* Subject editor specific styling (single line) */
  .lexical-subject-editor {
    white-space: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
  }
  
  .lexical-subject-editor .lexical-paragraph {
    display: inline;
    margin: 0;
  }
  
  /* Empty placeholder text — positioning is owned by each editor's Tailwind classes */
  .lexical-editor-placeholder {
    color: hsl(var(--muted-foreground));
    pointer-events: none;
    position: absolute;
    font-size: 0.875rem;
  }

  /* Single-line Subject: ellipsize long placeholder text */
  .lexical-subject-editor ~ .lexical-editor-placeholder,
  .lexical-subject-editor + .lexical-editor-placeholder {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(100% - 1.5rem);
  }
`;
