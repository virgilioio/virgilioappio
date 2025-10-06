
import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Upload, Image, Globe, AlertCircle, Settings, Save, Loader2, Building2, Briefcase, Users, MessageSquare, Paperclip, FileText, UserCheck, ExternalLink } from 'lucide-react'
import { usePlatformAssets } from '@/hooks/usePlatformAssets'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { EmptyState, type EmptyStateAssetType } from '@/components/ui/empty-state'

interface AssetUploaderProps {
  assetType: 'logo' | 'favicon' | EmptyStateAssetType
  title: string
  description: string
  acceptedTypes: string
  maxSize: string
  currentAsset?: string
  preview?: React.ReactNode
}

function AssetUploader({ assetType, title, description, acceptedTypes, maxSize, currentAsset, preview }: AssetUploaderProps) {
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current Asset Preview */}
          {currentAsset && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current {assetType}:</Label>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {assetType === 'logo' ? (
                  <img src={currentAsset} alt="Current logo" className="h-8 w-auto" />
                ) : assetType === 'favicon' ? (
                  <div className="flex items-center gap-2">
                    <img 
                      src={currentAsset} 
                      alt="Current favicon" 
                      className="h-4 w-4" 
                      onError={(e) => {
                        // Fallback to icon if image fails to load
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        target.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                    <Globe className="h-4 w-4 hidden" />
                    <span className="text-sm text-muted-foreground">Active favicon</span>
                  </div>
                ) : (
                  <img src={currentAsset} alt={`Current ${title}`} className="h-12 w-12 object-contain mx-auto" />
                )}
                <Badge variant="secondary">Active</Badge>
              </div>
            </div>
          )}
          
          {/* Live Preview for empty states */}
          {preview && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Live Preview:</Label>
              <div className="p-3 bg-muted/30 rounded-lg">
                {preview}
              </div>
            </div>
          )}
        </div>

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

