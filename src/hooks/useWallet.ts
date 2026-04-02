import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useWallet() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useTransactions() {
  const { data: wallet } = useWallet();

  return useQuery({
    queryKey: ["transactions", wallet?.wallet_id],
    queryFn: async () => {
      if (!wallet) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_wallet.eq.${wallet.wallet_id},receiver_wallet.eq.${wallet.wallet_id}`)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!wallet,
  });
}

export function useNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useHasPin() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["has_pin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("transaction_pins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });
}

export async function lookupWallet(walletId: string) {
  const { data, error } = await supabase.rpc("lookup_wallet", { p_wallet_id: walletId });
  if (error) throw error;
  return data as { found: boolean; full_name?: string; wallet_id?: string };
}

export async function setTransactionPin(pin: string) {
  const { data, error } = await supabase.rpc("set_transaction_pin", { p_pin: pin });
  if (error) throw error;
  return data as { success: boolean; error?: string };
}

export async function verifyPin(pin: string) {
  const { data, error } = await supabase.rpc("verify_transaction_pin", { p_pin: pin });
  if (error) throw error;
  return data as { valid: boolean; error?: string; attempts_left?: number };
}

export async function processTransfer(
  senderWallet: string,
  receiverWallet: string,
  amount: number,
  fee: number = 0,
  description?: string
) {
  const { data, error } = await supabase.rpc("process_transfer", {
    p_sender_wallet: senderWallet,
    p_receiver_wallet: receiverWallet,
    p_amount: amount,
    p_fee: fee,
    p_description: description,
  });
  if (error) throw error;
  return data as { success: boolean; error?: string; transaction_id?: string };
}
