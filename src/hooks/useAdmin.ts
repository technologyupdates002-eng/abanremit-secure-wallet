import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });
}

export function useAdminWallet() {
  return useQuery({
    queryKey: ["admin_wallet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_wallet")
        .select("*")
        .eq("wallet_id", "ABN-ADMIN")
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useAllExchangeRates() {
  return useQuery({
    queryKey: ["exchange_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .order("from_currency");
      if (error) throw error;
      return data;
    },
  });
}

export function useGlobalSettings() {
  return useQuery({
    queryKey: ["global_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_settings")
        .select("*");
      if (error) throw error;
      return data as { key: string; value: string; description: string | null }[];
    },
  });
}

export function useSupportedCurrencies() {
  return useQuery({
    queryKey: ["supported_currencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supported_currencies")
        .select("*")
        .eq("is_active", true)
        .order("country");
      if (error) throw error;
      return data;
    },
  });
}

export function useAllUsers() {
  return useQuery({
    queryKey: ["admin_all_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, wallets(wallet_id, balance, currency)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAllTransactions() {
  return useQuery({
    queryKey: ["admin_all_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useAllMpesaTransactions() {
  return useQuery({
    queryKey: ["admin_mpesa_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mpesa_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}
