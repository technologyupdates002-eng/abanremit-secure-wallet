import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Smartphone, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Step = "enter_details" | "processing" | "result";

export default function Deposit() {
  const navigate = useNavigate();
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("enter_details");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const handleDeposit = async () => {
    const amt = Number(amount);
    if (!phone || phone.length < 10) {
      toast.error("Enter a valid phone number");
      return;
    }
    if (!amt || amt < 10 || amt > 150000) {
      toast.error("Amount must be between 10 and 150,000 KES");
      return;
    }

    setLoading(true);
    setStep("processing");

    try {
      const { data, error } = await supabase.functions.invoke("intasend-stk-push", {
        body: { phone, amount: amt },
      });

      if (error) throw error;

      if (data?.success) {
        setResult({ success: true, message: data.message });
        setStep("result");
        // Poll or wait for callback — user sees "check your phone" message
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } else {
        setResult({ success: false, error: data?.error || "Deposit failed" });
        setStep("result");
      }
    } catch {
      setResult({ success: false, error: "Failed to initiate deposit" });
      setStep("result");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Deposit via M-Pesa</h1>
      </div>

      {step === "enter_details" && (
        <div className="space-y-4 animate-fade-in">
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">M-Pesa STK Push</p>
                <p className="text-xs text-muted-foreground">You'll receive a prompt on your phone</p>
              </div>
            </CardContent>
          </Card>

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

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Amount (KES)</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                className="bg-secondary border-border/50 text-foreground text-lg"
              />
            </div>
          </div>

          {wallet && (
            <p className="text-xs text-muted-foreground">
              Current balance: KES {Number(wallet.balance).toLocaleString("en", { minimumFractionDigits: 2 })}
            </p>
          )}

          <Button
            onClick={handleDeposit}
            disabled={loading || !phone || !amount}
            className="w-full gradient-primary text-primary-foreground h-12"
          >
            Deposit
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="text-center py-12 animate-fade-in">
          <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-foreground font-semibold">Sending STK Push...</p>
          <p className="text-sm text-muted-foreground mt-2">Check your phone for the M-Pesa prompt</p>
        </div>
      )}

      {step === "result" && result && (
        <div className="text-center py-8 animate-fade-in space-y-4">
          {result.success ? (
            <>
              <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
              <h2 className="text-xl font-bold text-foreground">STK Push Sent!</h2>
              <p className="text-muted-foreground text-sm">{result.message}</p>
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
