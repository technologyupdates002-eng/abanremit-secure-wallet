import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Search, User, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { useWallet, lookupWallet, verifyPin, processTransfer } from "@/hooks/useWallet";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Step = "enter_wallet" | "confirm_recipient" | "enter_amount" | "review" | "pin" | "processing" | "result";

const TRANSACTION_FEE_RATE = 0.01; // 1%

export default function Send() {
  const navigate = useNavigate();
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("enter_wallet");
  const [recipientWalletId, setRecipientWalletId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; transaction_id?: string; error?: string } | null>(null);

  const fee = Number(amount) * TRANSACTION_FEE_RATE;
  const total = Number(amount) + fee;

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
      const result = await processTransfer(
        wallet!.wallet_id,
        recipientWalletId,
        Number(amount),
        fee,
        description || undefined
      );
      setTxResult(result);
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

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => step === "enter_wallet" ? navigate("/") : setStep("enter_wallet")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Send Money</h1>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1 mb-6">
        {["enter_wallet", "confirm_recipient", "enter_amount", "review", "pin"].map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${
            ["enter_wallet", "confirm_recipient", "enter_amount", "review", "pin", "processing", "result"].indexOf(step) >= i
              ? "bg-primary" : "bg-secondary"
          }`} />
        ))}
      </div>

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

      {step === "confirm_recipient" && (
        <div className="space-y-4 animate-fade-in">
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
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
            <Button variant="outline" onClick={() => { setStep("enter_wallet"); setRecipientWalletId(""); }} className="border-border text-foreground">
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
            <span className="text-muted-foreground text-2xl">KES</span>
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
              Balance: KES {Number(wallet.balance).toLocaleString("en", { minimumFractionDigits: 2 })}
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
                <span className="text-foreground font-medium">{recipientName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Wallet</span>
                <span className="text-foreground font-mono">{recipientWalletId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-foreground">KES {Number(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fee (1%)</span>
                <span className="text-foreground">KES {fee.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-foreground font-semibold">Total</span>
                <span className="text-foreground font-bold">KES {total.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
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
          <div className="w-16 h-16 rounded-full bg-primary/20 mx-auto mb-4 flex items-center justify-center animate-pulse">
            <Send className="w-8 h-8 text-primary" />
          </div>
          <p className="text-foreground font-semibold">Processing transfer...</p>
        </div>
      )}

      {step === "result" && txResult && (
        <div className="text-center py-8 animate-slide-up space-y-4">
          {txResult.success ? (
            <>
              <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Transfer Successful!</h2>
              <p className="text-muted-foreground text-sm">KES {Number(amount).toLocaleString()} sent to {recipientName}</p>
              <p className="text-xs text-muted-foreground font-mono">{txResult.transaction_id}</p>
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

// Need to import Send icon
import { Send as SendIcon } from "lucide-react";
