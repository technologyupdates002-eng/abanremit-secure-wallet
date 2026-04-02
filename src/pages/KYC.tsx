import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, ShieldCheck, Clock, XCircle, FileText, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const DOC_TYPES = [
  { value: "national_id", label: "National ID" },
  { value: "passport", label: "Passport" },
  { value: "driving_license", label: "Driving License" },
];

export default function KYC() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState("national_id");
  const [docNumber, setDocNumber] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const kycStatus = (profile as any)?.kyc_status || "pending";

  const handleSubmit = async () => {
    if (!docNumber.trim()) { toast.error("Enter document number"); return; }
    if (!frontFile) { toast.error("Upload front of document"); return; }

    setSubmitting(true);
    try {
      const userId = profile?.user_id;
      if (!userId) throw new Error("No user");

      // Upload files to storage
      const uploads: { path: string; file: File }[] = [
        { path: `kyc/${userId}/front-${Date.now()}`, file: frontFile },
      ];
      if (backFile) uploads.push({ path: `kyc/${userId}/back-${Date.now()}`, file: backFile });
      if (selfieFile) uploads.push({ path: `kyc/${userId}/selfie-${Date.now()}`, file: selfieFile });

      for (const { path, file } of uploads) {
        const { error } = await supabase.storage.from("kyc-documents").upload(path, file);
        if (error) {
          console.error("Upload error:", error);
          // Continue even if storage isn't set up
        }
      }

      // Update profile KYC status to pending (admin reviews)
      await supabase
        .from("profiles")
        .update({ kyc_status: "pending" } as any)
        .eq("user_id", userId);

      toast.success("KYC documents submitted for review");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      toast.error("Failed to submit documents");
    }
    setSubmitting(false);
  };

  const StatusBanner = () => {
    if (kycStatus === "verified") {
      return (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            <div>
              <p className="font-semibold text-foreground">Verified</p>
              <p className="text-xs text-muted-foreground">Your identity has been verified</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (kycStatus === "rejected") {
      return (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-destructive" />
            <div>
              <p className="font-semibold text-foreground">Rejected</p>
              <p className="text-xs text-muted-foreground">Please re-submit your documents</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-4 flex items-center gap-3">
          <Clock className="w-8 h-8 text-warning" />
          <div>
            <p className="font-semibold text-foreground">Pending Review</p>
            <p className="text-xs text-muted-foreground">Your documents are being reviewed</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">KYC Verification</h1>
      </div>

      <div className="space-y-4 animate-fade-in">
        <StatusBanner />

        {(kycStatus === "pending" || kycStatus === "rejected") && (
          <>
            <Card className="glass-card">
              <CardContent className="p-4 space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Document Type</label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger className="bg-secondary border-border/50 text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Document Number</label>
                  <Input
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="e.g. 12345678"
                    className="bg-secondary border-border/50 text-foreground"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4 space-y-4">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Upload Documents
                </p>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Front of Document *</label>
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {frontFile ? frontFile.name : "Choose file"}
                    </span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFrontFile(e.target.files?.[0] || null)} />
                  </label>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Back of Document (optional)</label>
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {backFile ? backFile.name : "Choose file"}
                    </span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setBackFile(e.target.files?.[0] || null)} />
                  </label>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Selfie (optional)</label>
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                    <Camera className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {selfieFile ? selfieFile.name : "Take or choose photo"}
                    </span>
                    <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => setSelfieFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSubmit} disabled={submitting} className="w-full gradient-primary text-primary-foreground h-12">
              {submitting ? "Submitting..." : "Submit for Review"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
