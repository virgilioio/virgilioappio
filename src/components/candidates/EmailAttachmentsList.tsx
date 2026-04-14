import { useState } from 'react';
import { Paperclip, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
}

interface EmailAttachmentsListProps {
  attachments: AttachmentMeta[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailAttachmentsList({ attachments }: EmailAttachmentsListProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (attachment: AttachmentMeta) => {
    setDownloading(attachment.storagePath);
    try {
      const { data, error } = await supabase.functions.invoke('download-email-attachment', {
        body: { storagePath: attachment.storagePath },
      });

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      toast.error(`Failed to download: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-2 border border-border rounded-md p-2 bg-muted/30">
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
        <Paperclip className="h-3 w-3" />
        <span>{attachments.length} attachment{attachments.length > 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-1">
        {attachments.map((att, i) => (
          <div
            key={att.storagePath || i}
            className="flex items-center justify-between gap-2 text-xs bg-background rounded px-2 py-1.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{att.filename}</span>
              <span className="text-muted-foreground flex-shrink-0">
                {formatFileSize(att.size)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(att);
              }}
              disabled={downloading === att.storagePath}
            >
              {downloading === att.storagePath ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
