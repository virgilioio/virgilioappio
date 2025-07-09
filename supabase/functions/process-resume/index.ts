import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  console.log("🚀 Edge Function started");

  const client_id = Deno.env.get("ADOBE_CLIENT_ID");
  const client_secret = Deno.env.get("ADOBE_CLIENT_SECRET");

  if (!client_id || !client_secret) {
    console.error("❌ Missing Adobe credentials");
    return new Response("Missing Adobe credentials", { status: 500 });
  }

  console.log("🔐 Requesting Adobe access token...");

  const tokenRes = await fetch("https://ims-na1.adobelogin.com/ims/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id,
      client_secret,
      grant_type: "client_credentials",
      scope: "openid,AdobeID,DCAPI"
    })
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    console.error("❌ Adobe auth failed:", tokenRes.status, tokenData);
    return new Response("Adobe auth failed", { status: 500 });
  }

  const access_token = tokenData.access_token;
  console.log("✅ Adobe token received:", access_token.slice(0, 20), "...");

  return new Response(
    JSON.stringify({
      success: true,
      access_token_preview: access_token.slice(0, 20) + "..."
    }),
    { headers: { "Content-Type": "application/json" }, status: 200 }
  );
});