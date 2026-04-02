import { ArrowLeft, Copy, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWallet, useProfile } from "@/hooks/useWallet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Receive() {
  const navigate = useNavigate();
  const { data: wallet } = useWallet();
  const { data: profile } = useProfile();

  const copyId = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet.wallet_id);
      toast.success("Wallet ID copied!");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Receive Money</h1>
      </div>

      <div className="text-center space-y-6 animate-fade-in">
        <p className="text-muted-foreground text-sm">Share your wallet ID to receive money</p>

        <Card className="glass-card">
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Your Wallet ID</p>
            <p className="text-3xl font-bold font-mono text-primary">{wallet?.wallet_id || "..."}</p>
            <p className="text-sm text-muted-foreground">{profile?.full_name}</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button onClick={copyId} variant="outline" className="border-border text-foreground h-12">
            <Copy className="w-4 h-4 mr-2" /> Copy ID
          </Button>
          <Button onClick={() => {
            if (wallet && navigator.share) {
              navigator.share({ text: `Send money to my AbanRemit wallet: ${wallet.wallet_id}` });
            } else {
              copyId();
            }
          }} className="gradient-primary text-primary-foreground h-12">
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
        </div>
      </div>
    </div>
  );
}
