# Design Contract — Peopleflow HR Authentication & Ephemeral Workspace Gate

- **Target surface**: `src/AuthScreen.tsx`, `src/App.tsx`, `src/Settings.tsx`, `src/Warnings.tsx`
- **Design specialists applied**:
  - `.agents/agency-agents/design/design-ux-architect.md`
  - `.agents/agency-agents/design/design-ui-designer.md`
  - `.agents/agency-agents/design/design-inclusive-visuals-specialist.md`
  - `.agents/agency-agents/design/design-ui-finish-gate-reviewer.md`
- **Engineering & Security specialists applied**:
  - `.agents/agency-agents/engineering/engineering-identity-access-engineer.md`
  - `.agents/agency-agents/engineering/engineering-frontend-developer.md`
  - `.agents/agency-agents/engineering/engineering-section-508-specialist.md`
  - `.agents/agency-agents/security/security-appsec-engineer.md`
  - `.agents/agency-agents/security/security-ai-generated-code-auditor.md`
  - `.agents/agency-agents/security/security-secrets-credential-engineer.md`

## 1. Visual Direction & Palette
- **Aesthetic**: Harmonised with the Peopleflow HR Goodfood/Plus Jakarta Sans light glassmorphic system (`#EEF0F6` ambient canvas, frosted white `.lock-card`, `#5B6CF9` royal indigo primary CTA, `#4b6d50` sage security emblem, inset `#eef1f7` form inputs).
- **Zero hardcoded persona**: Removed `LockScreen`, `Sarah Ndlovu`, `SN`, `sarah@peopleflow.co.za`, and `ayesha.patel@peopleflow.co.za` across `src/App.tsx`, `src/Settings.tsx`, and `src/Warnings.tsx`.

## 2. Authentication Architecture & Security Invariants
- **Existing users only**: Every OTP call sets `shouldCreateUser: false`. No public sign-up endpoint or UI exists (`auth.users` modified only via Supabase Studio / admin provisioning).
- **Three sign-in methods**:
  1. **Email & Password** (`signInWithPassword({ email, password })` + password reset link flow).
  2. **Email OTP** (`signInWithOtp({ email, options: { shouldCreateUser: false } })` + `verifyOtp({ email, token, type: 'email' })`).
  3. **Number OTP** (`signInWithOtp({ phone, options: { shouldCreateUser: false } })` + `verifyOtp({ phone, token, type: 'sms' })`, E.164 normalized with `+27` South Africa default).
- **Verified session & RBAC**: Every sign-in calls `supabase.auth.getUser()` to confirm live user + `email_confirmed_at || phone_confirmed_at` before unlocking workspace; role derives strictly from `app_metadata.role` (never `user_metadata`).
- **Zero session persistence across reloads**:
  - Supabase client configured with `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`.
  - `clearPersistedAuthArtifacts()` purges `sb-*` and `pf_*` keys from `localStorage`, `sessionStorage`, and `document.cookie` at startup and sign-out while preserving `peopleflow-*` HR records.
  - `authUser` lives strictly in React state (`useState<AuthenticatedUser | null>(null)`), guaranteeing every page reload requires fresh authentication.

## 3. Accessibility & Finish Gate Checklist
- Semantic `<label htmlFor>` + `id`, ARIA `role="tablist"` / `role="tab"` / `role="tabpanel"` with Left/Right/Home/End keyboard navigation, `aria-live` status banners, `inputMode="numeric"` + `autoComplete="one-time-code"` for OTP inputs, and `2.5px` `#5B6CF9` `:focus-visible` outlines.
- Verified responsive geometry across `390px` mobile and `1440px` desktop viewports with zero horizontal overflow.
