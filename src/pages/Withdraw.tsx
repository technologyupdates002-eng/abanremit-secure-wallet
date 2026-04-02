import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Smartphone, Lock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useWallet, verifyPin } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Step = "enter_details" | "review" | "pin" | "processing" | "result";

export default function Withdraw() {
  const navigate = useNavigate();
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("enter_details");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const fee = Math.ceil(Number(amount) * 0.01);
  const total = Number(amount) + fee;

  const handleReview = () => {
    const amt = Number(amount);
    if (!phone || phone.length < 10) {
      toast.error("Enter a valid phone number");
      return;
    }
    if (!amt || amt < 10 || amt > 70000) {
      toast.error("Amount must be between 10 and 70,000 KES");
      return;
    }
    if (wallet && total > Number(wallet.balance)) {
      toast.error("Insufficient balance");
      return;
    }
    setStep("review");
  };

  const handlePinSubmit = async () => {
    if (pin.length < 4) {
      toast.error("Enter your PIN");
      return;
    }
    setLoading(true);

    try {
      const pinResult = await verifyPin(pin);
      if (!pinResult.valid) {
        toast.error(pinResult.error || "Invalid PIN");
        setPin("");
        setLoading(false);
        return;
      }

      setStep("processing");

      const { data, error } = await supabase.functions.invoke("intasend-b2c", {
        body: { phone, amount: Number(amount) },
      });

      if (error) throw error;

      if (data?.success) {
        setResult({ success: true, message: data.message });
      } else {
        setResult({ success: false, error: data?.error || "Withdrawal failed" });
      }
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      setResult({ success: false, error: "Withdrawal failed" });
      setStep("result");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => (step === "enter_details" ? navigate("/") : setStep("enter_details"))}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Withdraw to M-Pesa</h1>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1 mb-6">
        {["enter_details", "review", "pin"].map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              ["enter_details", "review", "pin", "processing", "result"].indexOf(step) >= i
                ? "bg-primary"
                : "bg-secondary"
            }`}
          />
        ))}
      </div>

      {step === "enter_details" && (
        <div className="space-y-4 animate-fade-in">
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">M-Pesa Withdrawal</p>
                <p className="text-xs text-muted-foreground">Funds sent directly to your M-Pesa</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">M-Pesa Phone Number</label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="254712345678"
                className="bg-secondary border-border/50 text-foreground"
                autoFocus
              />
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
              Balance: KES {Number(wallet.balance).toLocaleString("en", { minimumFractionDigits: 2 })}
            </p>
          )}

          <Button onClick={handleReview} disabled={!phone || !amount} className="w-full gradient-primary text-primary-foreground h-12">
            Continue
          </Button>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-lg font-semibold text-foreground text-center">Review Withdrawal</p>
          <Card className="glass-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">To</span>
                <span className="text-foreground font-mono">{phone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-foreground">KES {Number(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fee (1%)</span>
                <span className="text-foreground">KES {fee.toLocaleString()}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-foreground font-semibold">Total Deducted</span>
                <span className="text-foreground font-bold">KES {total.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Button onClick={() => setStep("pin")} className="w-full gradient-primary text-primary-foreground h-12">
            Authorize with PIN
          </Button>
        </div>
      )}

      {step === "pin" && (
        <div className="space-y-4 animate-fade-in text-center">
          <Lock className="w-12 h-12 text-primary mx-auto" />
          <p className="text-foreground font-semibold">Enter your transaction PIN</p>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
            className="bg-secondary border-border/50 text-foreground text-center text-3xl tracking-[0.5em] max-w-[200px] mx-auto"
            autoFocus
          />
          <Button onClick={handlePinSubmit} disabled={loading || pin.length < 4} className="w-full gradient-primary text-primary-foreground h-12">
            {loading ? "Processing..." : "Confirm Withdrawal"}
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="text-center py-12 animate-fade-in">
          <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-foreground font-semibold">Processing withdrawal...</p>
        </div>
      )}

      {step === "result" && result && (
        <div className="text-center py-8 animate-fade-in space-y-4">
          {result.success ? (
            <>
              <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Withdrawal Initiated!</h2>
              <p className="text-muted-foreground text-sm">{result.message}</p>
            </>
          ) : (
            <>
              <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Withdrawal Failed</h2>
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
