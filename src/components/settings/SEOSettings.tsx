import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Save, RotateCcw, Loader2, Info, Eye, Search, Share2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from '@/hooks/use-toast'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { useFormPersistence } from '@/hooks/useFormPersistence'

const seoSchema = z.object({
  pageTitle: z.string().max(70, 'Page title must be 70 characters or less').optional(),
  metaDescription: z.string().max(160, 'Meta description must be 160 characters or less').optional(),
  thumbnailImage: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  keywords: z.string().optional(),
  canonicalUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  ogTitle: z.string().max(70, 'OG title must be 70 characters or less').optional(),
  ogDescription: z.string().max(160, 'OG description must be 160 characters or less').optional(),
  ogImage: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  ogUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  ogType: z.string().optional(),
  ogSiteName: z.string().optional(),
  twitterTitle: z.string().max(70, 'Twitter title must be 70 characters or less').optional(),
  twitterDescription: z.string().max(160, 'Twitter description must be 160 characters or less').optional(),
  twitterImage: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  twitterCard: z.enum(['summary', 'summary_large_image', 'app', 'player']).optional(),
  robotsDirective: z.enum(['index, follow', 'noindex, nofollow', 'index, nofollow', 'noindex, follow']).optional()
})

type SEOFormData = z.infer<typeof seoSchema>

const defaultValues: SEOFormData = {
  pageTitle: '',
  metaDescription: '',
  thumbnailImage: '',
  keywords: '',
  canonicalUrl: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  ogUrl: '',
  ogType: 'website',
  ogSiteName: '',
  twitterTitle: '',
  twitterDescription: '',
  twitterImage: '',
  twitterCard: 'summary_large_image',
  robotsDirective: 'index, follow'
}

interface FieldTooltipProps {
  children: React.ReactNode
  content: string
}

