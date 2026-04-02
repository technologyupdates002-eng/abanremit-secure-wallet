import { Eye, EyeOff, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface BalanceCardProps {
  walletId: string;
  balance: number;
  currency: string;
  fullName: string;
}

export function BalanceCard({ walletId, balance, currency, fullName }: BalanceCardProps) {
  const [visible, setVisible] = useState(true);

  const copyWalletId = () => {
    navigator.clipboard.writeText(walletId);
    toast.success("Wallet ID copied!");
  };

  return (
    <div className="gradient-primary rounded-2xl p-6 text-primary-foreground animate-fade-in">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm opacity-80">Total Balance</p>
        <button onClick={() => setVisible(!visible)} className="opacity-80 hover:opacity-100">
          {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>
      <h2 className="text-3xl font-bold mb-4">
        {visible ? `${currency} ${balance.toLocaleString("en", { minimumFractionDigits: 2 })}` : "••••••"}
      </h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs opacity-70">{fullName}</p>
          <button onClick={copyWalletId} className="flex items-center gap-1 text-sm font-mono opacity-90 hover:opacity-100">
            {walletId} <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
