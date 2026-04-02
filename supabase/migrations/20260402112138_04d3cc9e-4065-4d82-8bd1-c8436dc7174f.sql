
-- Supported currencies table
CREATE TABLE public.supported_currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  country TEXT NOT NULL,
  flag_emoji TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exchange rates (admin-set, base currency KES)
CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL REFERENCES public.supported_currencies(code),
  to_currency TEXT NOT NULL REFERENCES public.supported_currencies(code),
  rate NUMERIC(18,8) NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_currency, to_currency)
);

-- Global settings (fees, etc.)
CREATE TABLE public.global_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin/system wallet for collecting fees
CREATE TABLE public.admin_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id TEXT UNIQUE NOT NULL DEFAULT 'ABN-ADMIN',
  balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'KES',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert the system admin wallet
INSERT INTO public.admin_wallet (wallet_id) VALUES ('ABN-ADMIN');

-- User roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Role check function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Add country and otp_channel to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'KE';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS otp_channel TEXT DEFAULT 'phone' CHECK (otp_channel IN ('phone', 'email'));

-- Insert 20 supported currencies
INSERT INTO public.supported_currencies (code, name, symbol, country, flag_emoji) VALUES
  ('KES', 'Kenyan Shilling', 'KSh', 'Kenya', '🇰🇪'),
  ('USD', 'US Dollar', '$', 'United States', '🇺🇸'),
  ('EUR', 'Euro', '€', 'European Union', '🇪🇺'),
  ('GBP', 'British Pound', '£', 'United Kingdom', '🇬🇧'),
  ('NGN', 'Nigerian Naira', '₦', 'Nigeria', '🇳🇬'),
  ('ZAR', 'South African Rand', 'R', 'South Africa', '🇿🇦'),
  ('GHS', 'Ghanaian Cedi', '₵', 'Ghana', '🇬🇭'),
  ('UGX', 'Ugandan Shilling', 'USh', 'Uganda', '🇺🇬'),
  ('TZS', 'Tanzanian Shilling', 'TSh', 'Tanzania', '🇹🇿'),
  ('RWF', 'Rwandan Franc', 'FRw', 'Rwanda', '🇷🇼'),
  ('ETB', 'Ethiopian Birr', 'Br', 'Ethiopia', '🇪🇹'),
  ('INR', 'Indian Rupee', '₹', 'India', '🇮🇳'),
  ('JPY', 'Japanese Yen', '¥', 'Japan', '🇯🇵'),
  ('CAD', 'Canadian Dollar', 'C$', 'Canada', '🇨🇦'),
  ('AUD', 'Australian Dollar', 'A$', 'Australia', '🇦🇺'),
  ('CHF', 'Swiss Franc', 'CHF', 'Switzerland', '🇨🇭'),
  ('CNY', 'Chinese Yuan', '¥', 'China', '🇨🇳'),
  ('AED', 'UAE Dirham', 'د.إ', 'UAE', '🇦🇪'),
  ('BRL', 'Brazilian Real', 'R$', 'Brazil', '🇧🇷'),
  ('EGP', 'Egyptian Pound', 'E£', 'Egypt', '🇪🇬');

-- Insert default global settings
INSERT INTO public.global_settings (key, value, description) VALUES
  ('transfer_fee_percent', '1.0', 'Fee percentage for wallet transfers'),
  ('withdrawal_fee_percent', '1.0', 'Fee percentage for withdrawals'),
  ('deposit_fee_percent', '0.0', 'Fee percentage for deposits'),
  ('statement_download_fee', '50', 'Fee in KES for statement download'),
  ('high_value_threshold', '50000', 'Amount threshold requiring OTP verification');

-- Insert default exchange rates (KES base)
INSERT INTO public.exchange_rates (from_currency, to_currency, rate) VALUES
  ('KES', 'USD', 0.0077), ('USD', 'KES', 129.50),
  ('KES', 'EUR', 0.0071), ('EUR', 'KES', 140.85),
  ('KES', 'GBP', 0.0061), ('GBP', 'KES', 163.90),
  ('KES', 'NGN', 11.72), ('NGN', 'KES', 0.085),
  ('KES', 'ZAR', 0.14), ('ZAR', 'KES', 7.14),
  ('KES', 'GHS', 0.117), ('GHS', 'KES', 8.55),
  ('KES', 'UGX', 28.88), ('UGX', 'KES', 0.035),
  ('KES', 'TZS', 19.69), ('TZS', 'KES', 0.051),
  ('KES', 'RWF', 10.12), ('RWF', 'KES', 0.099),
  ('KES', 'ETB', 0.885), ('ETB', 'KES', 1.13),
  ('KES', 'INR', 0.643), ('INR', 'KES', 1.555),
  ('KES', 'JPY', 1.166), ('JPY', 'KES', 0.858),
  ('KES', 'CAD', 0.0106), ('CAD', 'KES', 94.34),
  ('KES', 'AUD', 0.0118), ('AUD', 'KES', 84.75),
  ('KES', 'CHF', 0.0068), ('CHF', 'KES', 147.06),
  ('KES', 'CNY', 0.056), ('CNY', 'KES', 17.86),
  ('KES', 'AED', 0.0284), ('AED', 'KES', 35.21),
  ('KES', 'BRL', 0.039), ('BRL', 'KES', 25.64),
  ('KES', 'EGP', 0.379), ('EGP', 'KES', 2.64);

