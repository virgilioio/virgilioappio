import { createContext, useContext, useState, ReactNode } from 'react'
import { BulkUploadOptions } from '@/hooks/useBulkCandidateUpload'

interface BulkUploadContextType {
  isUploadActive: boolean
  isMinimized: boolean
  files: File[]
  options: BulkUploadOptions | null
  startUpload: (files: File[], options: BulkUploadOptions) => void
  closeUpload: () => void
  setMinimized: (minimized: boolean) => void
}

const BulkUploadContext = createContext<BulkUploadContextType | undefined>(undefined)

export function BulkUploadProvider({ children }: { children: ReactNode }) {
  const [isUploadActive, setIsUploadActive] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [options, setOptions] = useState<BulkUploadOptions | null>(null)

  const startUpload = (newFiles: File[], uploadOptions: BulkUploadOptions) => {
    // Force a reset by briefly setting isUploadActive to false
    setIsUploadActive(false)
    setFiles([])
    setOptions(null)
    
    // Then set the new upload data
    setTimeout(() => {
      setFiles(newFiles)
      setOptions(uploadOptions)
      setIsUploadActive(true)
      setIsMinimized(false)
    }, 0)
  }

  const closeUpload = () => {
    setIsUploadActive(false)
    setIsMinimized(false)
    setFiles([])
    setOptions(null)
  }

  const setMinimized = (minimized: boolean) => {
    setIsMinimized(minimized)
  }

  return (
    <BulkUploadContext.Provider
      value={{
        isUploadActive,
        isMinimized,
        files,
        options,
        startUpload,
        closeUpload,
        setMinimized,
      }}
    >
      {children}
    </BulkUploadContext.Provider>
  )
}

export function useBulkUploadContext() {
  const context = useContext(BulkUploadContext)
  if (!context) {
    throw new Error('useBulkUploadContext must be used within BulkUploadProvider')
  }
  return context
}
