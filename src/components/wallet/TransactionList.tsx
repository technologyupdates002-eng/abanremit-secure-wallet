import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { format } from "date-fns";

interface Transaction {
  id: string;
  transaction_id: string;
  sender_wallet: string;
  receiver_wallet: string;
  amount: number;
  fee: number;
  status: string;
  type: string;
  description: string | null;
  created_at: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  currentWalletId: string;
}

export function TransactionList({ transactions, currentWalletId }: TransactionListProps) {
  if (!transactions.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => {
        const isSender = tx.sender_wallet === currentWalletId;
        return (
          <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl bg-card hover:bg-secondary/50 transition-colors">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSender ? "bg-destructive/20" : "bg-primary/20"}`}>
              {isSender ? (
                <ArrowUpRight className="w-5 h-5 text-destructive" />
              ) : (
                <ArrowDownLeft className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {isSender ? `To ${tx.receiver_wallet}` : `From ${tx.sender_wallet}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(tx.created_at), "MMM d, h:mm a")}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${isSender ? "text-destructive" : "text-primary"}`}>
                {isSender ? "-" : "+"}KES {tx.amount.toLocaleString()}
              </p>
              <p className={`text-xs capitalize ${tx.status === "success" ? "text-primary" : tx.status === "failed" ? "text-destructive" : "text-warning"}`}>
                {tx.status}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
