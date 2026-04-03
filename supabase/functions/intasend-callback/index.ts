import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("IntaSend callback received:", JSON.stringify(body));

    const invoiceId = body.invoice_id || body.invoice?.invoice_id || body.id;
    const state = body.state || body.invoice?.state || "";
    const apiRef = body.api_ref || body.invoice?.api_ref || "";
    const failedReason = body.failed_reason || body.invoice?.failed_reason || "";

    if (!invoiceId && !apiRef) {
      console.error("No invoice_id or api_ref in callback");
      return new Response(JSON.stringify({ error: "Missing identifier" }), { status: 400 });
    }

    // Check if this is a card transaction
    let isCardTx = false;
    if (apiRef && apiRef.startsWith("CARD-")) {
      isCardTx = true;
    }

    if (isCardTx) {
      // Handle card transaction callback
      let query = supabase.from("card_transactions").select("*");
      if (invoiceId) query = query.eq("invoice_id", invoiceId);
      else query = query.eq("reference", apiRef);
      const { data: cardTx, error: findError } = await query.maybeSingle();

      if (findError || !cardTx) {
        console.error("Card transaction not found:", invoiceId, apiRef);
        return new Response(JSON.stringify({ error: "Transaction not found" }), { status: 404 });
      }

      if (cardTx.status === "success" || cardTx.status === "failed") {
        return new Response(JSON.stringify({ message: "Already processed" }), { status: 200 });
      }

      const isSuccess = state === "COMPLETE" || state === "SUCCESSFUL";
      const isFailed = state === "FAILED" || state === "CANCELLED";

      if (isSuccess) {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("wallet_id, balance")
          .eq("user_id", cardTx.user_id)
          .single();

        if (wallet) {
          await supabase
            .from("wallets")
            .update({ balance: Number(wallet.balance) + Number(cardTx.amount) })
            .eq("user_id", cardTx.user_id);

          const txnId = `TXN-${crypto.randomUUID().replace(/-/g, "")}`;
          await supabase.from("transactions").insert({
            transaction_id: txnId,
            sender_wallet: "CARD",
            receiver_wallet: wallet.wallet_id,
            amount: cardTx.amount,
            fee: 0,
            status: "success",
            type: "deposit",
            description: `Card deposit of ${cardTx.currency} ${cardTx.amount}`,
          });

          await supabase.from("notifications").insert({
            user_id: cardTx.user_id,
            title: "Card Deposit Successful",
            message: `${cardTx.currency} ${cardTx.amount} deposited to your wallet via card.`,
            type: "credit",
          });

          await sendSmsNotification(supabase, cardTx.user_id,
            `AbanRemit: ${cardTx.currency} ${cardTx.amount} has been deposited to your wallet via card payment.`
          );
        }

        await supabase
          .from("card_transactions")
          .update({ status: "success", callback_data: body })
          .eq("id", cardTx.id);
      } else if (isFailed) {
        await supabase
          .from("card_transactions")
          .update({ status: "failed", callback_data: body })
          .eq("id", cardTx.id);

        await supabase.from("notifications").insert({
          user_id: cardTx.user_id,
          title: "Card Deposit Failed",
          message: `Card deposit of ${cardTx.currency} ${cardTx.amount} failed. ${failedReason || ""}`,
          type: "info",
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle M-Pesa transaction callback
    let query = supabase.from("mpesa_transactions").select("*");
    if (invoiceId) query = query.eq("invoice_id", invoiceId);
    else query = query.eq("reference", apiRef);
    const { data: mpesaTx, error: findError } = await query.maybeSingle();

    if (findError || !mpesaTx) {
      console.error("Transaction not found:", invoiceId, apiRef, findError);
      return new Response(JSON.stringify({ error: "Transaction not found" }), { status: 404 });
    }

    if (mpesaTx.status === "success" || mpesaTx.status === "failed") {
      return new Response(JSON.stringify({ message: "Already processed" }), { status: 200 });
    }

    const isSuccess = state === "COMPLETE" || state === "SUCCESSFUL" || state === "PROCESSING";
    const isFailed = state === "FAILED" || state === "CANCELLED";

    if (isSuccess) {
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("wallet_id, balance")
        .eq("user_id", mpesaTx.user_id)
        .single();

      if (walletError || !wallet) {
        console.error("Wallet not found for user:", mpesaTx.user_id);
        return new Response(JSON.stringify({ error: "Wallet not found" }), { status: 500 });
      }

      await supabase
        .from("wallets")
        .update({ balance: Number(wallet.balance) + Number(mpesaTx.amount) })
        .eq("user_id", mpesaTx.user_id);

      await supabase
        .from("mpesa_transactions")
        .update({ status: "success", callback_data: body })
        .eq("id", mpesaTx.id);

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

      await supabase.from("notifications").insert({
        user_id: mpesaTx.user_id,
        title: "Deposit Successful",
        message: `KES ${mpesaTx.amount} deposited to your wallet via M-Pesa.`,
        type: "credit",
      });

      // Send SMS notification
      await sendSmsNotification(supabase, mpesaTx.user_id,
        `AbanRemit: KES ${mpesaTx.amount} has been deposited to your wallet via M-Pesa. New balance available in your app.`
      );

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
