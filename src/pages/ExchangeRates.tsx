import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSupportedCurrencies, useAllExchangeRates } from "@/hooks/useAdmin";
import { useWallet } from "@/hooks/useWallet";

export default function ExchangeRates() {
  const navigate = useNavigate();
  const { data: currencies } = useSupportedCurrencies();
  const { data: rates } = useAllExchangeRates();
  const { data: wallet } = useWallet();

  const [fromCurrency, setFromCurrency] = useState(wallet?.currency || "KES");
  const [toCurrency, setToCurrency] = useState("USD");
  const [amount, setAmount] = useState("1000");

  const rate = rates?.find(r => r.from_currency === fromCurrency && r.to_currency === toCurrency);
  const converted = rate ? Number(amount) * Number(rate.rate) : 0;
  const toCurrencyData = currencies?.find(c => c.code === toCurrency);
  const fromCurrencyData = currencies?.find(c => c.code === fromCurrency);

  const swap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Exchange Rates</h1>
      </div>

      <div className="space-y-4 animate-fade-in">
        {/* Converter */}
        <Card className="glass-card">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">From</label>
              <div className="flex gap-2">
                <Select value={fromCurrency} onValueChange={setFromCurrency}>
                  <SelectTrigger className="w-32 bg-secondary border-border/50 text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies?.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.flag_emoji} {c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="flex-1 bg-secondary border-border/50 text-foreground text-right text-lg"
                />
              </div>
            </div>

            <div className="flex justify-center">
              <button onClick={swap} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors">
                <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">To</label>
              <div className="flex gap-2">
                <Select value={toCurrency} onValueChange={setToCurrency}>
                  <SelectTrigger className="w-32 bg-secondary border-border/50 text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies?.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.flag_emoji} {c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1 bg-secondary rounded-md px-3 flex items-center justify-end">
                  <p className="text-lg font-semibold text-foreground">
                    {rate ? converted.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {rate && (
              <p className="text-xs text-muted-foreground text-center">
                1 {fromCurrencyData?.symbol || fromCurrency} = {Number(rate.rate).toLocaleString("en", { minimumFractionDigits: 4 })} {toCurrencyData?.symbol || toCurrency}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Rate Table */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">All Rates (from {fromCurrency})</h3>
          <div className="space-y-1">
            {rates?.filter(r => r.from_currency === fromCurrency).map(r => {
              const to = currencies?.find(c => c.code === r.to_currency);
              return (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-card">
                  <span className="text-sm text-foreground">{to?.flag_emoji} {to?.name || r.to_currency}</span>
                  <span className="text-sm font-mono text-muted-foreground">{Number(r.rate).toLocaleString("en", { minimumFractionDigits: 4 })}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