function BrowserTitleEditor() {
  const { settings, isLoading, isUpdating, updateSetting, getSetting } = usePlatformSettings()
  const [browserTitle, setBrowserTitle] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize browser title when settings load - only once
  useEffect(() => {
    if (!isInitialized && !isLoading && settings.length > 0) {
      const titleSetting = getSetting('browser_title')
      const initialValue = titleSetting?.setting_value || ''
      console.log('Initializing browser title with:', initialValue)
      setBrowserTitle(initialValue)
      setIsInitialized(true)
    }
  }, [settings, isLoading, getSetting, isInitialized])

  const handleTitleChange = (value: string) => {
    console.log('Browser title changed to:', value)
    setBrowserTitle(value)
    const currentTitle = getSetting('browser_title')?.setting_value || ''
    setHasChanges(value !== currentTitle)
  }

  const handleSave = async () => {
    console.log('Saving browser title:', browserTitle)
    const success = await updateSetting('browser_title', browserTitle)
    if (success) {
      setHasChanges(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading settings...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Browser Tab Title
        </CardTitle>
        <CardDescription>
          Configure the title that appears in browser tabs across the platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="browser-title" className="text-sm font-medium">
            Browser Tab Title
          </Label>
          <div className="flex gap-2">
            <Input
              id="browser-title"
              value={browserTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Enter the title that appears in browser tabs"
              className="flex-1"
              disabled={!isInitialized}
            />
            <Button 
              onClick={handleSave}
              disabled={!hasChanges || isUpdating || !isInitialized}
              size="sm"
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This title will appear in browser tabs across the entire platform
          </p>
        </div>
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
        <div className="h-48 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    )
  }

  const logoAsset = assets.find(asset => asset.asset_type === 'logo' && asset.is_active)
  const faviconAsset = assets.find(asset => asset.asset_type === 'favicon' && asset.is_active)

  // Helper to get current empty state asset
  const getEmptyStateAsset = (type: EmptyStateAssetType) => 
    assets.find(asset => asset.asset_type === type && asset.is_active)

  const emptyStateConfigs = [
    { type: 'empty-state-organizations' as const, label: 'Organizations', description: 'Empty organizations table' },
    { type: 'empty-state-jobs' as const, label: 'Jobs', description: 'Empty jobs table' },
    { type: 'empty-state-candidates' as const, label: 'Candidates', description: 'Empty candidates table' },
    { type: 'empty-state-members' as const, label: 'Members', description: 'Empty members table' },
    { type: 'empty-state-comments' as const, label: 'Comments', description: 'Empty comments section' },
    { type: 'empty-state-attachments' as const, label: 'Attachments', description: 'Empty attachments list' },
    { type: 'empty-state-templates' as const, label: 'Templates', description: 'Empty templates table' },
    { type: 'empty-state-independent-candidates' as const, label: 'Independent Candidates', description: 'Empty independent candidates table' },
    { type: 'empty-state-urls' as const, label: 'URLs', description: 'Empty URLs list' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium mb-4">Platform Assets</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Upload custom assets to personalize your platform appearance.
        </p>
      </div>

      {/* Core Platform Assets */}
      <div>
        <h4 className="text-md font-medium mb-4">Core Assets</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AssetUploader
            assetType="logo"
            title="Platform Logo"
            description="Upload the main platform logo that appears in headers and branding"
            acceptedTypes=".png,.svg,.jpg,.jpeg"
            maxSize="1MB"
            currentAsset={logoAsset?.file_url}
          />
          
          <AssetUploader
            assetType="favicon"
            title="Platform Favicon"
            description="Upload the favicon that appears in browser tabs"
            acceptedTypes=".png,.ico,.jpg,.jpeg"
            maxSize="500KB"
            currentAsset={faviconAsset?.file_url}
          />
        </div>
      </div>

      {/* Empty State Images */}
      <div>
        <h4 className="text-md font-medium mb-4">Empty State Images</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Custom illustrations for empty tables and lists. Recommended size: 48x48px PNG with transparent background.
        </p>
        
        <Tabs defaultValue="core-tables" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="core-tables">Core Tables</TabsTrigger>
            <TabsTrigger value="content-areas">Content Areas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="core-tables" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AssetUploader
                assetType="empty-state-organizations"
                title="Organizations"
                description="Empty organizations table"
                acceptedTypes=".png"
                maxSize="500KB"
                currentAsset={getEmptyStateAsset('empty-state-organizations')?.file_url}
                preview={
                  <div className="scale-75 transform-origin-top">
                    <EmptyState
                      assetType="empty-state-organizations"
                      title="No organizations yet"
                      description="Create your first organization to get started"
                      fallbackIcon={Building2}
                    />
                  </div>
                }
              />
              <AssetUploader
                assetType="empty-state-jobs"
                title="Jobs"
                description="Empty jobs table"
                acceptedTypes=".png"
                maxSize="500KB"
                currentAsset={getEmptyStateAsset('empty-state-jobs')?.file_url}
                preview={
                  <div className="scale-75 transform-origin-top">
                    <EmptyState
                      assetType="empty-state-jobs"
                      title="No jobs yet"
                      description="Create your first job posting to start hiring"
                      fallbackIcon={Briefcase}
                    />
                  </div>
                }
              />
              <AssetUploader
                assetType="empty-state-candidates"
                title="Candidates"
                description="Empty candidates table"
                acceptedTypes=".png"
                maxSize="500KB"
                currentAsset={getEmptyStateAsset('empty-state-candidates')?.file_url}
                preview={
                  <div className="scale-75 transform-origin-top">
                    <EmptyState
                      assetType="empty-state-candidates"
                      title="No candidates yet"
                      description="Start adding candidates to your pipeline"
                      fallbackIcon={Users}
                    />
                  </div>
                }
              />
              <AssetUploader
                assetType="empty-state-members"
                title="Members"
                description="Empty members table"
                acceptedTypes=".png"
                maxSize="500KB"
                currentAsset={getEmptyStateAsset('empty-state-members')?.file_url}
                preview={
                  <div className="scale-75 transform-origin-top">
                    <EmptyState
                      assetType="empty-state-members"
                      title="No team members yet"
                      description="Invite your first team member to collaborate"
                      fallbackIcon={UserCheck}
                    />
                  </div>
                }
              />
              <AssetUploader
                assetType="empty-state-independent-candidates"
                title="Independent Candidates"
                description="Empty independent candidates table"
                acceptedTypes=".png"
                maxSize="500KB"
                currentAsset={getEmptyStateAsset('empty-state-independent-candidates')?.file_url}
                preview={
                  <div className="scale-75 transform-origin-top">
                    <EmptyState
                      assetType="empty-state-independent-candidates"
                      title="No independent candidates yet"
                      description="Add candidates to your talent pool"
                      fallbackIcon={Users}
                    />
                  </div>
                }
              />
            </div>
          </TabsContent>
          
          <TabsContent value="content-areas" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <AssetUploader
                assetType="empty-state-comments"
                title="Comments"
                description="Empty comments section"
                acceptedTypes=".png"
                maxSize="500KB"
                currentAsset={getEmptyStateAsset('empty-state-comments')?.file_url}
                preview={
                  <div className="scale-75 transform-origin-top">
                    <EmptyState
                      assetType="empty-state-comments"
                      title="No comments yet"
                      description="Start a conversation about this candidate"
                      fallbackIcon={MessageSquare}
                    />
                  </div>
                }
              />
              <AssetUploader
                assetType="empty-state-attachments"
                title="Attachments"
                description="Empty attachments list"
                acceptedTypes=".png"
                maxSize="500KB"
                currentAsset={getEmptyStateAsset('empty-state-attachments')?.file_url}
                preview={
                  <div className="scale-75 transform-origin-top">
                    <EmptyState
                      assetType="empty-state-attachments"
                      title="No attachments yet"
                      description="Upload files related to this candidate"
                      fallbackIcon={Paperclip}
                    />
                  </div>
                }
              />
              <AssetUploader
                assetType="empty-state-templates"
                title="Templates"
                description="Empty templates table"
                acceptedTypes=".png"
                maxSize="500KB"
                currentAsset={getEmptyStateAsset('empty-state-templates')?.file_url}
                preview={
                  <div className="scale-75 transform-origin-top">
                    <EmptyState
                      assetType="empty-state-templates"
                      title="No templates yet"
                      description="Create your first template to get started"
                      fallbackIcon={FileText}
                    />
                  </div>
                }
              />
              <AssetUploader
                assetType="empty-state-urls"
                title="URLs"
                description="Empty URLs list"
                acceptedTypes=".png"
                maxSize="500KB"
                currentAsset={getEmptyStateAsset('empty-state-urls')?.file_url}
                preview={
                  <div className="scale-75 transform-origin-top">
                    <EmptyState
                      assetType="empty-state-urls"
                      title="No URLs added yet"
                      description="Add links to portfolios and profiles"
                      fallbackIcon={ExternalLink}
                    />
                  </div>
                }
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <BrowserTitleEditor />
    </div>
  )
}
