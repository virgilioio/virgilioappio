import { Lock } from 'lucide-react';

export function PublicBookingFooter() {
  return (
    <footer className="py-8 px-4">
      <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12.5px] text-virgilio-muted">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          Your details are never shared publicly
        </span>
        <span className="opacity-50">•</span>
        <a href="/privacy" className="hover:text-virgilio-text transition-colors">Privacy</a>
        <span className="opacity-50">•</span>
        <a href="#" className="hover:text-virgilio-text transition-colors">Report this link</a>
      </div>
    </footer>
  );
}
