import { Link } from "react-router-dom";
import { Mail, MessageCircle, Globe, ArrowUpRight } from "lucide-react";

/**
 * ConnectChannelCTA — Step 5.3.
 * Small inline card shown on chat zero states to advertise the channels
 * candidates can reach the team on, and route admins to Settings.
 */
export function ConnectChannelCTA({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        "mt-6 mx-auto max-w-md rounded-xl border border-virgilio-border bg-surface-primary p-4 text-left shadow-[0_2px_8px_-4px_rgba(13,13,9,0.06)]" +
        (compact ? " p-3" : "")
      }
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-poppins font-semibold text-[12.5px] tracking-[-0.02em] text-[#0d0d09]">
          Connect a channel
        </span>
        <Link
          to="/settings?tab=organization"
          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-virgilio-purple hover:underline"
        >
          Manage
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <ul className="space-y-1.5">
        <ChannelRow icon={Globe} name="In-app chat" status="Active" />
        <ChannelRow icon={Mail} name="Email" status="Active" />
        <ChannelRow icon={MessageCircle} name="WhatsApp" status="Coming soon" muted />
      </ul>
    </div>
  );
}

function ChannelRow({
  icon: Icon,
  name,
  status,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  status: string;
  muted?: boolean;
}) {
  return (
    <li className="flex items-center justify-between text-[12px]">
      <span className="inline-flex items-center gap-2 text-virgilio-text">
        <Icon className="h-3.5 w-3.5 text-text-secondary" />
        {name}
      </span>
      <span
        className={
          "font-inter " + (muted ? "text-text-secondary" : "text-[#1F7A3A]")
        }
      >
        {status}
      </span>
    </li>
  );
}
