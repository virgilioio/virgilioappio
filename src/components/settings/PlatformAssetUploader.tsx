
import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Upload, Image, Globe, AlertCircle } from 'lucide-react'
import { usePlatformAssets } from '@/hooks/usePlatformAssets'

interface AssetUploaderProps {
  assetType: 'logo' | 'favicon'
  title: string
  description: string
  acceptedTypes: string
  maxSize: string
  currentAsset?: string
}

function AssetUploader({ assetType, title, description, acceptedTypes, maxSize, currentAsset }: AssetUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadAsset, isUploading } = usePlatformAssets()

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = e.dataTransfer.files
    if (files && files[0]) {
      setSelectedFile(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      setSelectedFile(files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    try {
      await uploadAsset(selectedFile, assetType)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {assetType === 'logo' ? <Image className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Asset Preview */}
        {currentAsset && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Current {assetType}:</Label>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              {assetType === 'logo' ? (
                <img src={currentAsset} alt="Current logo" className="h-8 w-auto" />
              ) : (
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  <span className="text-sm text-muted-foreground">Active favicon</span>
                </div>
              )}
              <Badge variant="secondary">Active</Badge>
            </div>
          </div>
        )}

        {/* File Upload Area */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Upload new {assetType}:</Label>
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="text-center space-y-3">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Drag and drop your {assetType} here, or{' '}
                  <button
                    type="button"
                    onClick={handleButtonClick}
                    className="text-primary hover:underline font-medium"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {acceptedTypes} • Max {maxSize}
                </p>
              </div>
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              accept={acceptedTypes}
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>

        {/* Selected File */}
        {selectedFile && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">{selectedFile.name}</span>
              <Badge variant="outline">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </Badge>
            </div>
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              size="sm"
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PlatformAssetUploader() {
  const { assets, isLoading } = usePlatformAssets()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-48 bg-muted/50 rounded-lg animate-pulse" />
        <div className="h-48 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    )
  }

  const logoAsset = assets.find(asset => asset.asset_type === 'logo')
  const faviconAsset = assets.find(asset => asset.asset_type === 'favicon')

  return (
    <div className="space-y-6">
      <AssetUploader
        assetType="logo"
        title="Platform Logo"
        description="Upload the main platform logo that appears in headers and branding"
        acceptedTypes=".png,.svg"
        maxSize="1MB"
        currentAsset={logoAsset?.file_url}
      />
      
      <AssetUploader
        assetType="favicon"
        title="Platform Favicon"
        description="Upload the favicon that appears in browser tabs"
        acceptedTypes=".png,.ico"
        maxSize="500KB"
        currentAsset={faviconAsset?.file_url}
      />
    </div>
  )
}
