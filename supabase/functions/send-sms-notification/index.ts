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

    // Get the user's phone and wallet from profile
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

    // Charge SMS fee from user wallet → admin wallet
    const smsFeeResult = await chargeSMSFee(supabase, user_id);
    if (smsFeeResult.error) {
      console.warn("SMS fee charge failed (sending anyway):", smsFeeResult.error);
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
      const errText = await smsResponse.text();
      console.error("TalkSasa SMS failed:", errText);
      return new Response(JSON.stringify({ success: false, error: "SMS send failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, fee_charged: smsFeeResult.fee || 0 }), {
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

async function chargeSMSFee(supabase: any, userId: string): Promise<{ fee?: number; error?: string }> {
  try {
    // Get SMS fee from global settings
    const { data: setting } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "sms_notification_fee")
      .single();

    const fee = setting?.value ? Number(setting.value) : 0;
    if (fee <= 0) return { fee: 0 };

    // Get user wallet
    const { data: wallet } = await supabase
      .from("wallets")
      .select("wallet_id, balance")
      .eq("user_id", userId)
      .single();

    if (!wallet) return { error: "No wallet found" };
    if (Number(wallet.balance) < fee) return { error: "Insufficient balance for SMS fee" };

    // Deduct from user wallet
    await supabase
      .from("wallets")
      .update({ balance: Number(wallet.balance) - fee })
      .eq("user_id", userId);

    // Credit admin wallet
    await supabase
      .from("admin_wallet")
      .update({ balance: supabase.rpc ? undefined : 0 })
      .eq("wallet_id", "ABN-ADMIN");

    // Use raw SQL increment approach
    const { data: adminWallet } = await supabase
      .from("admin_wallet")
      .select("balance")
      .eq("wallet_id", "ABN-ADMIN")
      .single();

    if (adminWallet) {
      await supabase
        .from("admin_wallet")
        .update({ balance: Number(adminWallet.balance) + fee })
        .eq("wallet_id", "ABN-ADMIN");
    }

    // Record the fee transaction
    const txnId = `TXN-SMS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await supabase.from("transactions").insert({
      transaction_id: txnId,
      sender_wallet: wallet.wallet_id,
      receiver_wallet: "ABN-ADMIN",
      amount: fee,
      fee: 0,
      status: "success",
      type: "wallet_transfer",
      description: "SMS notification fee",
    });

    return { fee };
  } catch (err) {
    console.error("SMS fee charge error:", err);
    return { error: String(err) };
  }
}
