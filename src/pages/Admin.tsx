import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Settings, Users, ArrowUpDown, DollarSign, Wallet, Smartphone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin, useAdminWallet, useGlobalSettings, useAllExchangeRates, useAllUsers, useAllTransactions, useAllMpesaTransactions, useSupportedCurrencies } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

function AdminSettings() {
  const { data: settings, isLoading } = useGlobalSettings();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});

  const handleSave = async (key: string) => {
    const { error } = await supabase.from("global_settings").update({ value: editing[key], updated_at: new Date().toISOString() }).eq("key", key);
    if (error) { toast.error("Failed to update"); return; }
    toast.success("Setting updated");
    setEditing(prev => { const n = { ...prev }; delete n[key]; return n; });
    queryClient.invalidateQueries({ queryKey: ["global_settings"] });
  };

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading...</p>;

  return (
    <div className="space-y-3">
      {settings?.map(s => (
        <Card key={s.key} className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{s.description || s.key}</p>
                <p className="text-xs text-muted-foreground font-mono">{s.key}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={editing[s.key] ?? s.value}
                  onChange={e => setEditing(prev => ({ ...prev, [s.key]: e.target.value }))}
                  className="w-28 bg-secondary border-border/50 text-foreground text-right"
                />
                {editing[s.key] !== undefined && editing[s.key] !== s.value && (
                  <Button size="sm" onClick={() => handleSave(s.key)} className="gradient-primary text-primary-foreground">Save</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AdminExchangeRates() {
  const { data: rates, isLoading } = useAllExchangeRates();
  const { data: currencies } = useSupportedCurrencies();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});

  const handleSave = async (id: string) => {
    const { error } = await supabase.from("exchange_rates").update({ rate: Number(editing[id]), updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Failed to update rate"); return; }
    toast.success("Rate updated");
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
    queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
  };

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading...</p>;

  return (
    <div className="space-y-2">
      {rates?.map(r => {
        const fromC = currencies?.find(c => c.code === r.from_currency);
        const toC = currencies?.find(c => c.code === r.to_currency);
        return (
          <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-card gap-2">
            <span className="text-sm text-foreground">
              {fromC?.flag_emoji} {r.from_currency} → {toC?.flag_emoji} {r.to_currency}
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.0001"
                value={editing[r.id] ?? String(r.rate)}
                onChange={e => setEditing(prev => ({ ...prev, [r.id]: e.target.value }))}
                className="w-32 bg-secondary border-border/50 text-foreground text-right text-sm"
              />
              {editing[r.id] !== undefined && editing[r.id] !== String(r.rate) && (
                <Button size="sm" onClick={() => handleSave(r.id)} className="gradient-primary text-primary-foreground">Save</Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminUsers() {
  const { data: users, isLoading } = useAllUsers();
  if (isLoading) return <p className="text-muted-foreground text-sm">Loading...</p>;

  return (
    <div className="space-y-2">
      {users?.map((u: any) => (
        <Card key={u.id} className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{u.full_name || "Unnamed"}</p>
                <p className="text-xs text-muted-foreground">{u.phone || "No phone"} • {u.country || "KE"}</p>
                <p className="text-xs text-muted-foreground">KYC: <span className={`font-medium ${u.kyc_status === "verified" ? "text-primary" : u.kyc_status === "rejected" ? "text-destructive" : "text-warning"}`}>{u.kyc_status}</span></p>
              </div>
              <div className="text-right">
                {u.wallets?.[0] && (
                  <>
                    <p className="text-sm font-mono text-foreground">{u.wallets[0].wallet_id}</p>
                    <p className="text-xs text-muted-foreground">{u.wallets[0].currency} {Number(u.wallets[0].balance).toLocaleString("en", { minimumFractionDigits: 2 })}</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AdminTransactions() {
  const { data: transactions, isLoading } = useAllTransactions();
  if (isLoading) return <p className="text-muted-foreground text-sm">Loading...</p>;

  return (
    <div className="space-y-2">
      {!transactions?.length ? (
        <p className="text-center text-muted-foreground text-sm py-8">No transactions</p>
      ) : transactions.map((tx: any) => (
        <div key={tx.id} className="p-3 rounded-xl bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-muted-foreground">{tx.transaction_id}</p>
              <p className="text-sm text-foreground">{tx.sender_wallet} → {tx.receiver_wallet}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">KES {Number(tx.amount).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Fee: {Number(tx.fee).toLocaleString()}</p>
              <p className={`text-xs capitalize ${tx.status === "success" ? "text-primary" : tx.status === "failed" ? "text-destructive" : "text-warning"}`}>{tx.status}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{format(new Date(tx.created_at), "MMM d, h:mm a")}</p>
        </div>
      ))}
    </div>
  );
}

function AdminMpesa() {
  const { data: txns, isLoading } = useAllMpesaTransactions();
  if (isLoading) return <p className="text-muted-foreground text-sm">Loading...</p>;

  return (
    <div className="space-y-2">
      {!txns?.length ? (
        <p className="text-center text-muted-foreground text-sm py-8">No M-Pesa transactions</p>
      ) : txns.map((tx: any) => (
        <div key={tx.id} className="p-3 rounded-xl bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">{tx.phone}</p>
              <p className="text-xs text-muted-foreground">{tx.type} • {tx.reference || "N/A"}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">KES {Number(tx.amount).toLocaleString()}</p>
              <p className={`text-xs capitalize ${tx.status === "completed" ? "text-primary" : tx.status === "failed" ? "text-destructive" : "text-warning"}`}>{tx.status}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{format(new Date(tx.created_at), "MMM d, h:mm a")}</p>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin();
  const { data: adminWallet } = useAdminWallet();

  if (roleLoading) return <div className="min-h-screen bg-background" />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="glass-card max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <p className="text-foreground font-semibold">Access Denied</p>
            <p className="text-sm text-muted-foreground mt-2">You need admin privileges.</p>
            <Button onClick={() => navigate("/")} className="mt-4 gradient-primary text-primary-foreground">Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-6 h-6" /></button>
        <h1 className="text-xl font-semibold text-foreground">Admin Dashboard</h1>
      </div>

      {/* Admin Wallet Balance */}
      <Card className="glass-card mb-6">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fee Collection Wallet</p>
              <p className="text-sm font-mono text-foreground">ABN-ADMIN</p>
            </div>
          </div>
          <p className="text-lg font-bold text-primary">KES {adminWallet ? Number(adminWallet.balance).toLocaleString("en", { minimumFractionDigits: 2 }) : "0.00"}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="w-full grid grid-cols-5 bg-secondary mb-4">
          <TabsTrigger value="settings" className="text-xs"><Settings className="w-3 h-3 mr-1" />Fees</TabsTrigger>
          <TabsTrigger value="rates" className="text-xs"><DollarSign className="w-3 h-3 mr-1" />Rates</TabsTrigger>
          <TabsTrigger value="users" className="text-xs"><Users className="w-3 h-3 mr-1" />Users</TabsTrigger>
          <TabsTrigger value="transactions" className="text-xs"><ArrowUpDown className="w-3 h-3 mr-1" />Txns</TabsTrigger>
          <TabsTrigger value="mpesa" className="text-xs"><Smartphone className="w-3 h-3 mr-1" />M-Pesa</TabsTrigger>
        </TabsList>
        <TabsContent value="settings"><AdminSettings /></TabsContent>
        <TabsContent value="rates"><AdminExchangeRates /></TabsContent>
        <TabsContent value="users"><AdminUsers /></TabsContent>
        <TabsContent value="transactions"><AdminTransactions /></TabsContent>
        <TabsContent value="mpesa"><AdminMpesa /></TabsContent>
      </Tabs>
    </div>
  );
}
