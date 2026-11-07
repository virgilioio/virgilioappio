// Lexical-based template editors
export { SubjectTemplateEditor } from './SubjectTemplateEditor';
export type { SubjectTemplateEditorProps, SubjectTemplateEditorHandle } from './SubjectTemplateEditor';

export { BodyTemplateEditor } from './BodyTemplateEditor';
export type { BodyTemplateEditorProps, BodyTemplateEditorHandle, BodyEditorCommand } from './BodyTemplateEditor';

// Re-export utilities for external use
export { parseTemplateToNodes, editorStateToTemplateString } from './utils/placeholderLexicalUtils';

// The in-editor variable picker and Preview (shared by every email template editor)
export { VariableMenu } from './VariableMenu';
export { TemplatePreview, PreviewToggle } from './TemplatePreview';
