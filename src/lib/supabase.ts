import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { extractVerifiedRole } from './auth-validation.ts';

const DEFAULT_PEOPLEFLOW_SUPABASE_URL = 'https://qnoxvzhsywmyatiqdedj.supabase.co';
const DEFAULT_PEOPLEFLOW_PUBLISHABLE_KEY =
  'sb_publishable_H8M3OAq8QpHaMOEoplES9w_nbo78CE0';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  phone: string | null;
  identifier: string;
  displayName: string;
  shortName: string;
  initials: string;
  role: string;
  roleLabel: string;
  verificationLabel: string;
}

/**
 * Purges any persisted Supabase or legacy auth cookies/storage so reloading
 * the page never auto-logs a user back in without re-authenticating.
 */
export function clearPersistedAuthArtifacts(): void {
  if (typeof window === 'undefined') {
    return;
  }

  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const keysToDelete: string[] = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (
          key &&
          (key.startsWith('sb-') ||
            key.startsWith('pf_') ||
            key.includes('supabase.auth'))
        ) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => store.removeItem(key));
    } catch {
      // Ignore storage access errors in restricted environments
    }
  }

  try {
    const rawCookies = document.cookie ? document.cookie.split(';') : [];
    for (const entry of rawCookies) {
      const eqIdx = entry.indexOf('=');
      const name = (eqIdx >= 0 ? entry.slice(0, eqIdx) : entry).trim();
      if (name.startsWith('sb-') || name.startsWith('pf_')) {
        document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
        document.cookie = `${name}=; Path=/; Max-Age=0; Secure; SameSite=None`;
      }
    }
  } catch {
    // Ignore cookie access errors
  }
}

function getSupabasePublicConfig(): { url: string; publishableKey: string } {
  const envUrl = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  return {
    url: (envUrl && envUrl.trim()) || DEFAULT_PEOPLEFLOW_SUPABASE_URL,
    publishableKey:
      (envKey && envKey.trim()) || DEFAULT_PEOPLEFLOW_PUBLISHABLE_KEY,
  };
}

let ephemeralClient: SupabaseClient | null = null;

export function getPeopleflowSupabase(): SupabaseClient {
  if (ephemeralClient) {
    return ephemeralClient;
  }
  clearPersistedAuthArtifacts();
  const { url, publishableKey } = getSupabasePublicConfig();
  ephemeralClient = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return ephemeralClient;
}

export async function signOutFromPeopleflow(): Promise<void> {
  try {
    const client = getPeopleflowSupabase();
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // Ignore network/local sign-out errors
  } finally {
    clearPersistedAuthArtifacts();
  }
}

function formatRoleLabel(role: string): string {
  switch (role) {
    case 'super_admin':
      return 'Super administrator';
    case 'hr_admin':
      return 'HR administrator';
    case 'manager':
      return 'Manager';
    default:
      return 'Authorised HR user';
  }
}

function computeInitials(label: string): string {
  const cleaned = label.replace(/^[^a-zA-Z0-9]+/, '').trim();
  if (!cleaned) {
    return 'PF';
  }
  const parts = cleaned.split(/[\s._@-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function toAuthenticatedUser(user: User): AuthenticatedUser | null {
  const emailConfirmed = Boolean(user.email_confirmed_at);
  const phoneConfirmed = Boolean(user.phone_confirmed_at);

  if (!emailConfirmed && !phoneConfirmed) {
    return null;
  }

  const email = user.email ?? null;
  const phone = user.phone ?? null;
  const identifier = email ?? phone ?? user.id;

  const metaFullName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name.trim()
      : '';
  const emailHandle = email ? email.split('@')[0] : '';
  const displayName = metaFullName || email || phone || 'Peopleflow user';
  const shortName =
    (metaFullName ? metaFullName.split(/\s+/)[0] : emailHandle) ||
    phone ||
    'Account';

  const role = extractVerifiedRole(
    user.app_metadata as Record<string, unknown> | undefined
  );

  const verificationLabel =
    emailConfirmed && phoneConfirmed
      ? 'Email & Phone OTP verified'
      : emailConfirmed
      ? 'Email verified'
      : 'Phone OTP verified';

  return {
    id: user.id,
    email,
    phone,
    identifier,
    displayName,
    shortName,
    initials: computeInitials(metaFullName || emailHandle || phone || 'PF'),
    role,
    roleLabel: formatRoleLabel(role),
    verificationLabel,
  };
}
