import { toast } from '@/hooks/use-toast'

/**
 * Prime the clipboard immediately on user gesture (click).
 * This ensures the browser's clipboard permission is granted
 * before any async work that would expire the user gesture.
 */
export const primeClipboard = async (): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText('Generating link…');
    return true;
  } catch {
    // Fallback
    try {
      const textArea = document.createElement('textarea');
      textArea.value = 'Generating link…';
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textArea);
      return ok;
    } catch {
      return false;
    }
  }
};

export const copyToClipboardSilent = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for mobile/restricted browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textArea);
      return ok;
    } catch (fallbackErr) {
      return false;
    }
  }
};

export const copyToClipboard = async (text: string, successMessage: string = 'Copied to clipboard') => {
  try {
    await navigator.clipboard.writeText(text)
    toast({
      title: 'Success',
      description: successMessage,
    })
  } catch (err) {
    // Fallback for browsers that don't support navigator.clipboard
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      const ok = document.execCommand('copy')
      if (ok) {
        toast({
          title: 'Success',
          description: successMessage,
        })
      } else {
        toast({
          title: 'Error',
          description: 'Failed to copy to clipboard',
          variant: 'destructive'
        })
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive'
      })
    }
    
    document.body.removeChild(textArea)
  }
}