-- RLS policies
ALTER TABLE public.supported_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view currencies" ON public.supported_currencies FOR SELECT TO authenticated USING (true);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view exchange rates" ON public.exchange_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage exchange rates" ON public.exchange_rates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view settings" ON public.global_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.global_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.admin_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view admin wallet" ON public.admin_wallet FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update process_transfer to route fees to admin wallet
CREATE OR REPLACE FUNCTION public.process_transfer(
  p_sender_wallet TEXT, p_receiver_wallet TEXT, p_amount NUMERIC, p_fee NUMERIC DEFAULT 0, p_description TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_balance DECIMAL;
  v_sender_user_id UUID;
  v_receiver_user_id UUID;
  v_total DECIMAL;
  v_txn_id TEXT;
BEGIN
  v_total := p_amount + p_fee;
  
  SELECT balance, user_id INTO v_sender_balance, v_sender_user_id
  FROM public.wallets WHERE wallet_id = p_sender_wallet FOR UPDATE;
  
  IF v_sender_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Sender wallet not found'); END IF;
  IF auth.uid() != v_sender_user_id THEN RETURN json_build_object('success', false, 'error', 'Unauthorized'); END IF;
  
  SELECT user_id INTO v_receiver_user_id FROM public.wallets WHERE wallet_id = p_receiver_wallet;
  IF v_receiver_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Receiver wallet not found'); END IF;
  IF p_sender_wallet = p_receiver_wallet THEN RETURN json_build_object('success', false, 'error', 'Cannot send to yourself'); END IF;
  IF v_sender_balance < v_total THEN RETURN json_build_object('success', false, 'error', 'Insufficient balance'); END IF;
  
  UPDATE public.wallets SET balance = balance - v_total WHERE wallet_id = p_sender_wallet;
  UPDATE public.wallets SET balance = balance + p_amount WHERE wallet_id = p_receiver_wallet;
  
  -- Route fees to admin wallet
  IF p_fee > 0 THEN
    UPDATE public.admin_wallet SET balance = balance + p_fee WHERE wallet_id = 'ABN-ADMIN';
  END IF;
  
  v_txn_id := 'TXN-' || REPLACE(gen_random_uuid()::TEXT, '-', '');
  
  INSERT INTO public.transactions (transaction_id, sender_wallet, receiver_wallet, amount, fee, status, type, description)
  VALUES (v_txn_id, p_sender_wallet, p_receiver_wallet, p_amount, p_fee, 'success', 'wallet_transfer', p_description);
  
  INSERT INTO public.notifications (user_id, title, message, type) VALUES
    (v_sender_user_id, 'Money Sent', 'You sent ' || p_amount || ' KES to ' || p_receiver_wallet, 'debit'),
    (v_receiver_user_id, 'Money Received', 'You received ' || p_amount || ' KES from ' || p_sender_wallet, 'credit');
  
  RETURN json_build_object('success', true, 'transaction_id', v_txn_id);
END;
$$;

-- Function to get dynamic fee rate
CREATE OR REPLACE FUNCTION public.get_fee_rate(p_type TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rate TEXT;
BEGIN
  SELECT value INTO v_rate FROM public.global_settings WHERE key = p_type || '_fee_percent';
  RETURN COALESCE(v_rate::NUMERIC, 1.0) / 100.0;
END;
$$;

-- Function for statement download fee deduction
CREATE OR REPLACE FUNCTION public.charge_statement_fee(p_wallet_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee NUMERIC;
  v_balance NUMERIC;
  v_user_id UUID;
BEGIN
  SELECT value::NUMERIC INTO v_fee FROM public.global_settings WHERE key = 'statement_download_fee';
  IF v_fee IS NULL OR v_fee <= 0 THEN RETURN json_build_object('success', true, 'fee', 0); END IF;

  SELECT balance, user_id INTO v_balance, v_user_id FROM public.wallets WHERE wallet_id = p_wallet_id;
  IF v_user_id IS NULL OR auth.uid() != v_user_id THEN RETURN json_build_object('success', false, 'error', 'Unauthorized'); END IF;
  IF v_balance < v_fee THEN RETURN json_build_object('success', false, 'error', 'Insufficient balance for statement fee'); END IF;

  UPDATE public.wallets SET balance = balance - v_fee WHERE wallet_id = p_wallet_id;
  UPDATE public.admin_wallet SET balance = balance + v_fee WHERE wallet_id = 'ABN-ADMIN';

  INSERT INTO public.transactions (transaction_id, sender_wallet, receiver_wallet, amount, fee, status, type, description)
  VALUES ('TXN-' || REPLACE(gen_random_uuid()::TEXT, '-', ''), p_wallet_id, 'ABN-ADMIN', v_fee, 0, 'success', 'wallet_transfer', 'Statement download fee');

  RETURN json_build_object('success', true, 'fee', v_fee);
END;
$$;
