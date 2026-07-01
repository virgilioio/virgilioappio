import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/components/settings/shared/SettingsCard";
import { Mail, MessageCircle, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ChannelState = "active" | "coming_soon";

interface Channel {
  id: "in_app" | "email" | "whatsapp";
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  state: ChannelState;
  helper?: string;
}

const CHANNELS: Channel[] = [
  {
    id: "in_app",
    name: "In-app chat",
    description: "Magic-link web chat for candidates. No setup required.",
    icon: Globe,
    state: "active",
  },
  {
    id: "email",
    name: "Email",
    description:
      "Reply from noreply@app.gogio.io with open tracking. Uses your recruiter identity when connected.",
    icon: Mail,
    state: "active",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description:
      "Two-way messaging through a verified WhatsApp Business provider. Coming soon.",
    icon: MessageCircle,
    state: "coming_soon",
    helper: "We'll notify workspace admins as soon as WhatsApp goes live.",
  },
];

/**
 * ChatChannelsCard — Step 5.3.
 * Surfaces which channels are wired up for the workspace and lets admins
 * register interest in channels that aren't connected yet (WhatsApp).
 */
export function ChatChannelsCard({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();

  const onRequest = (channel: Channel) => {
    toast({
      title: `${channel.name} — request noted`,
      description:
        "Thanks — we'll email workspace admins when this channel is available to connect.",
    });
  };

  return (
    <SettingsCard
      title="Chat channels"
      description="Where candidates can reach your team from a chat thread."
    >
      <ul className="divide-y divide-virgilio-border">
        {CHANNELS.map((c) => {
          const Icon = c.icon;
          const active = c.state === "active";
          return (
            <li key={c.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3.5">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-[#F1F0EC] flex items-center justify-center">
                <Icon className="h-4 w-4 text-[#0d0d09]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-poppins font-semibold text-[13.5px] tracking-[-0.02em] text-[#0d0d09]">
                    {c.name}
                  </span>
                  <Badge tone={active ? "green" : "neutral"} size="xs" dot>
                    {active ? "Active" : "Coming soon"}
                  </Badge>
                </div>
                <p className="font-inter text-[12px] text-[#5A6072] mt-0.5 leading-relaxed">
                  {c.description}
                </p>
                {c.helper && (
                  <p className="font-inter text-[11.5px] text-text-secondary mt-1">
                    {c.helper}
                  </p>
                )}
              </div>
              <div className="shrink-0 pt-0.5">
                {active ? (
                  <span className="font-inter text-[11.5px] text-text-secondary">
                    Connected
                  </span>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() => onRequest(c)}
                  >
                    Notify me
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </SettingsCard>
  );
}
