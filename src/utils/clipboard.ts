import { toast } from '@/hooks/use-toast'

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
      document.execCommand('copy')
      toast({
        title: 'Success',
        description: successMessage,
      })
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