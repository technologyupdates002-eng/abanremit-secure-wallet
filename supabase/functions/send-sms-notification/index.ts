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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, message } = await req.json();

    if (!user_id || !message) {
      return new Response(JSON.stringify({ error: "user_id and message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user's phone from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, full_name")
      .eq("user_id", user_id)
      .single();

    if (!profile?.phone) {
      return new Response(JSON.stringify({ success: false, error: "No phone on profile" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const talksasaToken = Deno.env.get("TALKSASA_API_TOKEN");
    const talksasaBaseUrl = Deno.env.get("TALKSASA_BASE_URL");
    const talksasaSenderId = Deno.env.get("TALKSASA_DEFAULT_SENDER_ID");

    if (!talksasaToken || !talksasaBaseUrl) {
      console.warn("TalkSasa not configured");
      return new Response(JSON.stringify({ success: false, error: "SMS not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smsResponse = await fetch(`${talksasaBaseUrl}/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${talksasaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender_id: talksasaSenderId || "AbanRemit",
        phone: profile.phone,
        message,
      }),
    });

    if (!smsResponse.ok) {
      console.error("TalkSasa SMS failed:", await smsResponse.text());
      return new Response(JSON.stringify({ success: false, error: "SMS send failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-sms error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
