import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { phone, purpose } = await req.json();
    if (!phone || typeof phone !== "string" || phone.length < 10) {
      return new Response(JSON.stringify({ error: "Valid phone number required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: max 3 OTPs per phone per 10 minutes
    const { count } = await supabase
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", phone)
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (count && count >= 3) {
      return new Response(JSON.stringify({ error: "Too many OTP requests. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Hash the OTP using crypto
    const encoder = new TextEncoder();
    const data = encoder.encode(otp);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const codeHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Store hashed OTP
    await supabase.from("otp_codes").insert({
      user_id: user.id,
      phone,
      code_hash: codeHash,
      purpose: purpose || "verification",
      expires_at: expiresAt,
    });

    // Send via TalkSasa
    const talksasaToken = Deno.env.get("TALKSASA_API_TOKEN");
    const talksasaBaseUrl = Deno.env.get("TALKSASA_BASE_URL");
    const talksasaSenderId = Deno.env.get("TALKSASA_DEFAULT_SENDER_ID");

    if (talksasaToken && talksasaBaseUrl) {
      const smsResponse = await fetch(`${talksasaBaseUrl}/send`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${talksasaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender_id: talksasaSenderId || "AbanRemit",
          phone,
          message: `Your AbanRemit verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
        }),
      });

      if (!smsResponse.ok) {
        console.error("TalkSasa SMS failed:", await smsResponse.text());
        // Don't fail the request - OTP is still stored
      }
    } else {
      console.warn("TalkSasa not configured. OTP generated but not sent via SMS.");
    }

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-otp error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
