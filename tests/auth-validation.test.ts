import test from "node:test";
import assert from "node:assert/strict";
import {
  extractVerifiedRole,
  mapAuthError,
  normalizeE164Phone,
  normalizeEmail,
  parseInviteUrlParams,
  sanitizeRedirectPath,
  validateEmail,
  validateOtpToken,
  validatePasswordSetup,
} from "../src/lib/auth-validation.ts";
import {
  ACTIVE_SESSION_STORAGE_KEY,
  clearPersistedAuthArtifacts,
  getLastSessionActivity,
  isSessionInactive,
  LAST_ACTIVE_AT_KEY,
  recordSessionActivity,
  SESSION_INACTIVITY_LIMIT_MS,
  toAuthenticatedUser,
} from "../src/lib/supabase.ts";

test("normalizeEmail and validateEmail accept valid emails and reject malformed inputs", () => {
  assert.equal(normalizeEmail("  Thabo@PeopleFlow.CO.ZA "), "thabo@peopleflow.co.za");
  assert.equal(validateEmail("thabo@peopleflow.co.za"), null);
  assert.ok(validateEmail(""));
  assert.ok(validateEmail("not-an-email"));
});

test("normalizeE164Phone converts local ZA numbers and preserves international E.164", () => {
  assert.deepEqual(normalizeE164Phone("+27", "082 123 4567"), {
    ok: true,
    e164: "+27821234567",
  });
  assert.deepEqual(normalizeE164Phone("+27", "+44 7700 900123"), {
    ok: true,
    e164: "+447700900123",
  });
  const invalid = normalizeE164Phone("+27", "abc");
  assert.equal(invalid.ok, false);
});

test("validateOtpToken accepts 6-digit SMS and 8-digit Email OTP codes", () => {
  assert.deepEqual(validateOtpToken("123456", "sms"), {
    ok: true,
    token: "123456",
  });
  assert.deepEqual(validateOtpToken("1234 5678", "email"), {
    ok: true,
    token: "12345678",
  });
  assert.equal(validateOtpToken("12345", "sms").ok, false);
  assert.equal(validateOtpToken("123456789", "email").ok, false);
  assert.equal(validateOtpToken("12ab56", "email").ok, false);
});

test("sanitizeRedirectPath blocks open redirects (CWE-601)", () => {
  assert.equal(sanitizeRedirectPath("/dashboard"), "/dashboard");
  assert.equal(sanitizeRedirectPath("/dashboard/leave?tab=pending"), "/dashboard/leave?tab=pending");
  assert.equal(sanitizeRedirectPath("https://attacker.example/phish"), "/dashboard");
  assert.equal(sanitizeRedirectPath("//attacker.example/phish"), "/dashboard");
  assert.equal(sanitizeRedirectPath("/\\attacker.example"), "/dashboard");
  assert.equal(sanitizeRedirectPath("/dashboard\r\nSet-Cookie: evil=1"), "/dashboard");
  assert.equal(sanitizeRedirectPath(null), "/dashboard");
});

test("extractVerifiedRole trusts only allowlisted app_metadata roles", () => {
  assert.equal(extractVerifiedRole({ role: "hr_admin" }), "hr_admin");
  assert.equal(extractVerifiedRole({ role: "super_admin" }), "super_admin");
  assert.equal(extractVerifiedRole({ role: "root_hacker" }), "employee");
  assert.equal(extractVerifiedRole(undefined), "employee");
});

test("mapAuthError classifies unconfirmed email, unprovisioned OTP, SMS config, expired OTP, and rate limits", () => {
  assert.equal(
    mapAuthError({ code: "email_not_confirmed", message: "Email not confirmed" }).code,
    "unconfirmed_email"
  );
  assert.equal(
    mapAuthError({ message: "Signups not allowed for otp" }).code,
    "unprovisioned"
  );
  assert.equal(
    mapAuthError({ code: "sms_send_failed", message: "Error sending confirmation sms" }).code,
    "sms_provider_unconfigured"
  );
  assert.equal(
    mapAuthError({ code: "otp_expired", message: "Token has expired or is invalid" }).code,
    "invalid_otp"
  );
  assert.equal(
    mapAuthError({ status: 429, message: "Email rate limit exceeded" }).code,
    "rate_limited"
  );
});

test("toAuthenticatedUser blocks unconfirmed users and ignores user_metadata.role", () => {
  const unconfirmed = toAuthenticatedUser({
    id: "u-1",
    email: "user@company.co.za",
    email_confirmed_at: undefined,
    phone_confirmed_at: undefined,
    app_metadata: { role: "hr_admin" },
    user_metadata: { role: "super_admin" },
    aud: "authenticated",
    created_at: "2026-11-25T10:00:00Z",
  });
  assert.equal(unconfirmed, null);

  const confirmed = toAuthenticatedUser({
    id: "u-2",
    email: "thabo@company.co.za",
    email_confirmed_at: "2026-11-25T10:05:00Z",
    app_metadata: {},
    user_metadata: { full_name: "Thabo Mokoena", role: "super_admin" },
    aud: "authenticated",
    created_at: "2026-11-25T10:00:00Z",
  });
  assert.ok(confirmed);
  assert.equal(confirmed.initials, "TM");
  assert.equal(confirmed.role, "employee");
  assert.equal(confirmed.identifier, "thabo@company.co.za");
});

