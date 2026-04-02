import { ArrowLeft, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useWallet";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export default function Notifications() {
  const navigate = useNavigate();
  const { data: notifications } = useNotifications();
  const queryClient = useQueryClient();

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
      </div>

      <div className="space-y-2 animate-fade-in">
        {!notifications?.length ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground text-sm">No new notifications</p>
          </div>
        ) : (
          notifications.map((n) => (
            <button key={n.id} onClick={() => markRead(n.id)} className="w-full text-left p-4 rounded-xl bg-card hover:bg-secondary/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${n.type === "credit" ? "bg-primary" : n.type === "debit" ? "bg-destructive" : "bg-info"}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_at), "MMM d, h:mm a")}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
