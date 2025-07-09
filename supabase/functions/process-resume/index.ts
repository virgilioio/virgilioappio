import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("🚀 Edge Function started");

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Step 1: Extract file from form data
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.error("❌ No file provided");
      return new Response("No file provided", { status: 400, headers: corsHeaders });
    }

    if (!file.type.includes("pdf")) {
      console.error("❌ File is not a PDF:", file.type);
      return new Response("Only PDF files are allowed", { status: 400, headers: corsHeaders });
    }

    console.log(`📄 Received file: ${file.name} (${file.size} bytes)`);

    // Step 2: Get Adobe credentials
    const client_id = Deno.env.get("ADOBE_CLIENT_ID");
    const client_secret = Deno.env.get("ADOBE_CLIENT_SECRET");
    const org_id = Deno.env.get("ADOBE_IMS_ORG");

    if (!client_id || !client_secret || !org_id) {
      console.error("❌ Missing Adobe credentials");
      return new Response("Missing Adobe credentials", { status: 500, headers: corsHeaders });
    }

    // Step 3: Get Adobe access token
    console.log("🔐 Requesting Adobe access token...");

    const tokenRes = await fetch("https://ims-na1.adobelogin.com/ims/token/v3", {
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
      return new Response("Adobe auth failed", { status: 500, headers: corsHeaders });
    }

    const access_token = tokenData.access_token;
    console.log("🔐 Adobe token acquired");

    // Step 4: Create Adobe asset and get upload URI
    console.log("🆔 Creating Adobe asset...");

    const assetRes = await fetch("https://pdf-services-ue1.adobe.io/assets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "x-api-key": client_id,
        "x-gw-ims-org-id": org_id,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mediaType: "application/pdf"
      })
    });

    const assetData = await assetRes.json();

    if (!assetRes.ok) {
      console.error("❌ Adobe asset creation failed:", assetRes.status, assetData);
      return new Response("Adobe asset creation failed", { status: 500, headers: corsHeaders });
    }

    const { uploadUri, assetID } = assetData;
    console.log(`🆔 Adobe assetID: ${assetID}`);

    // Step 5: Upload file to Adobe
    console.log("📤 Uploading file to Adobe...");

    const fileBuffer = new Uint8Array(await file.arrayBuffer());

    const uploadRes = await fetch(uploadUri, {
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf"
      },
      body: fileBuffer
    });

    if (!uploadRes.ok) {
      const uploadError = await uploadRes.text();
      console.error("❌ File upload failed:", uploadRes.status, uploadError);
      return new Response("File upload failed", { status: 500, headers: corsHeaders });
    }

    console.log("📤 File uploaded to Adobe successfully");

    // Step 6: Create Adobe extraction job
    console.log(`📥 Starting Adobe extract job for asset: ${assetID}`);

    const extractJobRes = await fetch("https://pdf-services-ue1.adobe.io/operation/extractpdf", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "x-api-key": client_id,
        "x-gw-ims-org-id": org_id,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        assetID: assetID,
        outputType: "json"
      })
    });

    if (!extractJobRes.ok) {
      const extractError = await extractJobRes.text();
      console.error("❌ Extract job creation failed:", extractJobRes.status, extractError);
      return new Response("Extract job creation failed", { status: 500, headers: corsHeaders });
    }

    const jobLocation = extractJobRes.headers.get("location");
    if (!jobLocation) {
      console.error("❌ No job location received");
      return new Response("No job location received from Adobe", { status: 500, headers: corsHeaders });
    }

    console.log("📥 Extract job created, polling for completion...");

    // Step 7: Poll for job completion
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds (2 second intervals)
    let finalJobResult: any;

    while (!jobCompleted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      attempts++;

      console.log(`⏳ Polling extract job: attempt ${attempts}...`);

      const statusRes = await fetch(jobLocation, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "x-api-key": client_id,
          "x-gw-ims-org-id": org_id
        }
      });

      if (!statusRes.ok) {
        const statusError = await statusRes.text();
        console.error(`❌ Failed to check job status (attempt ${attempts}):`, statusError);
        continue;
      }

      const statusResult = await statusRes.json();
      console.log(`⏳ Job status: ${statusResult.status}`);

      if (statusResult.status === "done") {
        jobCompleted = true;
        finalJobResult = statusResult;
        console.log("✅ Job complete, downloading result");
      } else if (statusResult.status === "failed") {
        console.error("❌ Extract job failed:", statusResult);
        return new Response("Adobe extraction job failed", { status: 500, headers: corsHeaders });
      }
    }

    if (!jobCompleted) {
      console.error("❌ Job timed out after 60 seconds");
      return new Response("Adobe extraction job timed out", { status: 500, headers: corsHeaders });
    }

    // Step 8: Download extraction results
    if (!finalJobResult.asset || !finalJobResult.asset.downloadUri) {
      console.error("❌ No download URL in job result");
      return new Response("No download URL received from Adobe", { status: 500, headers: corsHeaders });
    }

    const downloadRes = await fetch(finalJobResult.asset.downloadUri, {
      headers: {
        "Authorization": `Bearer ${access_token}`
      }
    });

    if (!downloadRes.ok) {
      const downloadError = await downloadRes.text();
      console.error("❌ Failed to download extraction results:", downloadError);
      return new Response("Failed to download extraction results", { status: 500, headers: corsHeaders });
    }

    const extractedJson = await downloadRes.json();
    console.log("📄 Resume JSON extracted successfully");

    // Step 9: Return success response with extracted data
    return new Response(
      JSON.stringify({
        success: true,
        raw_resume_json: extractedJson
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        }, 
        status: 200 
      }
    );

  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
    return new Response(
      `Unexpected error: ${error.message}`, 
      { status: 500, headers: corsHeaders }
    );
  }
});