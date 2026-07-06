import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

// Typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthNamespace = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{
    data:
      | {
          client?: { name?: string; client_uri?: string; logo_uri?: string };
          scope?: string;
          redirect_url?: string;
          redirect_to?: string;
        }
      | null;
    error: { message: string } | null;
  }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
};

const oauth = (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<
    Awaited<ReturnType<OAuthNamespace["getAuthorizationDetails"]>>["data"] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/auth?redirect=${encodeURIComponent(next)}`;
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E7E8EE] rounded-2xl p-6">
          <h1 className="font-poppins font-semibold text-[16px] text-[#0d0d09] mb-2">
            Could not load this request
          </h1>
          <p className="font-inter text-[13px] text-[#5A6072]">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="font-inter text-[13px] text-[#5A6072]">Loading…</p>
      </main>
    );
  }

  const clientName = details.client?.name ?? "an app";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#F6F5F1]">
      <div className="max-w-md w-full bg-white border border-[#E7E8EE] rounded-2xl p-6 shadow-sm">
        <h1
          className="font-poppins font-semibold text-[18px] text-[#0d0d09] mb-1"
          style={{ letterSpacing: "-0.01em" }}
        >
          Connect {clientName} to Virgilio
        </h1>
        <p className="font-inter text-[13px] text-[#5A6072] mb-5">
          This lets {clientName} act on your behalf using Virgilio's tools. It
          will only see what you can see.
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => decide(false)}>
            Deny
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy ? "Working…" : "Approve"}
          </Button>
        </div>
      </div>
    </main>
  );
}
