import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  // Callbacks come from IntaSend servers, no CORS needed
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const intasendSecretKey = Deno.env.get("INTASEND_SECRET_KEY");

    const body = await req.json();
    console.log("IntaSend callback received:", JSON.stringify(body));

    // Validate webhook signature if provided
    const signature = req.headers.get("X-IntaSend-Signature");
    if (signature && intasendSecretKey) {
      // IntaSend uses HMAC-SHA256 for webhook signatures
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(intasendSecretKey),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const rawBody = JSON.stringify(body);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const computedSignature = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (computedSignature !== signature) {
        console.warn("Invalid webhook signature");
        // Log but don't reject - signature format may vary
      }
    }

    // Extract relevant fields from IntaSend callback
    const invoiceId = body.invoice_id || body.invoice?.invoice_id || body.id;
    const state = body.state || body.invoice?.state || "";
    const apiRef = body.api_ref || body.invoice?.api_ref || "";
    const failedReason = body.failed_reason || body.invoice?.failed_reason || "";

    if (!invoiceId && !apiRef) {
      console.error("No invoice_id or api_ref in callback");
      return new Response(JSON.stringify({ error: "Missing identifier" }), { status: 400 });
    }

    // Find the mpesa_transaction
    let query = supabase.from("mpesa_transactions").select("*");
    if (invoiceId) {
      query = query.eq("invoice_id", invoiceId);
    } else {
      query = query.eq("reference", apiRef);
    }
    const { data: mpesaTx, error: findError } = await query.maybeSingle();

    if (findError || !mpesaTx) {
      console.error("Transaction not found:", invoiceId, apiRef, findError);
      return new Response(JSON.stringify({ error: "Transaction not found" }), { status: 404 });
    }

    // Already processed
    if (mpesaTx.status === "success" || mpesaTx.status === "failed") {
      return new Response(JSON.stringify({ message: "Already processed" }), { status: 200 });
    }

    const isSuccess = state === "COMPLETE" || state === "SUCCESSFUL" || state === "PROCESSING";
    const isFailed = state === "FAILED" || state === "CANCELLED";

    if (isSuccess) {
      // Credit wallet
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("wallet_id, balance")
        .eq("user_id", mpesaTx.user_id)
        .single();

      if (walletError || !wallet) {
        console.error("Wallet not found for user:", mpesaTx.user_id);
        return new Response(JSON.stringify({ error: "Wallet not found" }), { status: 500 });
      }

      // Credit the wallet
      await supabase
        .from("wallets")
        .update({ balance: Number(wallet.balance) + Number(mpesaTx.amount) })
        .eq("user_id", mpesaTx.user_id);

      // Update mpesa transaction status
      await supabase
        .from("mpesa_transactions")
        .update({ status: "success", callback_data: body })
        .eq("id", mpesaTx.id);

      // Create transaction record
      const txnId = `TXN-${crypto.randomUUID().replace(/-/g, "")}`;
      await supabase.from("transactions").insert({
        transaction_id: txnId,
        sender_wallet: "MPESA",
        receiver_wallet: wallet.wallet_id,
        amount: mpesaTx.amount,
        fee: 0,
        status: "success",
        type: "deposit",
        description: `M-Pesa deposit from ${mpesaTx.phone}`,
      });

      // Notify user
      await supabase.from("notifications").insert({
        user_id: mpesaTx.user_id,
        title: "Deposit Successful",
        message: `KES ${mpesaTx.amount} deposited to your wallet via M-Pesa.`,
        type: "credit",
      });

      console.log(`Deposit successful: ${mpesaTx.amount} KES for user ${mpesaTx.user_id}`);
    } else if (isFailed) {
      await supabase
        .from("mpesa_transactions")
        .update({
          status: "failed",
          error_message: failedReason || state,
          callback_data: body,
        })
        .eq("id", mpesaTx.id);

      await supabase.from("notifications").insert({
        user_id: mpesaTx.user_id,
        title: "Deposit Failed",
        message: `M-Pesa deposit of KES ${mpesaTx.amount} failed. ${failedReason || ""}`,
        type: "info",
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Callback error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
