import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWallet, useTransactions } from "@/hooks/useWallet";
import { useGlobalSettings } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function Statement() {
  const navigate = useNavigate();
  const { data: wallet } = useWallet();
  const { data: transactions } = useTransactions();
  const { data: settings } = useGlobalSettings();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fee = settings?.find(s => s.key === "statement_download_fee");
  const feeAmount = fee ? Number(fee.value) : 50;

  const filteredTxns = transactions?.filter(tx => {
    if (!startDate && !endDate) return true;
    const d = new Date(tx.created_at);
    if (startDate && d < new Date(startDate)) return false;
    if (endDate && d > new Date(endDate + "T23:59:59")) return false;
    return true;
  });

  const handleDownload = async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      // Charge fee
      const { data, error } = await supabase.rpc("charge_statement_fee", { p_wallet_id: wallet.wallet_id });
      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        toast.error(result.error || "Failed to charge fee");
        setLoading(false);
        return;
      }

      // Generate CSV
      const rows = [["Date", "Transaction ID", "Type", "From", "To", "Amount", "Fee", "Status"]];
      filteredTxns?.forEach(tx => {
        rows.push([
          format(new Date(tx.created_at), "yyyy-MM-dd HH:mm"),
          tx.transaction_id,
          tx.type,
          tx.sender_wallet,
          tx.receiver_wallet,
          String(tx.amount),
          String(tx.fee),
          tx.status,
        ]);
      });

      const csv = rows.map(r => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `statement_${wallet.wallet_id}_${format(new Date(), "yyyyMMdd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Statement downloaded! Fee: KES ${feeAmount}`);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    } catch {
      toast.error("Failed to download statement");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Account Statement</h1>
      </div>

      <div className="space-y-4 animate-fade-in">
        <Card className="glass-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              <div>
                <p className="font-medium text-foreground">Download Statement</p>
                <p className="text-xs text-muted-foreground">CSV format with all transactions</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">From</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-secondary border-border/50 text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-secondary border-border/50 text-foreground" />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary">
              <AlertCircle className="w-4 h-4 text-warning" />
              <p className="text-xs text-muted-foreground">Download fee: <span className="text-foreground font-medium">KES {feeAmount}</span></p>
            </div>

            <p className="text-xs text-muted-foreground">{filteredTxns?.length || 0} transactions found</p>

            <Button onClick={handleDownload} disabled={loading || !filteredTxns?.length} className="w-full gradient-primary text-primary-foreground h-12">
              <Download className="w-4 h-4 mr-2" />
              {loading ? "Processing..." : `Download (KES ${feeAmount} fee)`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
