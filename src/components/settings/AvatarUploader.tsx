
import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Camera } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { ImageCropDialog } from './ImageCropDialog'

interface AvatarUploaderProps {
  avatarUrl?: string | null
  firstName?: string | null
  lastName?: string | null
  userEmail?: string
  isLoading: boolean
  onUpload: (file: File) => Promise<void>
}

export function AvatarUploader({ 
  avatarUrl, 
  firstName, 
  lastName, 
  userEmail, 
  isLoading, 
  onUpload 
}: AvatarUploaderProps) {
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('')
  const [selectedFileName, setSelectedFileName] = useState<string>('')

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0) || ''
    const last = lastName?.charAt(0) || ''
    return (first + last).toUpperCase() || userEmail?.charAt(0).toUpperCase() || 'U'
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select a valid image file.',
        variant: 'destructive'
      })
      return
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'File size must be less than 5MB.',
        variant: 'destructive'
      })
      return
    }

    // Create preview URL and open crop dialog
    const imageUrl = URL.createObjectURL(file)
    setSelectedImageUrl(imageUrl)
    setSelectedFileName(file.name)
    setCropDialogOpen(true)

    // Reset input
    event.target.value = ''
  }

  const handleCropComplete = async (croppedFile: File) => {
    try {
      await onUpload(croppedFile)
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      // Clean up the temporary URL
      if (selectedImageUrl) {
        URL.revokeObjectURL(selectedImageUrl)
        setSelectedImageUrl('')
      }
    }
  }

  const handleCropDialogClose = () => {
    setCropDialogOpen(false)
    // Clean up the temporary URL
    if (selectedImageUrl) {
      URL.revokeObjectURL(selectedImageUrl)
      setSelectedImageUrl('')
    }
  }

  const handleButtonClick = () => {
    const input = document.getElementById('avatar-upload') as HTMLInputElement
    input?.click()
  }

  return (
    <>
      <div className="flex items-center gap-md">
        <Avatar className="h-20 w-20">
          <AvatarImage src={avatarUrl || ''} />
          <AvatarFallback className="text-lg">
            {getInitials(firstName, lastName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={isLoading}
            onClick={handleButtonClick}
            className="flex items-center gap-2"
          >
            <Camera className="h-4 w-4" />
            Change Avatar
          </Button>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
          <p className="text-xs text-muted-foreground mt-1">
            JPG, PNG or GIF. 5MB max.
          </p>
        </div>
      </div>

      <ImageCropDialog
        isOpen={cropDialogOpen}
        onClose={handleCropDialogClose}
        imageUrl={selectedImageUrl}
        onCropComplete={handleCropComplete}
        fileName={selectedFileName}
      />
    </>
  )
}
