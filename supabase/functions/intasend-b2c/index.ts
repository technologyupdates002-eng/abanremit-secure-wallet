import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendSmsNotification(supabase: any, userId: string, message: string) {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("user_id", userId)
      .single();

    if (!profile?.phone) return;

    const talksasaToken = Deno.env.get("TALKSASA_API_TOKEN");
    const talksasaBaseUrl = Deno.env.get("TALKSASA_BASE_URL");
    const talksasaSenderId = Deno.env.get("TALKSASA_DEFAULT_SENDER_ID");

    if (!talksasaToken || !talksasaBaseUrl) return;

    await fetch(`${talksasaBaseUrl}/send`, {
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
  } catch (err) {
    console.error("SMS notification failed:", err);
  }
}

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

    const { phone, amount } = await req.json();

    if (!phone || typeof phone !== "string" || phone.length < 10) {
      return new Response(JSON.stringify({ error: "Valid phone number required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!amount || typeof amount !== "number" || amount <= 0 || amount > 70000) {
      return new Response(JSON.stringify({ error: "Amount must be between 1 and 70,000 KES" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (walletError || !wallet) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fee = Math.ceil(amount * 0.01);
    const total = amount + fee;

    if (Number(wallet.balance) < total) {
      return new Response(JSON.stringify({ error: "Insufficient balance" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const intasendSecretKey = Deno.env.get("INTASEND_SECRET_KEY");
    const intasendBaseUrl = Deno.env.get("INTASEND_BASE_URL");

    if (!intasendSecretKey || !intasendBaseUrl) {
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct balance immediately
    await supabase
      .from("wallets")
      .update({ balance: Number(wallet.balance) - total })
      .eq("user_id", user.id);

    // Route fee to admin wallet
    if (fee > 0) {
      await supabase.rpc("charge_admin_fee", {}).catch(() => {
        // Fallback: direct update
        supabase
          .from("admin_wallet")
          .update({ balance: supabase.rpc ? fee : fee })
          .eq("wallet_id", "ABN-ADMIN");
      });
      // Direct admin wallet credit
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
    }

    const reference = `WDR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data: mpesaTx } = await supabase
      .from("mpesa_transactions")
      .insert({
        user_id: user.id,
        phone,
        amount,
        reference,
        type: "b2c",
        status: "processing",
      })
      .select()
      .single();

    const b2cResponse = await fetch(`${intasendBaseUrl}/api/v1/send-money/initiate/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${intasendSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currency: "KES",
        transactions: [
          {
            account: phone,
            amount: String(amount),
            narrative: "AbanRemit Wallet Withdrawal",
            name: "Withdrawal",
          },
        ],
      }),
    });

    const b2cData = await b2cResponse.json();

    if (!b2cResponse.ok) {
      console.error("IntaSend B2C error:", b2cData);
      // Reverse the deduction
      await supabase
        .from("wallets")
        .update({ balance: Number(wallet.balance) })
        .eq("user_id", user.id);

      // Reverse admin fee
      if (fee > 0) {
        const { data: adminWallet } = await supabase
          .from("admin_wallet")
          .select("balance")
          .eq("wallet_id", "ABN-ADMIN")
          .single();
        if (adminWallet) {
          await supabase
            .from("admin_wallet")
            .update({ balance: Math.max(0, Number(adminWallet.balance) - fee) })
            .eq("wallet_id", "ABN-ADMIN");
        }
      }

      if (mpesaTx) {
        await supabase
          .from("mpesa_transactions")
          .update({ status: "failed", error_message: JSON.stringify(b2cData) })
          .eq("id", mpesaTx.id);
      }

      return new Response(JSON.stringify({ error: "Withdrawal failed. Balance restored." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mpesaTx) {
      await supabase
        .from("mpesa_transactions")
        .update({ invoice_id: b2cData.tracking_id || b2cData.id })
        .eq("id", mpesaTx.id);
    }

    const txnId = `TXN-${crypto.randomUUID().replace(/-/g, "")}`;
    await supabase.from("transactions").insert({
      transaction_id: txnId,
      sender_wallet: wallet.wallet_id,
      receiver_wallet: "MPESA",
      amount,
      fee,
      status: "pending",
      type: "withdrawal",
      description: `M-Pesa withdrawal to ${phone}`,
    });

    await supabase.from("notifications").insert({
      user_id: user.id,
      title: "Withdrawal Processing",
      message: `KES ${amount} withdrawal to ${phone} is being processed.`,
      type: "debit",
    });

    // Send SMS notification
    await sendSmsNotification(supabase, user.id,
      `AbanRemit: Your withdrawal of KES ${amount} to ${phone} is being processed. Fee: KES ${fee}.`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Withdrawal initiated successfully",
        reference,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("b2c error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
