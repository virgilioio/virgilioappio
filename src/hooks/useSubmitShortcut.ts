import { useCallback } from 'react';

interface UseSubmitShortcutOptions {
  disabled?: boolean;
}

/**
 * Hook that returns a keyboard event handler for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) submission.
 * 
 * @param onSubmit - Function to call when the shortcut is triggered
 * @param options - Configuration options
 * @param options.disabled - If true, the shortcut will not trigger the submit
 * 
 * @example
 * const handleKeyDown = useSubmitShortcut(handleSubmit, { disabled: !isValid });
 * <Textarea onKeyDown={handleKeyDown} />
 */
export function useSubmitShortcut(
  onSubmit: () => void,
  options: UseSubmitShortcutOptions = {}
) {
  const { disabled = false } = options;

  return useCallback((e: React.KeyboardEvent) => {
    // Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) {
        onSubmit();
      }
    }
  }, [onSubmit, disabled]);
}
