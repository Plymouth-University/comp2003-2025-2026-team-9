import { supabase } from './supabase';

export type TotpFactorSummary = {
  id: string;
  friendlyName: string | null;
  status: string | null;
};

export type TotpEnrollment = {
  factorId: string;
  qrCode: string | null;
  secret: string | null;
  uri: string | null;
};

export async function listTotpFactors(): Promise<TotpFactorSummary[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;

  const totp = data?.totp ?? [];
  return totp.map((f: any) => ({
    id: String(f.id),
    friendlyName: (f.friendly_name ?? null) as string | null,
    status: (f.status ?? null) as string | null,
  }));
}

export async function enrollTotp(friendlyName = 'Wyttle Authenticator'): Promise<TotpEnrollment> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  });
  if (error) throw error;

  return {
    factorId: String(data.id),
    qrCode: data.totp?.qr_code ?? null,
    secret: data.totp?.secret ?? null,
    uri: data.totp?.uri ?? null,
  };
}

export async function verifyTotpEnrollment(factorId: string, code: string): Promise<void> {
  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });
  if (verifyError) throw verifyError;
}

export async function disableTotpFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
