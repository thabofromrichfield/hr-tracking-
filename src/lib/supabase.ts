import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import {
  extractVerifiedRole,
  mapAuthError,
  normalizeEmail,
  parseInviteUrlParams,
} from './auth-validation.ts';

const DEFAULT_PEOPLEFLOW_SUPABASE_URL = 'https://qnoxvzhsywmyatiqdedj.supabase.co';
const DEFAULT_PEOPLEFLOW_PUBLISHABLE_KEY =
  'sb_publishable_H8M3OAq8QpHaMOEoplES9w_nbo78CE0';

export interface WorkspaceUserRecord {
  id: string;
  email: string;
  full_name: string;
  job_title: string;
  department: string;
  phone: string;
  role: 'hr_admin' | 'hr_user' | 'manager';
  status: 'invited' | 'active';
  invited_by: string | null;
  invited_by_email: string | null;
  invited_at: string;
  invite_expires_at: string | null;
  invite_used_at: string | null;
  password_set: boolean;
  updated_at: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  phone: string | null;
  identifier: string;
  displayName: string;
  shortName: string;
  initials: string;
  jobTitle: string;
  department: string;
  contactPhone: string;
  role: string;
  roleLabel: string;
  verificationLabel: string;
  mustSetupPassword: boolean;
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
            key.startsWith('supabase.auth') ||
            key.startsWith('pf_'))
        ) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        store.removeItem(key);
      }
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
      }
    }
  } catch {
    // Ignore cookie access errors
  }
}

export function getSupabasePublicConfig(): { url: string; publishableKey: string } {
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
    case 'hr_user':
      return 'HR user';
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

export function toAuthenticatedUser(
  user: User,
  profileRow?: Partial<WorkspaceUserRecord> | null
): AuthenticatedUser | null {
  const emailConfirmed = Boolean(user.email_confirmed_at);
  const phoneConfirmed = Boolean(user.phone_confirmed_at);

  if (!emailConfirmed && !phoneConfirmed) {
    return null;
  }

  const email = user.email ?? profileRow?.email ?? null;
  const phone = user.phone ?? null;
  const identifier = email ?? phone ?? user.id;

  const metaFullName =
    typeof profileRow?.full_name === 'string' && profileRow.full_name.trim()
      ? profileRow.full_name.trim()
      : typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name.trim()
      : '';
  const jobTitle =
    typeof profileRow?.job_title === 'string'
      ? profileRow.job_title.trim()
      : typeof user.user_metadata?.job_title === 'string'
      ? user.user_metadata.job_title.trim()
      : '';
  const department =
    typeof profileRow?.department === 'string'
      ? profileRow.department.trim()
      : typeof user.user_metadata?.department === 'string'
      ? user.user_metadata.department.trim()
      : '';
  const contactPhone =
    typeof profileRow?.phone === 'string'
      ? profileRow.phone.trim()
      : typeof user.user_metadata?.phone_contact === 'string'
      ? user.user_metadata.phone_contact.trim()
      : '';

  const emailHandle = email ? email.split('@')[0] : '';
  const displayName = metaFullName || email || phone || 'Peopleflow user';
  const shortName =
    (metaFullName ? metaFullName.split(/\s+/)[0] : emailHandle) ||
    phone ||
    'Account';

  const verifiedAppRole = extractVerifiedRole(
    user.app_metadata as Record<string, unknown> | undefined
  );
  const role =
    profileRow?.role && verifiedAppRole === 'employee'
      ? profileRow.role
      : verifiedAppRole;

  const mustSetupPassword =
    typeof profileRow?.password_set === 'boolean'
      ? !profileRow.password_set
      : Boolean(
          user.user_metadata?.onboarding_required &&
            !user.user_metadata?.onboarding_completed
        );

  const verificationLabel = mustSetupPassword
    ? 'One-time invite verified · Password setup required'
    : 'Email & password verified';

  return {
    id: user.id,
    email,
    phone,
    identifier,
    displayName,
    shortName,
    initials: computeInitials(metaFullName || emailHandle || phone || 'PF'),
    jobTitle,
    department,
    contactPhone,
    role,
    roleLabel: formatRoleLabel(role),
    verificationLabel,
    mustSetupPassword,
  };
}

async function fetchOwnWorkspaceRow(
  userId: string
): Promise<WorkspaceUserRecord | null> {
  try {
    const supabase = getPeopleflowSupabase();
    const { data } = await supabase
      .from('workspace_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    return (data as WorkspaceUserRecord | null) ?? null;
  } catch {
    return null;
  }
}

export async function signInWithEmailPassword(
  rawEmail: string,
  password: string
): Promise<
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; error: string }
> {
  const email = normalizeEmail(rawEmail);
  const supabase = getPeopleflowSupabase();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await signOutFromPeopleflow();
    return { ok: false, error: mapAuthError(error).userMessage };
  }

  const { data: verified, error: userErr } = await supabase.auth.getUser();
  if (userErr || !verified.user) {
    await signOutFromPeopleflow();
    return {
      ok: false,
      error: 'Unable to verify your workspace account. Try again.',
    };
  }

  const row = await fetchOwnWorkspaceRow(verified.user.id);
  if (row && !row.password_set) {
    await signOutFromPeopleflow();
    return {
      ok: false,
      error:
        'Your invitation setup is incomplete. Use your verification invite link to set a password first.',
    };
  }

  const authUser = toAuthenticatedUser(verified.user, row);
  if (!authUser) {
    await signOutFromPeopleflow();
    return {
      ok: false,
      error:
        'Account email is not verified. Open your one-time invitation link first.',
    };
  }

  clearPersistedAuthArtifacts();
  return { ok: true, user: { ...authUser, mustSetupPassword: false } };
}

