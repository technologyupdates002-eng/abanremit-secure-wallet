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
    if (!amount || typeof amount !== "number" || amount <= 0 || amount > 150000) {
      return new Response(JSON.stringify({ error: "Amount must be between 1 and 150,000 KES" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const intasendSecretKey = Deno.env.get("INTASEND_SECRET_KEY");
    const intasendBaseUrl = Deno.env.get("INTASEND_BASE_URL");
    const intasendPublishableKey = Deno.env.get("INTASEND_PUBLISHABLE_KEY");

    if (!intasendSecretKey || !intasendBaseUrl) {
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create mpesa_transaction record first
    const reference = `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { data: mpesaTx, error: insertError } = await supabase
      .from("mpesa_transactions")
      .insert({
        user_id: user.id,
        phone,
        amount,
        reference,
        type: "stk_push",
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create transaction record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call IntaSend STK Push API
    const stkResponse = await fetch(`${intasendBaseUrl}/api/v1/payment/mpesa-stk-push/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${intasendSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        phone_number: phone,
        api_ref: reference,
        narrative: "AbanRemit Wallet Deposit",
      }),
    });

    const stkData = await stkResponse.json();

    if (!stkResponse.ok) {
      console.error("IntaSend STK error:", stkData);
      await supabase
        .from("mpesa_transactions")
        .update({ status: "failed", error_message: JSON.stringify(stkData) })
        .eq("id", mpesaTx.id);

      return new Response(JSON.stringify({ error: "Failed to initiate payment" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update with IntaSend reference IDs
    await supabase
      .from("mpesa_transactions")
      .update({
        invoice_id: stkData.invoice?.invoice_id || stkData.id,
        checkout_request_id: stkData.checkout_request_id || stkData.id,
        status: "processing",
      })
      .eq("id", mpesaTx.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "STK push sent. Check your phone.",
        reference,
        invoice_id: stkData.invoice?.invoice_id || stkData.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("stk-push error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
