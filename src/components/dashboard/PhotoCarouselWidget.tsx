import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Camera, Loader2, MoreHorizontal, Upload, Pencil, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const BUCKET = 'dashboard-photos'
const MAX_PHOTOS = 10
const MAX_SIZE_MB = 5
const STORAGE_KEY = 'dashboard-photo-order'
const TARGET_WIDTH = 600
const TARGET_HEIGHT = 600
const JPEG_QUALITY = 0.8

type PhotoItem = { name: string; url: string }

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > TARGET_WIDTH || height > TARGET_HEIGHT) {
        const ratio = Math.min(TARGET_WIDTH / width, TARGET_HEIGHT / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/jpeg',
        JPEG_QUALITY,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

export function PhotoCarouselWidget() {
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())
  const [isEditing, setIsEditing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadPhotos = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: files, error } = await supabase.storage
        .from(BUCKET)
        .list(user.id, { limit: MAX_PHOTOS, sortBy: { column: 'created_at', order: 'asc' } })
      if (error) { console.error('Failed to list photos:', error); setLoading(false); return }
      if (!files || files.length === 0) { setPhotos([]); setLoading(false); return }

      const savedOrder = (() => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          return raw ? JSON.parse(raw) as string[] : null
        } catch { return null }
      })()

      const photoItems = files
        .filter(f => f.name && !f.name.startsWith('.'))
        .map(f => ({
          name: f.name,
          url: `${supabase.storage.from(BUCKET).getPublicUrl(`${user.id}/${f.name}`).data.publicUrl}?t=${Date.now()}`,
        }))

      if (savedOrder) {
        photoItems.sort((a, b) => {
          const ai = savedOrder.indexOf(a.name)
          const bi = savedOrder.indexOf(b.name)
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
        })
      }

      setPhotos(photoItems)
    } catch (err) {
      console.error('Error loading photos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPhotos() }, [loadPhotos])

  const persistOrder = useCallback((items: PhotoItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(p => p.name)))
    } catch { /* storage full */ }
  }, [])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) { toast.error(`Image must be under ${MAX_SIZE_MB}MB`); return }
    if (photos.length >= MAX_PHOTOS) { toast.error(`Maximum ${MAX_PHOTOS} photos allowed`); return }

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Please sign in'); return }
      const compressed = await compressImage(file)
      const fileName = `${crypto.randomUUID()}.jpg`
      const compressedFile = new File([compressed], fileName, { type: 'image/jpeg' })
      const path = `${user.id}/${fileName}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, compressedFile, {
        cacheControl: '0',
        contentType: 'image/jpeg',
        upsert: false,
      })
      if (error) { toast.error('Upload failed'); console.error('Upload error:', error); return }
      console.log('Upload successful, path:', path)
      const url = `${supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?t=${Date.now()}`
      console.log('Public URL:', url)
      const newPhotos = [...photos, { name: fileName, url }]
      setPhotos(newPhotos)
      setCurrentIndex(newPhotos.length - 1)
      persistOrder(newPhotos)
      toast.success('Photo added!')
    } catch (err) {
      console.error(err)
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }, [photos, persistOrder])

  const handleDeletePhoto = useCallback(async (index: number) => {
    const photo = photos[index]
    if (!photo) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.storage.from(BUCKET).remove([`${user.id}/${photo.name}`])
      if (error) { toast.error('Failed to delete'); console.error(error); return }
      const newPhotos = photos.filter((_, i) => i !== index)
      setPhotos(newPhotos)
      setCurrentIndex(prev => Math.min(prev, Math.max(0, newPhotos.length - 1)))
      persistOrder(newPhotos)
      if (newPhotos.length === 0) setIsEditing(false)
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete')
    }
  }, [photos, persistOrder])

  const movePhoto = useCallback((fromIndex: number, direction: -1 | 1) => {
    const toIndex = fromIndex + direction
    if (toIndex < 0 || toIndex >= photos.length) return
    const newPhotos = [...photos]
    ;[newPhotos[fromIndex], newPhotos[toIndex]] = [newPhotos[toIndex], newPhotos[fromIndex]]
    setPhotos(newPhotos)
    persistOrder(newPhotos)
  }, [photos, persistOrder])

  const goNext = useCallback(() => setCurrentIndex(prev => (prev + 1) % photos.length), [photos.length])
  const goPrev = useCallback(() => setCurrentIndex(prev => (prev - 1 + photos.length) % photos.length), [photos.length])

  const currentPhoto = photos[currentIndex]

  return (
    <Card className="group relative overflow-hidden border-accent/60 bg-accent/40 min-h-[240px] flex flex-col">
      <CardContent className="p-3 flex flex-col flex-1">
        {isEditing ? (
          /* ── Edit Mode ── */
          <div className="flex flex-col flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">Edit Carousel</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setIsEditing(false)}
              >
                Done
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((photo, i) => (
                  <div key={photo.name} className="relative aspect-square rounded-md overflow-hidden group/thumb">
                    {brokenImages.has(photo.name) ? (
                      <div className="w-full h-full flex items-center justify-center bg-muted/50">
                        <Camera className="h-3 w-3 text-muted-foreground/40" />
                      </div>
                    ) : (
                      <img
                        src={photo.url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => setBrokenImages(prev => new Set(prev).add(photo.name))}
                      />
                    )}
                    {/* Delete badge */}
                    <button
                      onClick={() => handleDeletePhoto(i)}
                      className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm z-10 opacity-80 hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                    {/* Reorder arrows */}
                    <div className="absolute bottom-0 inset-x-0 flex justify-center gap-0.5 py-0.5 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                      <button
                        onClick={() => movePhoto(i, -1)}
                        disabled={i === 0}
                        className="text-white disabled:opacity-30 p-0.5"
                      >
                        <ChevronLeft className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={() => movePhoto(i, 1)}
                        disabled={i === photos.length - 1}
                        className="text-white disabled:opacity-30 p-0.5"
                      >
                        <ChevronRight className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {/* Add more button */}
                {photos.length < MAX_PHOTOS && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-square rounded-md border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 flex items-center justify-center transition-colors"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── Normal Mode ── */
          <>
            <div
              className="relative flex-1 rounded-lg overflow-hidden"
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !currentPhoto ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg hover:border-muted-foreground/50 transition-colors cursor-pointer"
                >
                  <Camera className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <span className="text-xs text-muted-foreground/60 font-medium">Add a photo</span>
                </button>
              ) : (
                <>
                  {brokenImages.has(currentPhoto.name) ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 rounded-lg">
                      <Camera className="h-6 w-6 text-muted-foreground/40 mb-1" />
                      <span className="text-xs text-muted-foreground/60">Image unavailable</span>
                    </div>
                  ) : (
                    <img
                      src={currentPhoto.url}
                      alt="Personal photo"
                      className="absolute inset-0 w-full h-full object-cover rounded-lg"
                      onError={() => setBrokenImages(prev => new Set(prev).add(currentPhoto.name))}
                    />
                  )}
                  {/* Ellipsis menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="absolute top-1.5 right-1.5 bg-black/40 hover:bg-black/70 text-white rounded-full p-1 transition-all z-10">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[150px]">
                      <DropdownMenuItem
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading || photos.length >= MAX_PHOTOS}
                      >
                        <Upload className="h-3.5 w-3.5 mr-2" />
                        Upload Photo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setIsEditing(true)}
                        disabled={photos.length === 0}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Edit Carousel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {/* Nav arrows on hover */}
                  {hovering && photos.length > 1 && (
                    <>
                      <button
                        onClick={goPrev}
                        className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-0.5 transition-all z-10"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={goNext}
                        className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-0.5 transition-all z-10"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Bottom bar: dots only */}
            {photos.length > 1 && (
              <div className="flex items-center gap-1 mt-2">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={cn(
                      'rounded-full transition-all',
                      i === currentIndex
                        ? 'w-1.5 h-1.5 bg-foreground'
                        : 'w-1 h-1 bg-foreground/30 hover:bg-foreground/50'
                    )}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleUpload}
        />
      </CardContent>
    </Card>
  )
}
