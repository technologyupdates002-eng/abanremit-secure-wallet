
-- Create enum types
CREATE TYPE public.kyc_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE public.transaction_status AS ENUM ('success', 'pending', 'failed');
CREATE TYPE public.transaction_type AS ENUM ('wallet_transfer', 'mobile_money', 'bank_transfer', 'deposit', 'withdrawal');

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  kyc_status public.kyc_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generate wallet ID function
CREATE OR REPLACE FUNCTION public.generate_wallet_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    new_id := 'ABN-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
    SELECT EXISTS(SELECT 1 FROM public.wallets WHERE wallet_id = new_id) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Wallets table
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id TEXT NOT NULL UNIQUE DEFAULT public.generate_wallet_id(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  currency TEXT NOT NULL DEFAULT 'KES',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL UNIQUE DEFAULT 'TXN-' || REPLACE(gen_random_uuid()::TEXT, '-', ''),
  sender_wallet TEXT NOT NULL,
  receiver_wallet TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  fee DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  status public.transaction_status NOT NULL DEFAULT 'pending',
  type public.transaction_type NOT NULL DEFAULT 'wallet_transfer',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (
    sender_wallet IN (SELECT wallet_id FROM public.wallets WHERE user_id = auth.uid())
    OR receiver_wallet IN (SELECT wallet_id FROM public.wallets WHERE user_id = auth.uid())
  );

-- Transaction PINs
CREATE TABLE public.transaction_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  hashed_pin TEXT NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pin" ON public.transaction_pins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pin" ON public.transaction_pins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pin" ON public.transaction_pins FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_pins_updated_at BEFORE UPDATE ON public.transaction_pins
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile and wallet on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Secure transfer function
CREATE OR REPLACE FUNCTION public.process_transfer(
  p_sender_wallet TEXT,
  p_receiver_wallet TEXT,
  p_amount DECIMAL,
  p_fee DECIMAL DEFAULT 0,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_sender_balance DECIMAL;
  v_sender_user_id UUID;
  v_receiver_user_id UUID;
  v_total DECIMAL;
  v_txn_id TEXT;
BEGIN
  v_total := p_amount + p_fee;
  
  -- Validate sender
  SELECT balance, user_id INTO v_sender_balance, v_sender_user_id
  FROM public.wallets WHERE wallet_id = p_sender_wallet FOR UPDATE;
  
  IF v_sender_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sender wallet not found');
  END IF;
  
  IF auth.uid() != v_sender_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Validate receiver
  SELECT user_id INTO v_receiver_user_id
  FROM public.wallets WHERE wallet_id = p_receiver_wallet;
  
  IF v_receiver_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Receiver wallet not found');
  END IF;
  
  IF p_sender_wallet = p_receiver_wallet THEN
    RETURN json_build_object('success', false, 'error', 'Cannot send to yourself');
  END IF;
  
  -- Check balance
  IF v_sender_balance < v_total THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Process transfer
  UPDATE public.wallets SET balance = balance - v_total WHERE wallet_id = p_sender_wallet;
  UPDATE public.wallets SET balance = balance + p_amount WHERE wallet_id = p_receiver_wallet;
  
  -- Create transaction record
  v_txn_id := 'TXN-' || REPLACE(gen_random_uuid()::TEXT, '-', '');
  
  INSERT INTO public.transactions (transaction_id, sender_wallet, receiver_wallet, amount, fee, status, type, description)
  VALUES (v_txn_id, p_sender_wallet, p_receiver_wallet, p_amount, p_fee, 'success', 'wallet_transfer', p_description);
  
  -- Create notifications
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_sender_user_id, 'Money Sent', 'You sent ' || p_amount || ' KES to ' || p_receiver_wallet, 'debit');
  
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_receiver_user_id, 'Money Received', 'You received ' || p_amount || ' KES from ' || p_sender_wallet, 'credit');
  
  RETURN json_build_object('success', true, 'transaction_id', v_txn_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Lookup wallet by ID (public readable for transfers)
CREATE OR REPLACE FUNCTION public.lookup_wallet(p_wallet_id TEXT)
RETURNS JSON AS $$
DECLARE
  v_name TEXT;
  v_wallet_id TEXT;
BEGIN
  SELECT p.full_name, w.wallet_id INTO v_name, v_wallet_id
  FROM public.wallets w
  JOIN public.profiles p ON p.user_id = w.user_id
  WHERE w.wallet_id = p_wallet_id;
  
  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;
  
  RETURN json_build_object('found', true, 'full_name', v_name, 'wallet_id', v_wallet_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Verify PIN function
CREATE OR REPLACE FUNCTION public.verify_transaction_pin(p_pin TEXT)
RETURNS JSON AS $$
DECLARE
  v_record RECORD;
BEGIN
  SELECT * INTO v_record FROM public.transaction_pins WHERE user_id = auth.uid();
  
  IF v_record IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'PIN not set');
  END IF;
  
  IF v_record.is_locked AND v_record.locked_until > now() THEN
    RETURN json_build_object('valid', false, 'error', 'PIN locked. Try again later.');
  END IF;
  
  -- Reset lock if expired
  IF v_record.is_locked AND v_record.locked_until <= now() THEN
    UPDATE public.transaction_pins SET is_locked = false, failed_attempts = 0 WHERE user_id = auth.uid();
  END IF;
  
  IF v_record.hashed_pin = crypt(p_pin, v_record.hashed_pin) THEN
    UPDATE public.transaction_pins SET failed_attempts = 0 WHERE user_id = auth.uid();
    RETURN json_build_object('valid', true);
  ELSE
    UPDATE public.transaction_pins 
    SET failed_attempts = failed_attempts + 1,
        is_locked = CASE WHEN failed_attempts + 1 >= 3 THEN true ELSE false END,
        locked_until = CASE WHEN failed_attempts + 1 >= 3 THEN now() + interval '30 minutes' ELSE NULL END
    WHERE user_id = auth.uid();
    
    RETURN json_build_object('valid', false, 'error', 'Invalid PIN', 'attempts_left', 3 - (v_record.failed_attempts + 1));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable pgcrypto for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Set PIN function
CREATE OR REPLACE FUNCTION public.set_transaction_pin(p_pin TEXT)
RETURNS JSON AS $$
BEGIN
  IF LENGTH(p_pin) < 4 OR LENGTH(p_pin) > 6 THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be 4-6 digits');
  END IF;
  
  INSERT INTO public.transaction_pins (user_id, hashed_pin)
  VALUES (auth.uid(), crypt(p_pin, gen_salt('bf')))
  ON CONFLICT (user_id) DO UPDATE SET hashed_pin = crypt(p_pin, gen_salt('bf')), failed_attempts = 0, is_locked = false;
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
