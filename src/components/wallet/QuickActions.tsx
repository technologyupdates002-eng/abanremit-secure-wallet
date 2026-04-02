import { Send, Download, ArrowUpDown, Plus, DollarSign, FileText, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { icon: Send, label: "Send", color: "bg-primary/20 text-primary", onClick: () => navigate("/send") },
    { icon: Download, label: "Receive", color: "bg-info/20 text-info", onClick: () => navigate("/receive") },
    { icon: Plus, label: "Deposit", color: "bg-accent/20 text-accent-foreground", onClick: () => navigate("/deposit") },
    { icon: ArrowUpDown, label: "Withdraw", color: "bg-warning/20 text-warning", onClick: () => navigate("/withdraw") },
    { icon: DollarSign, label: "Rates", color: "bg-primary/20 text-primary", onClick: () => navigate("/exchange-rates") },
    { icon: FileText, label: "Statement", color: "bg-info/20 text-info", onClick: () => navigate("/statement") },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map(({ icon: Icon, label, color, onClick }) => (
        <button key={label} onClick={onClick} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card hover:bg-secondary transition-colors">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </button>
      ))}
    </div>
  );
}
