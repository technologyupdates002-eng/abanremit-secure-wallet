
-- Create KYC documents storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT (id) DO NOTHING;

-- RLS for kyc-documents bucket
CREATE POLICY "Users can upload own KYC docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = 'kyc' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "Users can view own KYC docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = 'kyc' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "Admins can view all KYC docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'));

-- Add SMS fee setting if not exists
INSERT INTO public.global_settings (key, value, description)
VALUES ('sms_notification_fee', '1', 'Fee charged per SMS notification (KES)')
ON CONFLICT (key) DO NOTHING;

-- Add currency column to wallets - change default to 'ABC' (Aban Coin)
ALTER TABLE public.wallets ALTER COLUMN currency SET DEFAULT 'ABC';
