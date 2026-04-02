
-- Add new transaction statuses
ALTER TYPE public.transaction_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE public.transaction_status ADD VALUE IF NOT EXISTS 'reversed';

-- OTP codes table
CREATE TABLE public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'verification',
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own OTPs" ON public.otp_codes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- M-Pesa transactions table
CREATE TABLE public.mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reference TEXT,
  checkout_request_id TEXT,
  merchant_request_id TEXT,
  invoice_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  type TEXT NOT NULL DEFAULT 'stk_push',
  error_message TEXT,
  callback_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mpesa transactions" ON public.mpesa_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Card transactions table
CREATE TABLE public.card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  reference TEXT,
  invoice_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  callback_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.card_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own card transactions" ON public.card_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER update_mpesa_transactions_updated_at
  BEFORE UPDATE ON public.mpesa_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_card_transactions_updated_at
  BEFORE UPDATE ON public.card_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
