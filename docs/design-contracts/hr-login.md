# Design Contract — Peopleflow Invite-Only Authentication & User Onboarding

- **Target surfaces**:
  - `src/AuthScreen.tsx` (strict Email + Password login screen)
  - `src/AddUser.tsx` (dashboard Add user invitation & workspace directory page)
  - `src/AccountSetup.tsx` (dashboard profile details & password setup page)
  - `supabase/functions/invite-user/index.ts` (server-side single-use verification link issuer)
- **Specialists applied**:
  - Design: `design-ux-architect.md`, `design-ui-designer.md`, `design-ui-finish-gate-reviewer.md`
  - Engineering: `engineering-identity-access-engineer.md`, `engineering-backend-architect.md`, `engineering-frontend-developer.md`, `engineering-section-508-specialist.md`
  - Security: `security-appsec-engineer.md`, `security-ai-generated-code-auditor.md`, `security-secrets-credential-engineer.md`

## 1. Strict Login Surface (`src/AuthScreen.tsx`)
- Prompts **only** Work Email and Password (`supabase.auth.signInWithPassword`).
- Zero Email OTP, zero Number OTP, zero Magic Link, zero Recovery bypass, and zero public Sign-Up.

## 2. Invite-Only User Provisioning (`src/AddUser.tsx` + `invite-user` Edge Function)
- Supabase GoTrue hardened with `disable_signup: true`, `external_phone_enabled: false`, `mailer_autoconfirm: false`, and `mailer_otp_exp: 3600` (60-minute expiry).
- Authenticated dashboard users open **Add user**, enter the new colleague's email, and click **Send verification link**.
- Edge Function `invite-user` verifies the caller's live JWT against GoTrue, blocks un-onboarded callers, validates redirect origin against a strict allowlist (CWE-601), invokes `auth.admin.inviteUserByEmail`, and records `invite_expires_at` (`+60m`) + `password_set: false` in RLS-protected `public.workspace_users`.

## 3. Single-Use Verification Link & Onboarding (`src/AccountSetup.tsx`)
- Clicking the verification link consumes the GoTrue invite token once, strips URL hash/query immediately (`history.replaceState`), stamps `invite_used_at` on `public.workspace_users` so the link can never be replayed, and opens **Complete your profile & set password** inside the dashboard.
- Invited users edit their details (`full_name`, `job_title`, `department`, `phone`) and set their own password before navigating elsewhere in the dashboard.
- Ephemeral sessions (`persistSession: false` + `clearPersistedAuthArtifacts()`) ensure reloading the page always signs out and requires Email + Password.
