import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useWallet";

interface OtpModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  phone: string;
  purpose?: string;
}

export function OtpModal({ open, onClose, onVerified, phone, purpose = "verification" }: OtpModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { data: profile } = useProfile();

  const otpChannel = (profile as any)?.otp_channel || "phone";

  useEffect(() => {
    if (open && countdown === 0) {
      handleSendOtp();
    }
  }, [open]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendOtp = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone, purpose, channel: otpChannel },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        const target = data?.channel === "email" ? "email" : "phone";
        toast.success(`OTP sent to your ${target}`);
        setCountdown(60);
      }
    } catch {
      toast.error("Failed to send OTP");
    }
    setSending(false);
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { phone, code, purpose },
      });
      if (error) throw error;
      if (data?.valid) {
        toast.success("Verified!");
        onVerified();
      } else {
        toast.error(data?.error || "Invalid OTP");
      }
    } catch {
      toast.error("Verification failed");
    }
    setLoading(false);
  };

  const targetLabel = otpChannel === "email" ? "your email" : phone;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <DialogTitle className="text-foreground">OTP Verification</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <span className="font-medium text-foreground">{targetLabel}</span>
          </p>
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="bg-secondary border-border/50 text-foreground text-center text-2xl tracking-[0.5em]"
            autoFocus
          />
          <Button onClick={handleVerify} disabled={loading || code.length !== 6} className="w-full gradient-primary text-primary-foreground">
            {loading ? "Verifying..." : "Verify"}
          </Button>
          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-xs text-muted-foreground">Resend in {countdown}s</p>
            ) : (
              <button
                onClick={handleSendOtp}
                disabled={sending}
                className="text-xs text-primary hover:underline"
              >
                {sending ? "Sending..." : "Resend OTP"}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
