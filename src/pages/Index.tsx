import { useAuth } from "@/lib/auth";
import { useWallet, useProfile, useTransactions, useNotifications, useHasPin } from "@/hooks/useWallet";
import { useIsAdmin } from "@/hooks/useAdmin";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { TransactionList } from "@/components/wallet/TransactionList";
import { SetPinModal } from "@/components/wallet/SetPinModal";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Bell, LogOut, Shield, Wallet, Settings, ShieldCheck, Menu } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { NavLink } from "@/components/NavLink";

function Sidebar() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();

  const links = [
    { label: "Dashboard", path: "/", icon: Wallet },
    { label: "Send", path: "/send", icon: Wallet },
    { label: "Deposit", path: "/deposit", icon: Wallet },
    { label: "Withdraw", path: "/withdraw", icon: Wallet },
    { label: "Exchange Rates", path: "/exchange-rates", icon: Wallet },
    { label: "Statement", path: "/statement", icon: Wallet },
    { label: "KYC", path: "/kyc", icon: ShieldCheck },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 min-h-screen bg-card border-r border-border p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-8 px-2">
        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
          <Wallet className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-foreground">AbanRemit</span>
      </div>
      <nav className="flex-1 space-y-1">
        {links.map(({ label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            {label}
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={() => navigate("/admin")}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-primary font-medium hover:bg-primary/10 transition-colors"
          >
            Admin Dashboard
          </button>
        )}
      </nav>
      <button onClick={signOut} className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive transition-colors">
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </aside>
  );
}

export default function Index() {
  const { user, signOut } = useAuth();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: profile } = useProfile();
  const { data: transactions, isLoading: txLoading } = useTransactions();
  const { data: notifications } = useNotifications();
  const { data: hasPin } = useHasPin();
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinDismissed, setPinDismissed] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (hasPin === false && user && !pinDismissed && !showPinModal) {
      const timer = setTimeout(() => setShowPinModal(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [hasPin, user, pinDismissed, showPinModal]);

  if (!user) {
    navigate("/auth");
    return null;
  }

  const unreadCount = notifications?.length || 0;

  const mainContent = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Welcome back</p>
            <p className="text-sm font-semibold text-foreground">{profile?.full_name || "User"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate("/notifications")} className="relative p-2 rounded-full hover:bg-secondary">
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-destructive rounded-full text-[10px] text-destructive-foreground flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          {isMobile && (
            <>
              <button onClick={() => navigate("/settings")} className="p-2 rounded-full hover:bg-secondary">
                <Settings className="w-5 h-5 text-muted-foreground" />
              </button>
              <button onClick={() => setShowPinModal(true)} className="p-2 rounded-full hover:bg-secondary">
                <Shield className="w-5 h-5 text-muted-foreground" />
              </button>
              {isAdmin && (
                <button onClick={() => navigate("/admin")} className="p-2 rounded-full hover:bg-secondary">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </button>
              )}
              <button onClick={signOut} className="p-2 rounded-full hover:bg-secondary">
                <LogOut className="w-5 h-5 text-muted-foreground" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Balance Card */}
      {walletLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : wallet ? (
        <BalanceCard
          walletId={wallet.wallet_id}
          balance={Number(wallet.balance)}
          currency={wallet.currency}
          fullName={profile?.full_name || ""}
        />
      ) : null}

      {/* Quick Actions */}
      <QuickActions />

      {/* Transactions */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Recent Transactions</h3>
        {txLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : (
          <TransactionList transactions={transactions || []} currentWalletId={wallet?.wallet_id || ""} />
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto p-4">
          {mainContent}
        </div>
        <SetPinModal open={showPinModal} onClose={() => { setShowPinModal(false); setPinDismissed(true); }} />
      </div>
    );
  }

  // Desktop layout with sidebar
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 p-8 max-w-3xl">
        {mainContent}
      </main>
      <SetPinModal open={showPinModal} onClose={() => { setShowPinModal(false); setPinDismissed(true); }} />
    </div>
  );
}
