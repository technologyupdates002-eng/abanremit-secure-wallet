import { ArrowLeft, Building, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

export default function Withdraw() {
  const navigate = useNavigate();

  const methods = [
    { icon: Smartphone, label: "Mobile Money", desc: "M-Pesa, Airtel Money", available: false },
    { icon: Building, label: "Bank Transfer", desc: "Send to bank account", available: false },
  ];

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Withdraw</h1>
      </div>

      <div className="space-y-3 animate-fade-in">
        <p className="text-muted-foreground text-sm">Choose withdrawal method</p>
        {methods.map(({ icon: Icon, label, desc }) => (
          <Card key={label} className="glass-card opacity-60 cursor-not-allowed">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <Icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">Coming soon</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
