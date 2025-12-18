// Lexical-based template editors
export { SubjectTemplateEditor } from './SubjectTemplateEditor';
export type { SubjectTemplateEditorProps, SubjectTemplateEditorHandle } from './SubjectTemplateEditor';

export { BodyTemplateEditor } from './BodyTemplateEditor';
export type { BodyTemplateEditorProps, BodyTemplateEditorHandle } from './BodyTemplateEditor';

// Re-export utilities for external use
export { parseTemplateToNodes, editorStateToTemplateString } from './utils/placeholderLexicalUtils';
