import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAppVersionCheck } from '@/hooks/useAppVersionCheck';

/**
 * "A new version is ready" as one of our toasts (2026-10-12): the same ink
 * Sonner toast as everything else, bottom-left and above the phone's bottom
 * bar. It stays until you choose Refresh or Later (Later hides it for this
 * version only). Sonner shows one toast at a time, so another toast briefly
 * covers it and it comes back after.
 */
const TOAST_ID = 'gio-app-update';

export function AppUpdateNotification() {
  const { updateAvailable, version, refresh, dismiss } = useAppVersionCheck();

  useEffect(() => {
    if (!updateAvailable) {
      toast.dismiss(TOAST_ID);
      return;
    }
    toast('A new version of Gio ATS', {
      id: TOAST_ID,
      description: 'Refresh to load it. Save what you’re typing first.',
      duration: Infinity,
      action: { label: 'Refresh', onClick: refresh },
      cancel: { label: 'Later', onClick: dismiss },
      // A swipe away counts as Later.
      onDismiss: dismiss,
    });
  }, [updateAvailable, version, refresh, dismiss]);

  return null;
}
