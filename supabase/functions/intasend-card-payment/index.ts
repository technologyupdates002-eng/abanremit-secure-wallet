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

    const { amount, currency } = await req.json();

    if (!amount || typeof amount !== "number" || amount <= 0 || amount > 500000) {
      return new Response(JSON.stringify({ error: "Amount must be between 1 and 500,000" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const intasendSecretKey = Deno.env.get("INTASEND_SECRET_KEY");
    const intasendPublishableKey = Deno.env.get("INTASEND_PUBLISHABLE_KEY");
    const intasendBaseUrl = Deno.env.get("INTASEND_BASE_URL");

    if (!intasendSecretKey || !intasendBaseUrl || !intasendPublishableKey) {
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = `CARD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Get user email for IntaSend checkout
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", user.id)
      .single();

    // Record the card transaction
    const { data: cardTx, error: insertError } = await supabase
      .from("card_transactions")
      .insert({
        user_id: user.id,
        amount,
        currency: currency || "KES",
        reference,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create transaction" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create IntaSend checkout for card payment
    const checkoutResponse = await fetch(`${intasendBaseUrl}/api/v1/checkout/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${intasendSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        public_key: intasendPublishableKey,
        amount,
        currency: currency || "KES",
        api_ref: reference,
        first_name: profile?.full_name?.split(" ")[0] || "Customer",
        last_name: profile?.full_name?.split(" ").slice(1).join(" ") || "",
        email: user.email,
        phone_number: profile?.phone || "",
        method: "CARD-PAYMENT",
        redirect_url: `${supabaseUrl}/functions/v1/intasend-callback`,
      }),
    });

    const checkoutData = await checkoutResponse.json();

    if (!checkoutResponse.ok) {
      console.error("IntaSend checkout error:", checkoutData);
      await supabase
        .from("card_transactions")
        .update({ status: "failed" })
        .eq("id", cardTx.id);

      return new Response(JSON.stringify({ error: "Failed to create checkout" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update with IntaSend invoice ID
    await supabase
      .from("card_transactions")
      .update({ invoice_id: checkoutData.id || checkoutData.invoice_id })
      .eq("id", cardTx.id);

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: checkoutData.url,
        invoice_id: checkoutData.id || checkoutData.invoice_id,
        reference,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("card-payment error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
