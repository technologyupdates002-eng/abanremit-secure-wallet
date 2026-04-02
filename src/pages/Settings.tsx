import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Globe, Shield, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile } from "@/hooks/useWallet";
import { useSupportedCurrencies } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const COUNTRY_CURRENCY: Record<string, string> = {
  KE: "KES", US: "United States", EU: "European Union", GB: "United Kingdom",
  NG: "NGN", ZA: "ZAR", GH: "GHS", UG: "UGX", TZ: "TZS", RW: "RWF",
  ET: "ETB", IN: "INR", JP: "JPY", CA: "CAD", AU: "AUD", CH: "CHF",
  CN: "CNY", AE: "AED", BR: "BRL", EG: "EGP",
};

export default function Settings() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: currencies } = useSupportedCurrencies();
  const queryClient = useQueryClient();
  const [otpChannel, setOtpChannel] = useState("phone");
  const [country, setCountry] = useState("KE");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setOtpChannel((profile as any).otp_channel || "phone");
      setCountry((profile as any).country || "KE");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ otp_channel: otpChannel, country } as any)
      .eq("id", profile.id);
    if (error) toast.error("Failed to save");
    else {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
      </div>

      <div className="space-y-4 animate-fade-in">
        {/* Country */}
        <Card className="glass-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Country</p>
            </div>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="bg-secondary border-border/50 text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies?.map(c => (
                  <SelectItem key={c.code} value={c.country === "Kenya" ? "KE" : c.country === "United States" ? "US" : c.country === "European Union" ? "EU" : c.country === "United Kingdom" ? "GB" : c.country === "Nigeria" ? "NG" : c.country === "South Africa" ? "ZA" : c.country === "Ghana" ? "GH" : c.country === "Uganda" ? "UG" : c.country === "Tanzania" ? "TZ" : c.country === "Rwanda" ? "RW" : c.country === "Ethiopia" ? "ET" : c.country === "India" ? "IN" : c.country === "Japan" ? "JP" : c.country === "Canada" ? "CA" : c.country === "Australia" ? "AU" : c.country === "Switzerland" ? "CH" : c.country === "China" ? "CN" : c.country === "UAE" ? "AE" : c.country === "Brazil" ? "BR" : c.country === "Egypt" ? "EG" : c.code}>
                    {c.flag_emoji} {c.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* OTP Channel */}
        <Card className="glass-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">OTP Delivery Method</p>
            </div>
            <RadioGroup value={otpChannel} onValueChange={setOtpChannel}>
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary">
                <RadioGroupItem value="phone" id="otp-phone" />
                <Label htmlFor="otp-phone" className="flex items-center gap-2 text-foreground cursor-pointer">
                  <Phone className="w-4 h-4" /> SMS to phone
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary">
                <RadioGroupItem value="email" id="otp-email" />
                <Label htmlFor="otp-email" className="flex items-center gap-2 text-foreground cursor-pointer">
                  <Mail className="w-4 h-4" /> Email
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full gradient-primary text-primary-foreground h-12">
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
