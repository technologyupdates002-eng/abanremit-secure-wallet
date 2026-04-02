import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setTransactionPin } from "@/hooks/useWallet";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";

interface SetPinModalProps {
  open: boolean;
  onClose: () => void;
}

export function SetPinModal({ open, onClose }: SetPinModalProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (pin.length < 4 || pin.length > 6) {
      toast.error("PIN must be 4-6 digits");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }
    if (!/^\d+$/.test(pin)) {
      toast.error("PIN must contain only numbers");
      return;
    }

    setLoading(true);
    const result = await setTransactionPin(pin);
    if (result.success) {
      toast.success("Transaction PIN set successfully!");
      queryClient.invalidateQueries({ queryKey: ["has_pin"] });
      onClose();
    } else {
      toast.error(result.error || "Failed to set PIN");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <DialogTitle className="text-foreground">Set Transaction PIN</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Create a 4-6 digit PIN to authorize transactions.</p>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="bg-secondary border-border/50 text-foreground text-center text-2xl tracking-[0.5em]"
          />
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="Confirm PIN"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            className="bg-secondary border-border/50 text-foreground text-center text-2xl tracking-[0.5em]"
          />
          <Button onClick={handleSubmit} disabled={loading} className="w-full gradient-primary text-primary-foreground">
            {loading ? "Setting..." : "Set PIN"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
