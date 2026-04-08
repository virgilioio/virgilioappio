import { useState } from 'react';
import { Copy, ExternalLink, Check, AlertCircle, Loader2, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useBookingConfig } from '@/hooks/useBookingConfig';
import { useBookingEventTypes, BookingEventType } from '@/hooks/useBookingEventTypes';
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities';
import { EventTypeSheet } from './booking/EventTypeSheet';
import { GioEmptyState } from '@/components/ui/GioEmptyState';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

export function BookingLinkSection() {
  const { 
    config, 
    isLoading, 
    updateConfig, 
    isUpdating, 
    bookingUrl,
    needsProfileCompletion,
    isCreating
  } = useBookingConfig();
  const { identities } = useCalendarIdentities();
  const {
    eventTypes,
    isLoading: isLoadingEventTypes,
    createEventType,
    updateEventType,
    deleteEventType,
    isCreating: isCreatingEventType,
    isUpdating: isUpdatingEventType,
    isDeleting: isDeletingEventType,
  } = useBookingEventTypes(config?.id);

  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEventType, setEditingEventType] = useState<BookingEventType | null>(null);
  const isMobile = useIsMobile();

  const handleCopy = async () => {
    if (!bookingUrl) return;
    await navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    toast.success('Booking link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenCreate = () => {
    setEditingEventType(null);
    setSheetOpen(true);
  };

  const handleOpenEdit = (et: BookingEventType) => {
    setEditingEventType(et);
    setSheetOpen(true);
  };

  const handleSave = (data: Partial<BookingEventType> & { title: string }) => {
    if (data.id) {
      updateEventType(data as any, {
        onSuccess: () => setSheetOpen(false),
      });
    } else {
      createEventType(data, {
        onSuccess: () => setSheetOpen(false),
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteEventType(id);
  };

  const hasCalendar = identities && identities.length > 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking Link</CardTitle>
          <CardDescription>Loading your booking configuration...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (needsProfileCompletion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking Link</CardTitle>
          <CardDescription>Complete your profile to create your booking link</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Profile Incomplete</AlertTitle>
            <AlertDescription>
              Please add your first and last name to your profile before creating a booking link.
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            onClick={() => {
              const profileForm = document.getElementById('profile-form');
              if (profileForm) {
                profileForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          >
            Go to Profile Settings
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isCreating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking Link</CardTitle>
          <CardDescription>Setting up your booking link...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-text-secondary">Creating your personalized booking link</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!config || !bookingUrl) {
    return null;
  }

  const handleToggleActive = () => {
    if (!hasCalendar && !config.is_active) {
      toast.error('Connect a calendar first to activate your booking link');
      return;
    }
    updateConfig({ is_active: !config.is_active });
  };

  return (
    <>
      <Card data-onboarding-target="booking">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Booking Link</CardTitle>
              <CardDescription>Share your personalized booking link with candidates</CardDescription>
            </div>
            {!isMobile && (
              <div className="flex items-center gap-3">
                <Switch
                  checked={config.is_active}
                  onCheckedChange={handleToggleActive}
                  disabled={isUpdating || (!hasCalendar && !config.is_active)}
                />
                <Badge variant={config.is_active ? 'default' : 'secondary'}>
                  {config.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Booking URL Display */}
          <div className="space-y-2">
            <Label>Public Booking URL</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={bookingUrl}
                readOnly
                className="font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                {!isMobile && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(bookingUrl, '_blank')}
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            {!hasCalendar && (
              <p className="text-xs text-text-muted">
                Connect a calendar to activate your booking link
              </p>
            )}
          </div>

          <Separator />

          {/* Event Types */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Event Types</h3>
              {!isMobile && (
                <Button variant="outline" size="sm" onClick={handleOpenCreate}>
                  <Plus className="w-4 h-4 mr-1" />
                  Create New
                </Button>
              )}
            </div>

            {isLoadingEventTypes ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
              </div>
            ) : eventTypes.length === 0 ? (
              <div className="py-4">
                <GioEmptyState
                  title="No event types yet"
                  description={isMobile ? "Create event types from desktop" : "Create event types to let candidates choose what to book"}
                />
                {!isMobile && (
                  <div className="flex justify-center -mt-4">
                    <Button variant="outline" size="sm" onClick={handleOpenCreate}>
                      <Plus className="w-4 h-4 mr-1" />
                      Create Your First Event Type
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {eventTypes.map((et) => {
                  const eventUrl = `${bookingUrl}/${et.slug}`;
                  return (
                    <div
                      key={et.id}
                      className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-card transition-colors ${isMobile ? '' : 'hover:border-primary/40 cursor-pointer'}`}
                      onClick={isMobile ? undefined : () => handleOpenEdit(et)}
                    >
                      {/* Color dot */}
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: et.color }}
                      />
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{et.title}</p>
                        {et.description && (
                          <p className="text-xs text-text-secondary truncate">{et.description}</p>
                        )}
                      </div>
                      {/* Duration */}
                      <span className="text-xs text-text-secondary flex-shrink-0">{et.duration_minutes}m</span>
                      {/* Copy direct link */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 h-7 w-7"
                        title="Copy direct link"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(eventUrl);
                          toast.success('Event type link copied');
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      {/* Active badge - hidden on mobile */}
                      {!isMobile && (
                        <Badge variant={et.is_active ? 'default' : 'secondary'} className="flex-shrink-0 text-xs">
                          {et.is_active ? '✓' : '—'}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <EventTypeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        eventType={editingEventType}
        onSave={handleSave}
        onDelete={handleDelete}
        isSaving={isCreatingEventType || isUpdatingEventType}
        isDeleting={isDeletingEventType}
      />
    </>
  );
}
