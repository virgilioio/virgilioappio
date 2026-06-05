import { ShieldCheck } from 'lucide-react';

interface PublicBookingHeaderProps {
  workspaceName?: string;
  workspaceInitial?: string;
}

export function PublicBookingHeader({ workspaceName, workspaceInitial }: PublicBookingHeaderProps) {
  const name = workspaceName?.trim() || 'Scheduling';
  const initial = (workspaceInitial || name).charAt(0).toUpperCase();

  return (
    <header className="border-b border-virgilio-border bg-white">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#0d0d09] text-white flex items-center justify-center font-poppins font-bold text-[15px]">
            {initial}
          </div>
          <div className="leading-tight">
            <div className="font-poppins font-bold text-[15px] text-virgilio-text tracking-[-0.02em]">
              {name}
            </div>
            <div className="text-[12px] text-virgilio-muted">Scheduling</div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[12.5px]">
          <div className="flex items-center gap-1.5 text-virgilio-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Secure link</span>
          </div>
          <span className="h-4 w-px bg-virgilio-border" />
          <div className="text-virgilio-muted">
            Powered by <span className="font-poppins font-bold text-virgilio-text">Gio</span>
          </div>
        </div>
      </div>
    </header>
  );
}
