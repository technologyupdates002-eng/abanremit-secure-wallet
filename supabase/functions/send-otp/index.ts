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

    const { phone, purpose, channel } = await req.json();

    // Determine OTP channel: check request param, then profile preference
    let otpChannel = channel || "phone";
    if (!channel) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("otp_channel")
        .eq("user_id", user.id)
        .single();
      if (profile?.otp_channel) {
        otpChannel = profile.otp_channel;
      }
    }

    // For SMS, phone is required
    if (otpChannel === "phone" && (!phone || typeof phone !== "string" || phone.length < 10)) {
      return new Response(JSON.stringify({ error: "Valid phone number required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const identifier = otpChannel === "email" ? user.email! : phone;

    // Rate limit: max 3 OTPs per identifier per 10 minutes
    const { count } = await supabase
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", identifier)
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

    // Hash the OTP
    const encoder = new TextEncoder();
    const data = encoder.encode(otp);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const codeHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Store hashed OTP
    await supabase.from("otp_codes").insert({
      user_id: user.id,
      phone: identifier,
      code_hash: codeHash,
      purpose: purpose || "verification",
      expires_at: expiresAt,
    });

    let sent = false;

    if (otpChannel === "email") {
      // Send via SMTP email
      const mailHost = Deno.env.get("MAIL_HOST");
      const mailPort = parseInt(Deno.env.get("MAIL_PORT") || "587");
      const mailUsername = Deno.env.get("MAIL_USERNAME");
      const mailPassword = Deno.env.get("MAIL_PASSWORD");
      const mailFromAddress = Deno.env.get("MAIL_FROM_ADDRESS") || mailUsername;
      const mailFromName = Deno.env.get("MAIL_FROM_NAME") || "AbanRemit";

      if (mailHost && mailUsername && mailPassword) {
        try {
          // Use Deno's built-in SMTP via denopkg or a simple fetch to an SMTP relay
          // Since Deno edge functions don't have native SMTP, we use the SMTP2GO-style HTTP API
          // or construct a raw SMTP connection. For simplicity, we'll use a fetch-based approach.
          
          const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
          
          const client = new SMTPClient({
            connection: {
              hostname: mailHost,
              port: mailPort,
              tls: true,
              auth: {
                username: mailUsername,
                password: mailPassword,
              },
            },
          });

          await client.send({
            from: `${mailFromName} <${mailFromAddress}>`,
            to: user.email!,
            subject: `Your AbanRemit Verification Code: ${otp}`,
            content: `auto`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #1d4ed8; font-size: 24px; margin: 0;">AbanRemit</h1>
                </div>
                <div style="background: #f8fafc; border-radius: 12px; padding: 24px; text-align: center;">
                  <p style="color: #334155; font-size: 14px; margin: 0 0 16px;">Your verification code is:</p>
                  <div style="background: #1d4ed8; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 24px; border-radius: 8px; display: inline-block;">
                    ${otp}
                  </div>
                  <p style="color: #64748b; font-size: 12px; margin: 16px 0 0;">Valid for 5 minutes. Do not share this code.</p>
                </div>
                <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px;">
                  If you didn't request this code, please ignore this email.
                </p>
              </div>
            `,
          });

          await client.close();
          sent = true;
        } catch (emailErr) {
          console.error("SMTP email failed:", emailErr);
        }
      } else {
        console.warn("SMTP not configured. OTP generated but not sent via email.");
      }
    } else {
      // Send via TalkSasa SMS
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
        } else {
          sent = true;
        }
      } else {
        console.warn("TalkSasa not configured. OTP generated but not sent via SMS.");
      }
    }

    const deliveryMethod = otpChannel === "email" ? "email" : "phone";

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `OTP sent to your ${deliveryMethod}`,
        channel: otpChannel,
      }),
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
