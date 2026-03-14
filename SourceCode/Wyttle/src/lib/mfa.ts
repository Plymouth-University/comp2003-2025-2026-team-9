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

function isVerifiedFactor(status: string | null | undefined): boolean {
  return String(status ?? '').toLowerCase() === 'verified';
}

export async function listTotpFactors(): Promise<TotpFactorSummary[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;

  const totp = (data?.all ?? []).filter((factor: any) => factor.factor_type === 'totp');
  return totp.map((f: any) => ({
    id: String(f.id),
    friendlyName: (f.friendly_name ?? null) as string | null,
    status: (f.status ?? null) as string | null,
  }));
}

async function clearStaleTotpFactors(friendlyName?: string): Promise<void> {
  const factors = await listTotpFactors();
  const staleFactors = factors.filter(
    (factor) =>
      !isVerifiedFactor(factor.status)
      && (friendlyName ? factor.friendlyName === friendlyName : true),
  );

  for (const factor of staleFactors) {
    await disableTotpFactor(factor.id);
  }
}

export async function enrollTotp(friendlyName = 'Wyttle Authenticator'): Promise<TotpEnrollment> {
  const attemptEnroll = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName,
    });
    if (error) throw error;
    return data;
  };

  // If the app was refreshed mid-setup, Supabase can keep an unverified TOTP
  // factor around. Clear those stale enrollments before attempting a new setup.
  await clearStaleTotpFactors();

  let data;
  try {
    data = await attemptEnroll();
  } catch (error: any) {
    const message = String(error?.message ?? '');
    const duplicateFriendlyName = message.toLowerCase().includes('friendly name')
      && message.toLowerCase().includes('already exists');

    if (!duplicateFriendlyName) {
      throw error;
    }

    await clearStaleTotpFactors(friendlyName);
    data = await attemptEnroll();
  }

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

export function getTotpQrSvg(qrCode: string | null | undefined): string | null {
  if (!qrCode) return null;

  const trimmed = qrCode.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('<svg')) {
    return trimmed;
  }

  const svgUtf8Prefix = 'data:image/svg+xml;utf8,';
  if (trimmed.startsWith(svgUtf8Prefix)) {
    return decodeURIComponent(trimmed.slice(svgUtf8Prefix.length));
  }

  return null;
}

export function getTotpQrImageUrl(uri: string | null | undefined, size = 168): string | null {
  if (!uri) return null;

  const trimmed = uri.trim();
  if (!trimmed) return null;

  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(trimmed)}`;
}