function FieldTooltip({ children, content }: FieldTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            {children}
            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface CharacterCountProps {
  current: number
  max: number
}

function CharacterCount({ current, max }: CharacterCountProps) {
  const isNearLimit = current > max * 0.8
  const isOverLimit = current > max
  
  return (
    <Badge 
      variant={isOverLimit ? "destructive" : isNearLimit ? "secondary" : "outline"}
      className="text-xs"
    >
      {current}/{max}
    </Badge>
  )
}

export function SEOSettings() {
  const { updateSetting, getSetting, isUpdating } = usePlatformSettings()
  const [isLoading, setIsLoading] = useState(false)
  
  const form = useForm<SEOFormData>({
    resolver: zodResolver(seoSchema),
    defaultValues
  })

  const { watch, handleSubmit, reset, register, setValue, formState: { errors, isDirty } } = form

  // Form persistence
  useFormPersistence({
    storageKey: 'seo-settings-draft',
    form,
    enabled: true
  })

  const watchedValues = watch()

  // Load existing SEO settings
  useEffect(() => {
    const loadSEOSettings = () => {
      const settings = {
        pageTitle: getSetting('seo_page_title')?.setting_value || '',
        metaDescription: getSetting('seo_meta_description')?.setting_value || '',
        thumbnailImage: getSetting('seo_thumbnail_image')?.setting_value || '',
        keywords: getSetting('seo_keywords')?.setting_value || '',
        canonicalUrl: getSetting('seo_canonical_url')?.setting_value || '',
        ogTitle: getSetting('seo_og_title')?.setting_value || '',
        ogDescription: getSetting('seo_og_description')?.setting_value || '',
        ogImage: getSetting('seo_og_image')?.setting_value || '',
        ogUrl: getSetting('seo_og_url')?.setting_value || '',
        ogType: getSetting('seo_og_type')?.setting_value || 'website',
        ogSiteName: getSetting('seo_og_site_name')?.setting_value || '',
        twitterTitle: getSetting('seo_twitter_title')?.setting_value || '',
        twitterDescription: getSetting('seo_twitter_description')?.setting_value || '',
        twitterImage: getSetting('seo_twitter_image')?.setting_value || '',
        twitterCard: getSetting('seo_twitter_card')?.setting_value || 'summary_large_image',
        robotsDirective: getSetting('seo_robots_directive')?.setting_value || 'index, follow'
      }
      
      reset(settings as SEOFormData)
    }

    loadSEOSettings()
  }, [getSetting, reset])

  const onSubmit = async (data: SEOFormData) => {
    setIsLoading(true)
    
    try {
      const settingsToUpdate = [
        { key: 'seo_page_title', value: data.pageTitle || '' },
        { key: 'seo_meta_description', value: data.metaDescription || '' },
        { key: 'seo_thumbnail_image', value: data.thumbnailImage || '' },
        { key: 'seo_keywords', value: data.keywords || '' },
        { key: 'seo_canonical_url', value: data.canonicalUrl || '' },
        { key: 'seo_og_title', value: data.ogTitle || '' },
        { key: 'seo_og_description', value: data.ogDescription || '' },
        { key: 'seo_og_image', value: data.ogImage || '' },
        { key: 'seo_og_url', value: data.ogUrl || '' },
        { key: 'seo_og_type', value: data.ogType || 'website' },
        { key: 'seo_og_site_name', value: data.ogSiteName || '' },
        { key: 'seo_twitter_title', value: data.twitterTitle || '' },
        { key: 'seo_twitter_description', value: data.twitterDescription || '' },
        { key: 'seo_twitter_image', value: data.twitterImage || '' },
        { key: 'seo_twitter_card', value: data.twitterCard || 'summary_large_image' },
        { key: 'seo_robots_directive', value: data.robotsDirective || 'index, follow' }
      ]

      const promises = settingsToUpdate.map(setting => 
        updateSetting(setting.key, setting.value)
      )

      const results = await Promise.all(promises)
      
      if (results.every(result => result)) {
        toast({
          title: "SEO Settings Updated",
          description: "Your SEO settings have been saved successfully."
        })
        
        // Clear persisted draft data
        localStorage.removeItem('seo-settings-draft')
      } else {
        throw new Error('Some settings failed to update')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update SEO settings. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    reset(defaultValues)
    localStorage.removeItem('seo-settings-draft')
    toast({
      title: "Settings Reset",
      description: "SEO settings have been reset to default values."
    })
  }

  return (
    <div className="space-y-6">
      {/* SEO Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            SEO Preview
          </CardTitle>
          <CardDescription>
            Preview how your site will appear in search results and social media
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Result Preview */}
          <div className="border rounded-lg p-4 bg-muted/20">
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Search Result Preview</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-blue-600 text-lg font-medium hover:underline cursor-pointer">
                {watchedValues.pageTitle || 'Your Page Title'}
              </h3>
              <p className="text-green-700 text-sm">
                {watchedValues.canonicalUrl || 'https://yoursite.com'}
              </p>
              <p className="text-sm text-gray-600">
                {watchedValues.metaDescription || 'Your meta description will appear here...'}
              </p>
            </div>
          </div>

          {/* Social Media Preview */}
          <div className="border rounded-lg p-4 bg-muted/20">
            <div className="flex items-center gap-2 mb-2">
              <Share2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Social Media Preview</span>
            </div>
            <div className="border rounded-lg overflow-hidden bg-white max-w-md">
              {watchedValues.ogImage && (
                <img 
                  src={watchedValues.ogImage} 
                  alt="OG Preview" 
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              )}
              <div className="p-3">
                <h4 className="font-medium text-sm">
                  {watchedValues.ogTitle || watchedValues.pageTitle || 'Page Title'}
                </h4>
                <p className="text-xs text-gray-600 mt-1">
                  {watchedValues.ogDescription || watchedValues.metaDescription || 'Description...'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {watchedValues.ogSiteName || 'yoursite.com'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic SEO Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Basic SEO Settings</CardTitle>
            <CardDescription>
              Configure fundamental SEO elements for your web application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FieldTooltip content="The title that appears in browser tabs and search results. Keep it under 70 characters for best results.">
                <Label>Page Title</Label>
              </FieldTooltip>
              {errors.pageTitle && (
                <p className="text-sm text-destructive">{errors.pageTitle.message}</p>
              )}
              <div className="flex items-center gap-2">
                <Input
                  {...register('pageTitle')}
                  placeholder="Enter your page title"
                  maxLength={70}
                />
                <CharacterCount 
                  current={watchedValues.pageTitle?.length || 0} 
                  max={70} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldTooltip content="A brief description that appears under your title in search results. Keep it under 160 characters.">
                <Label>Meta Description</Label>
              </FieldTooltip>
              {errors.metaDescription && (
                <p className="text-sm text-destructive">{errors.metaDescription.message}</p>
              )}
              <div className="flex items-start gap-2">
                <Textarea
                  {...register('metaDescription')}
                  placeholder="Enter a compelling description of your page"
                  maxLength={160}
                  rows={3}
                />
                <CharacterCount 
                  current={watchedValues.metaDescription?.length || 0} 
                  max={160} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldTooltip content="Comma-separated keywords relevant to your content. Helps with categorization but has limited SEO impact.">
                <Label>Keywords</Label>
              </FieldTooltip>
              {errors.keywords && (
                <p className="text-sm text-destructive">{errors.keywords.message}</p>
              )}
              <Input
                {...register('keywords')}
                placeholder="keyword1, keyword2, keyword3"
              />
            </div>

            <div className="space-y-2">
              <FieldTooltip content="The preferred URL for this page. Helps prevent duplicate content issues.">
                <Label>Canonical URL</Label>
              </FieldTooltip>
              {errors.canonicalUrl && (
                <p className="text-sm text-destructive">{errors.canonicalUrl.message}</p>
              )}
              <Input
                {...register('canonicalUrl')}
                placeholder="https://yoursite.com/page"
                type="url"
              />
            </div>

            <div className="space-y-2">
              <FieldTooltip content="Controls how search engines crawl and index your page.">
                <Label>Robots Directive</Label>
              </FieldTooltip>
              {errors.robotsDirective && (
                <p className="text-sm text-destructive">{errors.robotsDirective.message}</p>
              )}
              <Select
                value={watchedValues.robotsDirective}
                onValueChange={(value: any) => setValue('robotsDirective', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select robots directive" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="index, follow">index, follow (Default)</SelectItem>
                  <SelectItem value="noindex, nofollow">noindex, nofollow</SelectItem>
                  <SelectItem value="index, nofollow">index, nofollow</SelectItem>
                  <SelectItem value="noindex, follow">noindex, follow</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Open Graph Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Open Graph (Facebook, LinkedIn)</CardTitle>
            <CardDescription>
              Configure how your site appears when shared on social media platforms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FieldTooltip content="Title for social media shares. If not set, falls back to page title.">
                <Label>OG Title</Label>
              </FieldTooltip>
              {errors.ogTitle && (
                <p className="text-sm text-destructive">{errors.ogTitle.message}</p>
              )}
              <div className="flex items-center gap-2">
                <Input
                  {...register('ogTitle')}
                  placeholder="Social media title"
                  maxLength={70}
                />
                <CharacterCount 
                  current={watchedValues.ogTitle?.length || 0} 
                  max={70} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldTooltip content="Description for social media shares. If not set, falls back to meta description.">
                <Label>OG Description</Label>
              </FieldTooltip>
              {errors.ogDescription && (
                <p className="text-sm text-destructive">{errors.ogDescription.message}</p>
              )}
              <div className="flex items-start gap-2">
                <Textarea
                  {...register('ogDescription')}
                  placeholder="Social media description"
                  maxLength={160}
                  rows={3}
                />
                <CharacterCount 
                  current={watchedValues.ogDescription?.length || 0} 
                  max={160} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldTooltip content="Image URL for social media shares. Recommended size: 1200x630px.">
                <Label>OG Image</Label>
              </FieldTooltip>
              {errors.ogImage && (
                <p className="text-sm text-destructive">{errors.ogImage.message}</p>
              )}
              <Input
                {...register('ogImage')}
                placeholder="https://yoursite.com/image.jpg"
                type="url"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldTooltip content="The URL of the page being shared.">
                  <Label>OG URL</Label>
                </FieldTooltip>
                {errors.ogUrl && (
                  <p className="text-sm text-destructive">{errors.ogUrl.message}</p>
                )}
                <Input
                  {...register('ogUrl')}
                  placeholder="https://yoursite.com"
                  type="url"
                />
              </div>

              <div className="space-y-2">
                <FieldTooltip content="The type of content (usually 'website' for most pages).">
                  <Label>OG Type</Label>
                </FieldTooltip>
                {errors.ogType && (
                  <p className="text-sm text-destructive">{errors.ogType.message}</p>
                )}
                <Input
                  {...register('ogType')}
                  placeholder="website"
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldTooltip content="The name of your website or brand.">
                <Label>OG Site Name</Label>
              </FieldTooltip>
              {errors.ogSiteName && (
                <p className="text-sm text-destructive">{errors.ogSiteName.message}</p>
              )}
              <Input
                {...register('ogSiteName')}
                placeholder="Your Site Name"
              />
            </div>
          </CardContent>
        </Card>

        {/* Twitter Card Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Twitter Card</CardTitle>
            <CardDescription>
              Configure how your site appears when shared on Twitter/X
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FieldTooltip content="The type of Twitter card to display.">
                <Label>Twitter Card Type</Label>
              </FieldTooltip>
              {errors.twitterCard && (
                <p className="text-sm text-destructive">{errors.twitterCard.message}</p>
              )}
              <Select
                value={watchedValues.twitterCard}
                onValueChange={(value: any) => setValue('twitterCard', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select card type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary</SelectItem>
                  <SelectItem value="summary_large_image">Summary Large Image</SelectItem>
                  <SelectItem value="app">App</SelectItem>
                  <SelectItem value="player">Player</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FieldTooltip content="Title for Twitter shares. If not set, falls back to OG title or page title.">
                <Label>Twitter Title</Label>
              </FieldTooltip>
              {errors.twitterTitle && (
                <p className="text-sm text-destructive">{errors.twitterTitle.message}</p>
              )}
              <div className="flex items-center gap-2">
                <Input
                  {...register('twitterTitle')}
                  placeholder="Twitter title"
                  maxLength={70}
                />
                <CharacterCount 
                  current={watchedValues.twitterTitle?.length || 0} 
                  max={70} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldTooltip content="Description for Twitter shares. If not set, falls back to OG description or meta description.">
                <Label>Twitter Description</Label>
              </FieldTooltip>
              {errors.twitterDescription && (
                <p className="text-sm text-destructive">{errors.twitterDescription.message}</p>
              )}
              <div className="flex items-start gap-2">
                <Textarea
                  {...register('twitterDescription')}
                  placeholder="Twitter description"
                  maxLength={160}
                  rows={3}
                />
                <CharacterCount 
                  current={watchedValues.twitterDescription?.length || 0} 
                  max={160} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldTooltip content="Image URL for Twitter shares. If not set, falls back to OG image.">
                <Label>Twitter Image</Label>
              </FieldTooltip>
              {errors.twitterImage && (
                <p className="text-sm text-destructive">{errors.twitterImage.message}</p>
              )}
              <Input
                {...register('twitterImage')}
                placeholder="https://yoursite.com/twitter-image.jpg"
                type="url"
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          <Button 
            type="submit" 
            disabled={isLoading || isUpdating || !isDirty}
            className="flex items-center gap-2"
          >
            {(isLoading || isUpdating) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save SEO Settings
          </Button>
          
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleReset}
            disabled={isLoading || isUpdating}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
        </div>
      </form>
    </div>
  )
}