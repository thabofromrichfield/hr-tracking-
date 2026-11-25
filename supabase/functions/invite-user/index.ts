import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const DEFAULT_ORIGIN = 'https://peopleflow-gamma.vercel.app';
const INVITE_TTL_SECONDS = 3600; // Matches GoTrue mailer_otp_exp (60 minutes, single-use)
const ALLOWED_ROLES = new Set(['hr_admin', 'hr_user', 'manager']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isAllowedOrigin(origin: string | null | undefined): origin is string {
  if (!origin) return false;
  if (
    origin === 'https://peopleflow-gamma.vercel.app' ||
    origin === 'https://peopleflow-lesegomoima.vercel.app' ||
    origin === 'http://localhost:3000' ||
    origin === 'http://localhost:5173'
  ) {
    return true;
  }
  return (
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.e2b\.app$/i.test(origin)
  );
}

function buildCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowOrigin = isAllowedOrigin(requestOrigin)
    ? requestOrigin
    : DEFAULT_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function jsonResponse(
  status: number,
  payload: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' }, corsHeaders);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      500,
      { error: 'Server auth configuration is incomplete.' },
      corsHeaders
    );
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return jsonResponse(
      401,
      { error: 'Sign in with an active workspace account first.' },
      corsHeaders
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user: caller },
    error: callerErr,
  } = await adminClient.auth.getUser(bearerMatch[1]);

  if (callerErr || !caller || !caller.email_confirmed_at) {
    return jsonResponse(
      401,
      { error: 'Your session is invalid or expired. Sign in again.' },
      corsHeaders
    );
  }

  const { data: callerProfile } = await adminClient
    .from('workspace_users')
    .select('id, password_set, status')
    .eq('id', caller.id)
    .maybeSingle();

  if (callerProfile && !callerProfile.password_set) {
    return jsonResponse(
      403,
      { error: 'Finish setting your own password before inviting new users.' },
      corsHeaders
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON request body.' }, corsHeaders);
  }

  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!rawEmail || rawEmail.length > 254 || !EMAIL_RE.test(rawEmail)) {
    return jsonResponse(
      400,
      { error: 'Enter a valid work email address.' },
      corsHeaders
    );
  }

  const fullName =
    typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 120) : '';
  const jobTitle =
    typeof body.jobTitle === 'string' ? body.jobTitle.trim().slice(0, 120) : '';
  const department =
    typeof body.department === 'string'
      ? body.department.trim().slice(0, 120)
      : '';
  const requestedRole = typeof body.role === 'string' ? body.role.trim() : 'hr_user';
  const role = ALLOWED_ROLES.has(requestedRole) ? requestedRole : 'hr_user';

  const rawOrigin =
    typeof body.redirectOrigin === 'string' ? body.redirectOrigin.trim() : '';
  const safeRedirectOrigin = isAllowedOrigin(rawOrigin)
    ? rawOrigin
    : isAllowedOrigin(req.headers.get('origin'))
    ? (req.headers.get('origin') as string)
    : DEFAULT_ORIGIN;

  // Check if user already exists in workspace_users
  const { data: existingWorkspaceUser } = await adminClient
    .from('workspace_users')
    .select('id, email, password_set, status')
    .eq('email', rawEmail)
    .maybeSingle();

  if (existingWorkspaceUser?.password_set) {
    return jsonResponse(
      409,
      {
        error:
          'This email already belongs to an active workspace user who can sign in with their password.',
      },
      corsHeaders
    );
  }

  // If a prior invite existed and was never completed, remove the stale stub so GoTrue issues a fresh single-use invite token
  if (existingWorkspaceUser && !existingWorkspaceUser.password_set) {
    await adminClient.auth.admin.deleteUser(existingWorkspaceUser.id);
  }

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(rawEmail, {
      redirectTo: `${safeRedirectOrigin}/`,
      data: {
        full_name: fullName,
        job_title: jobTitle,
        department,
        onboarding_required: true,
        invited_by: caller.email ?? null,
      },
    });

  if (inviteError || !inviteData?.user) {
    const msg = inviteError?.message ?? 'Unable to send verification invite.';
    if (/already been registered|already exists/i.test(msg)) {
      return jsonResponse(
        409,
        { error: 'A user with this email address is already registered.' },
        corsHeaders
      );
    }
    if (/rate limit|over_email_send_rate_limit/i.test(msg)) {
      return jsonResponse(
        429,
        {
          error:
            'Email invite rate limit reached on Supabase built-in mail. Wait a few minutes or configure custom SMTP in Supabase Auth.',
        },
        corsHeaders
      );
    }
    return jsonResponse(400, { error: msg }, corsHeaders);
  }

  const invitedUser = inviteData.user;
  await adminClient.auth.admin.updateUserById(invitedUser.id, {
    app_metadata: {
      role,
      onboarding_required: true,
    },
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_SECONDS * 1000);

  const { data: savedRow, error: upsertError } = await adminClient
    .from('workspace_users')
    .upsert(
      {
        id: invitedUser.id,
        email: rawEmail,
        full_name: fullName,
        job_title: jobTitle,
        department,
        role,
        status: 'invited',
        invited_by: caller.id,
        invited_by_email: caller.email ?? null,
        invited_at: now.toISOString(),
        invite_expires_at: expiresAt.toISOString(),
        invite_used_at: null,
        password_set: false,
        updated_at: now.toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single();

  if (upsertError) {
    return jsonResponse(
      500,
      { error: 'Invite email sent, but workspace directory record failed to save.' },
      corsHeaders
    );
  }

  return jsonResponse(
    200,
    {
      ok: true,
      expiresInMinutes: Math.round(INVITE_TTL_SECONDS / 60),
      user: savedRow,
    },
    corsHeaders
  );
});
