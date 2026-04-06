import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, ChevronLeft, ChevronRight, Trash2, Camera, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

const BUCKET = 'dashboard-photos'
const MAX_PHOTOS = 10
const MAX_SIZE_MB = 5
const STORAGE_KEY = 'dashboard-photo-order'

export function PhotoCarouselWidget() {
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [hovering, setHovering] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load photos from Supabase Storage
  const loadPhotos = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: files, error } = await supabase.storage
        .from(BUCKET)
        .list(user.id, { limit: MAX_PHOTOS, sortBy: { column: 'created_at', order: 'asc' } })

      if (error) { console.error('Failed to list photos:', error); setLoading(false); return }
      if (!files || files.length === 0) { setPhotos([]); setLoading(false); return }

      // Get saved order from localStorage
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
          url: supabase.storage.from(BUCKET).getPublicUrl(`${user.id}/${f.name}`).data.publicUrl,
        }))

      // Sort by saved order if available
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

  // Persist order to localStorage
  const persistOrder = useCallback((items: { name: string; url: string }[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(p => p.name)))
    } catch { /* storage full */ }
  }, [])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so same file can be re-selected
    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MAX_SIZE_MB}MB`)
      return
    }
    if (photos.length >= MAX_PHOTOS) {
      toast.error(`Maximum ${MAX_PHOTOS} photos allowed`)
      return
    }

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Please sign in'); return }

      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `${crypto.randomUUID()}.${ext}`
      const path = `${user.id}/${fileName}`

      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })

      if (error) { toast.error('Upload failed'); console.error(error); return }

      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
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

  const handleDelete = useCallback(async () => {
    if (photos.length === 0) return
    const photo = photos[currentIndex]
    if (!photo) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.storage
        .from(BUCKET)
        .remove([`${user.id}/${photo.name}`])

      if (error) { toast.error('Failed to delete'); console.error(error); return }

      const newPhotos = photos.filter((_, i) => i !== currentIndex)
      setPhotos(newPhotos)
      setCurrentIndex(prev => Math.min(prev, Math.max(0, newPhotos.length - 1)))
      persistOrder(newPhotos)
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete')
    }
  }, [photos, currentIndex, persistOrder])

  const goNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % photos.length)
  }, [photos.length])

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + photos.length) % photos.length)
  }, [photos.length])

  const currentPhoto = photos[currentIndex]

  return (
    <Card className="group relative overflow-hidden border-accent/60 bg-accent/40 min-h-[240px] flex flex-col">
      <CardContent className="p-3 flex flex-col flex-1">
        {/* Photo area */}
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
            /* Empty state */
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg hover:border-muted-foreground/50 transition-colors cursor-pointer"
            >
              <Camera className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <span className="text-xs text-muted-foreground/60 font-medium">Add a photo</span>
            </button>
          ) : (
            <>
              <img
                src={currentPhoto.url}
                alt="Personal photo"
                className="absolute inset-0 w-full h-full object-cover rounded-lg"
              />
              {/* Delete button on hover */}
              {hovering && (
                <button
                  onClick={handleDelete}
                  className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-all z-10"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
              {/* Nav arrows on hover when multiple photos */}
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

        {/* Bottom bar: dots + upload */}
        <div className="flex items-center justify-between mt-2">
          {/* Dot indicators */}
          <div className="flex items-center gap-1">
            {photos.length > 1 && photos.map((_, i) => (
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

          {/* Upload button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || photos.length >= MAX_PHOTOS}
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
          </Button>
        </div>

        {/* Hidden file input */}
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