test("reload preserves active sessionStorage session until logout or 1-hour inactivity while purging localStorage/cookies", () => {
  const makeStore = (initial: Record<string, string>) => {
    const map = new Map(Object.entries(initial));
    return {
      get length() {
        return map.size;
      },
      key: (i: number) => Array.from(map.keys())[i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
  };

  const localStore = makeStore({
    "sb-qnoxvzhsywmyatiqdedj-auth-token": '{"access_token":"secret"}',
    pf_access_token: "tok",
    "peopleflow-employees": '[{"id":"emp-1"}]',
  });
  const sessionStore = makeStore({
    [ACTIVE_SESSION_STORAGE_KEY]: '{"access_token":"live-session"}',
    "sb-temp-session": "1",
  });

  Object.defineProperty(globalThis, "window", {
    value: { localStorage: localStore, sessionStorage: sessionStore },
    configurable: true,
  });
  const expiredCookies: string[] = [];
  Object.defineProperty(globalThis, "document", {
    value: {
      get cookie() {
        return "sb-qnoxvzhsywmyatiqdedj-auth-token=abc; pf_access_token=xyz; theme=light";
      },
      set cookie(val: string) {
        expiredCookies.push(val);
      },
    },
    configurable: true,
  });

  // Page reload cleanup (includeActiveSession: false) keeps active tab session alive
  clearPersistedAuthArtifacts({ includeActiveSession: false });
  assert.equal(localStore.getItem("sb-qnoxvzhsywmyatiqdedj-auth-token"), null);
  assert.equal(localStore.getItem("pf_access_token"), null);
  assert.equal(localStore.getItem("peopleflow-employees"), '[{"id":"emp-1"}]');
  assert.equal(
    sessionStore.getItem(ACTIVE_SESSION_STORAGE_KEY),
    '{"access_token":"live-session"}'
  );
  assert.equal(sessionStore.getItem("sb-temp-session"), null);
  assert.ok(expiredCookies.some((c) => c.startsWith("sb-qnoxvzhsywmyatiqdedj-auth-token=;")));

  // 1-hour inactivity tracking
  assert.equal(SESSION_INACTIVITY_LIMIT_MS, 60 * 60 * 1000);
  const t0 = 1_700_000_000_000;
  recordSessionActivity(t0);
  assert.equal(getLastSessionActivity(), t0);
  assert.equal(isSessionInactive(t0 + 59 * 60 * 1000), false);
  assert.equal(isSessionInactive(t0 + 60 * 60 * 1000 + 1), true);

  // Explicit logout wipes active session + inactivity timestamp
  clearPersistedAuthArtifacts({ includeActiveSession: true });
  assert.equal(sessionStore.getItem(ACTIVE_SESSION_STORAGE_KEY), null);
  assert.equal(sessionStore.getItem(LAST_ACTIVE_AT_KEY), null);
});

test("parseInviteUrlParams accepts only single-use type=invite links and rejects all other auth link types", () => {
  assert.deepEqual(parseInviteUrlParams("", ""), { kind: "none" });

  assert.deepEqual(
    parseInviteUrlParams("#access_token=jwt1&refresh_token=ref1&type=invite", ""),
    {
      kind: "invite_session",
      accessToken: "jwt1",
      refreshToken: "ref1",
    }
  );

  assert.deepEqual(
    parseInviteUrlParams("", "?token_hash=hash123&type=invite"),
    {
      kind: "invite_token_hash",
      tokenHash: "hash123",
    }
  );

  assert.equal(
    parseInviteUrlParams("#access_token=jwt1&refresh_token=ref1&type=magiclink", "").kind,
    "rejected"
  );
  assert.equal(
    parseInviteUrlParams("#access_token=jwt1&refresh_token=ref1&type=recovery", "").kind,
    "rejected"
  );
  assert.equal(
    parseInviteUrlParams("", "?token_hash=hash123&type=signup").kind,
    "rejected"
  );
  assert.equal(
    parseInviteUrlParams("#error=access_denied&error_code=otp_expired", "").kind,
    "expired"
  );
});

test("validatePasswordSetup enforces length, letter+number complexity, and confirmation match", () => {
  assert.equal(validatePasswordSetup("Peopleflow2026", "Peopleflow2026"), null);
  assert.ok(validatePasswordSetup("short1", "short1"));
  assert.ok(validatePasswordSetup("onlyletters", "onlyletters"));
  assert.ok(validatePasswordSetup("123456789", "123456789"));
  assert.ok(validatePasswordSetup("Peopleflow2026", "Mismatch2026"));
});

test("toAuthenticatedUser flags mustSetupPassword for invited users until password_set is true", () => {
  const invited = toAuthenticatedUser(
    {
      id: "u-inv",
      email: "newuser@company.co.za",
      email_confirmed_at: "2026-11-25T12:00:00Z",
      app_metadata: { role: "hr_user" },
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-11-25T12:00:00Z",
    },
    { password_set: false, role: "hr_user" }
  );
  assert.ok(invited);
  assert.equal(invited.mustSetupPassword, true);

  const onboarded = toAuthenticatedUser(
    {
      id: "u-inv",
      email: "newuser@company.co.za",
      email_confirmed_at: "2026-11-25T12:00:00Z",
      app_metadata: { role: "hr_user" },
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-11-25T12:00:00Z",
    },
    { full_name: "Lerato Molefe", password_set: true, role: "hr_user" }
  );
  assert.ok(onboarded);
  assert.equal(onboarded.mustSetupPassword, false);
  assert.equal(onboarded.displayName, "Lerato Molefe");
});