/**
 * Checks the initial page URL once for a single-use `type=invite` callback,
 * immediately clears URL tokens from the address bar, validates single-use and
 * TTL constraints, and opens the invited user into account setup.
 */
export async function consumeOneTimeInviteFromLocation(): Promise<
  | { status: 'none' }
  | { status: 'error'; message: string }
  | { status: 'authenticated'; user: AuthenticatedUser }
> {
  if (typeof window === 'undefined') {
    return { status: 'none' };
  }

  const rawHash = window.location.hash;
  const rawSearch = window.location.search;
  const parsed = parseInviteUrlParams(rawHash, rawSearch);

  if (parsed.kind !== 'none') {
    try {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname || '/'
      );
    } catch {
      // Ignore history API restrictions
    }
  }

  if (parsed.kind === 'none') {
    return { status: 'none' };
  }

  if (parsed.kind === 'expired' || parsed.kind === 'rejected') {
    await signOutFromPeopleflow();
    return { status: 'error', message: parsed.message };
  }

  const supabase = getPeopleflowSupabase();

  if (parsed.kind === 'invite_session') {
    const { error } = await supabase.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    });
    if (error) {
      await signOutFromPeopleflow();
      return {
        status: 'error',
        message:
          'This verification link has already been used or has expired. Ask an administrator to send a new invite.',
      };
    }
  } else {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: parsed.tokenHash,
      type: 'invite',
    });
    if (error) {
      await signOutFromPeopleflow();
      return {
        status: 'error',
        message:
          'This verification link has already been used or has expired. Ask an administrator to send a new invite.',
      };
    }
  }

  const { data: verified, error: userErr } = await supabase.auth.getUser();
  if (userErr || !verified.user) {
    await signOutFromPeopleflow();
    return {
      status: 'error',
      message: 'Verification link could not be validated. Request a new invite.',
    };
  }

  const row = await fetchOwnWorkspaceRow(verified.user.id);
  if (row) {
    if (row.password_set || row.invite_used_at) {
      await signOutFromPeopleflow();
      return {
        status: 'error',
        message:
          'This one-time verification link has already been used. Sign in with your email and password.',
      };
    }
    if (
      row.invite_expires_at &&
      new Date(row.invite_expires_at).getTime() < Date.now()
    ) {
      await signOutFromPeopleflow();
      return {
        status: 'error',
        message:
          'This verification link has expired. Ask an administrator to send a new invite from Add user.',
      };
    }

    await supabase
      .from('workspace_users')
      .update({ invite_used_at: new Date().toISOString() })
      .eq('id', verified.user.id);
  }

  const mapped = toAuthenticatedUser(verified.user, {
    ...row,
    password_set: false,
  });

  if (!mapped) {
    await signOutFromPeopleflow();
    return {
      status: 'error',
      message: 'Unable to activate invited account. Request a fresh invite.',
    };
  }

  clearPersistedAuthArtifacts();
  return {
    status: 'authenticated',
    user: { ...mapped, mustSetupPassword: true },
  };
}

