import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Smartphone, Lock, CheckCircle2, AlertCircle, Loader2, Wallet, Landmark } from "lucide-react";
import { useWallet, verifyPin, lookupWallet, processTransfer } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type WithdrawMethod = "phone" | "wallet" | "bank";
type Step = "choose_method" | "enter_details" | "review" | "pin" | "processing" | "result";

export default function Withdraw() {
  const navigate = useNavigate();
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();

  const [method, setMethod] = useState<WithdrawMethod | null>(null);
  const [step, setStep] = useState<Step>("choose_method");
  const [phone, setPhone] = useState("");
  const [recipientWalletId, setRecipientWalletId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const fee = Math.ceil(Number(amount) * 0.01);
  const total = Number(amount) + fee;
  const currency = wallet?.currency || "KES";

  const handleMethodSelect = (m: WithdrawMethod) => {
    setMethod(m);
    setStep("enter_details");
  };

  const handleLookupWallet = async () => {
    if (!recipientWalletId.trim()) return;
    setLoading(true);
    try {
      const res = await lookupWallet(recipientWalletId.trim().toUpperCase());
      if (res.found) {
        setRecipientName(res.full_name || "Unknown");
        setRecipientWalletId(res.wallet_id || recipientWalletId);
        toast.success(`Found: ${res.full_name}`);
      } else {
        toast.error("Wallet not found");
      }
    } catch {
      toast.error("Lookup failed");
    }
    setLoading(false);
  };

  const handleReview = () => {
    const amt = Number(amount);
    if (method === "phone" && (!phone || phone.length < 10)) {
      toast.error("Enter a valid phone number"); return;
    }
    if (method === "wallet" && !recipientName) {
      toast.error("Look up the wallet first"); return;
    }
    if (method === "bank" && (!bankName || !accountNumber || !accountName)) {
      toast.error("Fill in all bank details"); return;
    }
    if (!amt || amt < 10) {
      toast.error("Minimum withdrawal is 10 " + currency); return;
    }
    if (wallet && total > Number(wallet.balance)) {
      toast.error("Insufficient balance"); return;
    }
    setStep("review");
  };

  const handlePinSubmit = async () => {
    if (pin.length < 4) { toast.error("Enter your PIN"); return; }
    setLoading(true);
    try {
      const pinResult = await verifyPin(pin);
      if (!pinResult.valid) {
        toast.error(pinResult.error || "Invalid PIN");
        setPin(""); setLoading(false); return;
      }
      setStep("processing");

      if (method === "phone") {
        const { data, error } = await supabase.functions.invoke("intasend-b2c", {
          body: { phone, amount: Number(amount) },
        });
        if (error) throw error;
        setResult({ success: data?.success, message: data?.message, error: data?.error });
      } else if (method === "wallet") {
        const res = await processTransfer(wallet!.wallet_id, recipientWalletId, Number(amount), fee, "Wallet withdrawal");
        setResult({ success: res.success, message: res.transaction_id, error: res.error });
      } else {
        // Bank transfer placeholder
        toast.info("Bank transfers are coming soon");
        setResult({ success: false, error: "Bank transfers are not yet available. Please use M-Pesa or Wallet." });
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

  const goBack = () => {
    if (step === "choose_method") navigate("/");
    else if (step === "enter_details") { setStep("choose_method"); setMethod(null); }
    else if (step === "review") setStep("enter_details");
    else if (step === "pin") setStep("review");
    else navigate("/");
  };

  const methodLabel = method === "phone" ? "M-Pesa" : method === "wallet" ? "Wallet" : "Bank";

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={goBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">
          {step === "choose_method" ? "Withdraw" : `Withdraw to ${methodLabel}`}
        </h1>
      </div>

      {step === "choose_method" && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-muted-foreground text-sm">Where do you want to withdraw to?</p>
          {[
            { m: "phone" as WithdrawMethod, icon: Smartphone, title: "M-Pesa", desc: "Withdraw to your M-Pesa phone number" },
            { m: "wallet" as WithdrawMethod, icon: Wallet, title: "Another Wallet", desc: "Transfer to another AbanRemit wallet" },
            { m: "bank" as WithdrawMethod, icon: Landmark, title: "Bank Account", desc: "Withdraw directly to your bank" },
          ].map(({ m, icon: Icon, title, desc }) => (
            <button key={m} onClick={() => handleMethodSelect(m)} className="w-full">
              <Card className="glass-card hover:border-primary/50 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {step === "enter_details" && (
        <div className="space-y-4 animate-fade-in">
          {method === "phone" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">M-Pesa Phone Number</label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="254712345678" className="bg-secondary border-border/50 text-foreground" autoFocus />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Amount ({currency})</label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" className="bg-secondary border-border/50 text-foreground text-lg" />
              </div>
            </div>
          )}

          {method === "wallet" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Recipient Wallet ID</label>
                <div className="flex gap-2">
                  <Input value={recipientWalletId} onChange={(e) => setRecipientWalletId(e.target.value.toUpperCase())} placeholder="ABN-XXXXX" className="bg-secondary border-border/50 text-foreground font-mono flex-1" autoFocus />
                  <Button variant="outline" onClick={handleLookupWallet} disabled={loading}>Look up</Button>
                </div>
                {recipientName && <p className="text-sm text-primary font-medium mt-1">✓ {recipientName}</p>}
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Amount ({currency})</label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" className="bg-secondary border-border/50 text-foreground text-lg" />
              </div>
            </div>
          )}

          {method === "bank" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Bank Name</label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Equity Bank" className="bg-secondary border-border/50 text-foreground" autoFocus />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Account Number</label>
                <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="1234567890" className="bg-secondary border-border/50 text-foreground" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Account Name</label>
                <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="John Doe" className="bg-secondary border-border/50 text-foreground" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Amount ({currency})</label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" className="bg-secondary border-border/50 text-foreground text-lg" />
              </div>
            </div>
          )}

          {wallet && (
            <p className="text-xs text-muted-foreground">
              Balance: {currency} {Number(wallet.balance).toLocaleString("en", { minimumFractionDigits: 2 })}
            </p>
          )}

          <Button onClick={handleReview} disabled={!amount} className="w-full gradient-primary text-primary-foreground h-12">
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
                <span className="text-muted-foreground">Method</span>
                <span className="text-foreground font-medium">{methodLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">To</span>
                <span className="text-foreground font-mono">
                  {method === "phone" ? phone : method === "wallet" ? `${recipientName} (${recipientWalletId})` : `${accountName} - ${bankName}`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-foreground">{currency} {Number(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fee (1%)</span>
                <span className="text-foreground">{currency} {fee.toLocaleString()}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-foreground font-semibold">Total Deducted</span>
                <span className="text-foreground font-bold">{currency} {total.toLocaleString()}</span>
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
            type="password" inputMode="numeric" maxLength={6} value={pin}
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
