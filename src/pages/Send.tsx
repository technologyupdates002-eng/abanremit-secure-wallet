import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Search, User, CheckCircle2, AlertCircle, Lock, Send as SendIcon, Smartphone, Wallet } from "lucide-react";
import { useWallet, lookupWallet, verifyPin, processTransfer, useProfile } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type SendMethod = "wallet" | "phone";
type Step = "choose_method" | "enter_wallet" | "enter_phone" | "confirm_recipient" | "enter_amount" | "review" | "pin" | "processing" | "result";

export default function Send() {
  const navigate = useNavigate();
  const { data: wallet } = useWallet();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const [method, setMethod] = useState<SendMethod | null>(null);
  const [step, setStep] = useState<Step>("choose_method");
  const [recipientWalletId, setRecipientWalletId] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; transaction_id?: string; error?: string; message?: string } | null>(null);

  const fee = Number(amount) * 0.01;
  const total = Number(amount) + fee;
  const currency = wallet?.currency || "KES";

  const handleMethodSelect = (m: SendMethod) => {
    setMethod(m);
    setStep(m === "wallet" ? "enter_wallet" : "enter_phone");
  };

  const handleLookup = async () => {
    if (!recipientWalletId.trim()) return;
    setLoading(true);
    try {
      const result = await lookupWallet(recipientWalletId.trim().toUpperCase());
      if (result.found) {
        setRecipientName(result.full_name || "Unknown");
        setRecipientWalletId(result.wallet_id || recipientWalletId);
        setStep("confirm_recipient");
      } else {
        toast.error("Wallet not found. Check the ID and try again.");
      }
    } catch {
      toast.error("Failed to look up wallet");
    }
    setLoading(false);
  };

  const handlePhoneNext = () => {
    if (!recipientPhone || recipientPhone.length < 10) {
      toast.error("Enter a valid phone number");
      return;
    }
    setStep("enter_amount");
  };

  const handleAmountNext = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (wallet && amt + fee > Number(wallet.balance)) { toast.error("Insufficient balance"); return; }
    setStep("review");
  };

  const handlePinSubmit = async () => {
    if (pin.length < 4) { toast.error("Enter your PIN"); return; }
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

      if (method === "wallet") {
        const result = await processTransfer(
          wallet!.wallet_id, recipientWalletId, Number(amount), fee, description || undefined
        );
        setTxResult(result);

        // Send SMS notifications for wallet transfers
        if (result.success) {
          try {
            await supabase.functions.invoke("send-sms-notification", {
              body: {
                user_id: wallet!.user_id,
                message: `AbanRemit: You sent ${currency} ${Number(amount).toLocaleString()} to ${recipientName} (${recipientWalletId}). Ref: ${result.transaction_id}`,
              },
            });
          } catch { /* SMS is best effort */ }
        }
      } else {
        // Phone-based send via M-Pesa B2C
        const { data, error } = await supabase.functions.invoke("intasend-b2c", {
          body: { phone: recipientPhone, amount: Number(amount) },
        });
        if (error) throw error;
        setTxResult({ success: data?.success, message: data?.message, error: data?.error });
      }

      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      toast.error("Transaction failed");
      setStep("review");
    }
    setLoading(false);
  };

  const goBack = () => {
    if (step === "choose_method") navigate("/");
    else if (step === "enter_wallet" || step === "enter_phone") setStep("choose_method");
    else if (step === "confirm_recipient") setStep("enter_wallet");
    else if (step === "enter_amount") setStep(method === "wallet" ? "confirm_recipient" : "enter_phone");
    else if (step === "review") setStep("enter_amount");
    else if (step === "pin") setStep("review");
    else navigate("/");
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={goBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Send Money</h1>
      </div>

      {step === "choose_method" && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-muted-foreground text-sm">How would you like to send?</p>
          <button onClick={() => handleMethodSelect("wallet")} className="w-full">
            <Card className="glass-card hover:border-primary/50 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">To Wallet</p>
                  <p className="text-xs text-muted-foreground">Send to an AbanRemit wallet ID</p>
                </div>
              </CardContent>
            </Card>
          </button>
          <button onClick={() => handleMethodSelect("phone")} className="w-full">
            <Card className="glass-card hover:border-primary/50 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">To Phone (M-Pesa)</p>
                  <p className="text-xs text-muted-foreground">Send directly to a phone number</p>
                </div>
              </CardContent>
            </Card>
          </button>
        </div>
      )}

      {step === "enter_wallet" && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-muted-foreground text-sm">Enter recipient's wallet ID</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={recipientWalletId}
              onChange={(e) => setRecipientWalletId(e.target.value.toUpperCase())}
              placeholder="ABN-XXXXX"
              className="pl-10 bg-secondary border-border/50 text-foreground font-mono text-lg"
              autoFocus
            />
          </div>
          <Button onClick={handleLookup} disabled={loading || !recipientWalletId.trim()} className="w-full gradient-primary text-primary-foreground h-12">
            {loading ? "Looking up..." : "Find Wallet"}
          </Button>
        </div>
      )}

      {step === "enter_phone" && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-muted-foreground text-sm">Enter recipient's phone number</p>
          <div className="relative">
            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="tel"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="254712345678"
              className="pl-10 bg-secondary border-border/50 text-foreground text-lg"
              autoFocus
            />
          </div>
          <Button onClick={handlePhoneNext} disabled={!recipientPhone || recipientPhone.length < 10} className="w-full gradient-primary text-primary-foreground h-12">
            Continue
          </Button>
        </div>
      )}

      {step === "confirm_recipient" && (
        <div className="space-y-4 animate-fade-in">
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{recipientName}</p>
                <p className="text-sm text-muted-foreground font-mono">{recipientWalletId}</p>
              </div>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground text-center">Is this the right person?</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => { setStep("enter_wallet"); setRecipientWalletId(""); }}>
              No, go back
            </Button>
            <Button onClick={() => setStep("enter_amount")} className="gradient-primary text-primary-foreground">
              Yes, continue
            </Button>
          </div>
        </div>
      )}

      {step === "enter_amount" && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-muted-foreground text-sm">How much do you want to send?</p>
          <div className="text-center py-4">
            <span className="text-muted-foreground text-2xl">{currency}</span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-transparent border-none text-center text-5xl font-bold text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
            />
          </div>
          {wallet && (
            <p className="text-xs text-muted-foreground text-center">
              Balance: {currency} {Number(wallet.balance).toLocaleString("en", { minimumFractionDigits: 2 })}
            </p>
          )}
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's it for? (optional)"
            className="bg-secondary border-border/50 text-foreground"
          />
          <Button onClick={handleAmountNext} disabled={!amount || Number(amount) <= 0} className="w-full gradient-primary text-primary-foreground h-12">
            Continue
          </Button>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-lg font-semibold text-foreground text-center mb-2">Review Transfer</p>
          <Card className="glass-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">To</span>
                <span className="text-foreground font-medium">
                  {method === "wallet" ? recipientName : recipientPhone}
                </span>
              </div>
              {method === "wallet" && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Wallet</span>
                  <span className="text-foreground font-mono">{recipientWalletId}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-foreground">{currency} {Number(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fee (1%)</span>
                <span className="text-foreground">{currency} {fee.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-foreground font-semibold">Total</span>
                <span className="text-foreground font-bold">{currency} {total.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
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
            {loading ? "Processing..." : "Confirm & Send"}
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="text-center py-12 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center animate-pulse">
            <SendIcon className="w-8 h-8 text-primary" />
          </div>
          <p className="text-foreground font-semibold">Processing transfer...</p>
        </div>
      )}

      {step === "result" && txResult && (
        <div className="text-center py-8 animate-slide-up space-y-4">
          {txResult.success ? (
            <>
              <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
              <h2 className="text-xl font-bold text-foreground">
                {method === "wallet" ? "Transfer Successful!" : "Money Sent!"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {method === "wallet"
                  ? `${currency} ${Number(amount).toLocaleString()} sent to ${recipientName}`
                  : txResult.message || `${currency} ${Number(amount).toLocaleString()} sent to ${recipientPhone}`}
              </p>
              {txResult.transaction_id && (
                <p className="text-xs text-muted-foreground font-mono">{txResult.transaction_id}</p>
              )}
            </>
          ) : (
            <>
              <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Transfer Failed</h2>
              <p className="text-muted-foreground text-sm">{txResult.error}</p>
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