export async function listWorkspaceUsers(): Promise<WorkspaceUserRecord[]> {
  const supabase = getPeopleflowSupabase();
  const { data, error } = await supabase
    .from('workspace_users')
    .select('*')
    .order('invited_at', { ascending: false });

  if (error || !data) {
    return [];
  }
  return data as WorkspaceUserRecord[];
}

export async function inviteWorkspaceUser(input: {
  email: string;
  fullName?: string;
  jobTitle?: string;
  department?: string;
  role?: 'hr_admin' | 'hr_user' | 'manager';
}): Promise<
  | { ok: true; user: WorkspaceUserRecord; expiresInMinutes: number }
  | { ok: false; error: string }
> {
  const supabase = getPeopleflowSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      ok: false,
      error: 'Your session expired. Sign in again to invite a user.',
    };
  }

  const { url, publishableKey } = getSupabasePublicConfig();
  const redirectOrigin =
    typeof window !== 'undefined' ? window.location.origin : undefined;

  try {
    const response = await fetch(`${url}/functions/v1/invite-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: publishableKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email: normalizeEmail(input.email),
        fullName: input.fullName?.trim() ?? '',
        jobTitle: input.jobTitle?.trim() ?? '',
        department: input.department?.trim() ?? '',
        role: input.role ?? 'hr_user',
        redirectOrigin,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      expiresInMinutes?: number;
      user?: WorkspaceUserRecord;
    };

    if (!response.ok || !payload.ok || !payload.user) {
      return {
        ok: false,
        error:
          payload.error ||
          'Unable to send verification link. Verify the email address and try again.',
      };
    }

    return {
      ok: true,
      user: payload.user,
      expiresInMinutes: payload.expiresInMinutes ?? 60,
    };
  } catch {
    return {
      ok: false,
      error: 'Network error while contacting Peopleflow invite service.',
    };
  }
}

export async function saveOwnProfileAndPassword(input: {
  fullName: string;
  jobTitle: string;
  department: string;
  phone: string;
  newPassword?: string;
}): Promise<
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; error: string }
> {
  const supabase = getPeopleflowSupabase();
  const fullName = input.fullName.trim();
  const jobTitle = input.jobTitle.trim();
  const department = input.department.trim();
  const phone = input.phone.trim();

  const updatePayload: {
    password?: string;
    data: Record<string, unknown>;
  } = {
    data: {
      full_name: fullName,
      job_title: jobTitle,
      department,
      phone_contact: phone,
      onboarding_completed: true,
      onboarding_required: false,
    },
  };

  if (input.newPassword) {
    updatePayload.password = input.newPassword;
  }

  const { data: updatedAuth, error: authErr } =
    await supabase.auth.updateUser(updatePayload);

  if (authErr || !updatedAuth.user) {
    return {
      ok: false,
      error: authErr?.message || 'Unable to save your account details.',
    };
  }

  const nowIso = new Date().toISOString();
  const { data: updatedRow, error: rowErr } = await supabase
    .from('workspace_users')
    .update({
      full_name: fullName,
      job_title: jobTitle,
      department,
      phone,
      status: 'active',
      password_set: true,
      invite_used_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', updatedAuth.user.id)
    .select('*')
    .maybeSingle();

  if (rowErr) {
    return {
      ok: false,
      error: 'Password saved, but profile details could not be updated.',
    };
  }

  clearPersistedAuthArtifacts();

  const mapped = toAuthenticatedUser(
    updatedAuth.user,
    (updatedRow as WorkspaceUserRecord | null) ?? {
      full_name: fullName,
      job_title: jobTitle,
      department,
      phone,
      status: 'active',
      password_set: true,
    }
  );

  if (!mapped) {
    return { ok: false, error: 'Unable to refresh your workspace profile.' };
  }

  return {
    ok: true,
    user: { ...mapped, mustSetupPassword: false },
  };
}
