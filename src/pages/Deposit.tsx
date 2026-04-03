import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Smartphone, CreditCard, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type DepositMethod = "mpesa" | "card";
type Step = "choose_method" | "enter_details" | "processing" | "result";

export default function Deposit() {
  const navigate = useNavigate();
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();

  const [method, setMethod] = useState<DepositMethod | null>(null);
  const [step, setStep] = useState<Step>("choose_method");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string; checkout_url?: string } | null>(null);

  const handleDeposit = async () => {
    const amt = Number(amount);
    if (!amt || amt < 10) {
      toast.error("Minimum deposit is 10 KES");
      return;
    }

    if (method === "mpesa") {
      if (!phone || phone.length < 10) {
        toast.error("Enter a valid phone number");
        return;
      }
      if (amt > 150000) {
        toast.error("Maximum M-Pesa deposit is 150,000 KES");
        return;
      }
    }

    if (method === "card" && amt > 500000) {
      toast.error("Maximum card deposit is 500,000 KES");
      return;
    }

    setLoading(true);
    setStep("processing");

    try {
      if (method === "mpesa") {
        const { data, error } = await supabase.functions.invoke("intasend-stk-push", {
          body: { phone, amount: amt },
        });
        if (error) throw error;
        if (data?.success) {
          setResult({ success: true, message: data.message });
        } else {
          setResult({ success: false, error: data?.error || "Deposit failed" });
        }
      } else {
        // Card payment
        const { data, error } = await supabase.functions.invoke("intasend-card-payment", {
          body: { amount: amt, currency: "KES" },
        });
        if (error) throw error;
        if (data?.success && data?.checkout_url) {
          // Open IntaSend checkout in new tab
          window.open(data.checkout_url, "_blank");
          setResult({ success: true, message: "Payment page opened. Complete payment in the new tab.", checkout_url: data.checkout_url });
        } else {
          setResult({ success: false, error: data?.error || "Failed to create checkout" });
        }
      }

      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      setResult({ success: false, error: "Failed to initiate deposit" });
      setStep("result");
    }
    setLoading(false);
  };

  const goBack = () => {
    if (step === "choose_method") navigate("/");
    else if (step === "enter_details") { setStep("choose_method"); setMethod(null); }
    else navigate("/");
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={goBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">
          {step === "choose_method" ? "Deposit" : method === "mpesa" ? "Deposit via M-Pesa" : "Deposit via Card"}
        </h1>
      </div>

      {step === "choose_method" && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-muted-foreground text-sm">How would you like to deposit?</p>
          <button onClick={() => { setMethod("mpesa"); setStep("enter_details"); }} className="w-full">
            <Card className="glass-card hover:border-primary/50 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">M-Pesa</p>
                  <p className="text-xs text-muted-foreground">Deposit via M-Pesa STK Push</p>
                </div>
              </CardContent>
            </Card>
          </button>
          <button onClick={() => { setMethod("card"); setStep("enter_details"); }} className="w-full">
            <Card className="glass-card hover:border-primary/50 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Debit/Credit Card</p>
                  <p className="text-xs text-muted-foreground">Pay with Visa, Mastercard, or other cards</p>
                </div>
              </CardContent>
            </Card>
          </button>
        </div>
      )}

      {step === "enter_details" && (
        <div className="space-y-4 animate-fade-in">
          {method === "mpesa" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Phone Number</label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="254712345678"
                  className="bg-secondary border-border/50 text-foreground"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">Format: 254XXXXXXXXX</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Amount (KES)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              className="bg-secondary border-border/50 text-foreground text-lg"
              autoFocus={method === "card"}
            />
          </div>

          {wallet && (
            <p className="text-xs text-muted-foreground">
              Current balance: KES {Number(wallet.balance).toLocaleString("en", { minimumFractionDigits: 2 })}
            </p>
          )}

          <Button
            onClick={handleDeposit}
            disabled={loading || !amount || (method === "mpesa" && !phone)}
            className="w-full gradient-primary text-primary-foreground h-12"
          >
            {method === "mpesa" ? "Send STK Push" : "Pay with Card"}
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="text-center py-12 animate-fade-in">
          <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-foreground font-semibold">
            {method === "mpesa" ? "Sending STK Push..." : "Creating payment..."}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {method === "mpesa" ? "Check your phone for the M-Pesa prompt" : "Please wait..."}
          </p>
        </div>
      )}

      {step === "result" && result && (
        <div className="text-center py-8 animate-fade-in space-y-4">
          {result.success ? (
            <>
              <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
              <h2 className="text-xl font-bold text-foreground">
                {method === "mpesa" ? "STK Push Sent!" : "Checkout Created!"}
              </h2>
              <p className="text-muted-foreground text-sm">{result.message}</p>
              {result.checkout_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(result.checkout_url, "_blank")}
                  className="border-primary text-primary"
                >
                  Open Payment Page
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Your wallet will be credited once payment is confirmed.</p>
            </>
          ) : (
            <>
              <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Deposit Failed</h2>
              <p className="text-muted-foreground text-sm">{result.error}</p>
            </>
          )}
          <Button onClick={() => navigate("/")} className="w-full gradient-primary text-primary-foreground h-12">
            Back to Home
          </Button>
        </div>
      )}
    </div>
  );
}
