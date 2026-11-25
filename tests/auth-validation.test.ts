import test from "node:test";
import assert from "node:assert/strict";
import {
  extractVerifiedRole,
  mapAuthError,
  normalizeE164Phone,
  normalizeEmail,
  sanitizeRedirectPath,
  validateEmail,
  validateOtpToken,
} from "../src/lib/auth-validation.ts";
import {
  clearPersistedAuthArtifacts,
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

test("clearPersistedAuthArtifacts wipes sb-* and pf_* storage while keeping workspace records", () => {
  const makeStore = (initial: Record<string, string>) => {
    const map = new Map(Object.entries(initial));
    return {
      get length() {
        return map.size;
      },
      key: (i: number) => Array.from(map.keys())[i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
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

  clearPersistedAuthArtifacts();

  assert.equal(localStore.getItem("sb-qnoxvzhsywmyatiqdedj-auth-token"), null);
  assert.equal(localStore.getItem("pf_access_token"), null);
  assert.equal(localStore.getItem("peopleflow-employees"), '[{"id":"emp-1"}]');
  assert.equal(sessionStore.getItem("sb-temp-session"), null);
  assert.ok(expiredCookies.some((c) => c.startsWith("sb-qnoxvzhsywmyatiqdedj-auth-token=;")));
  assert.ok(expiredCookies.some((c) => c.startsWith("pf_access_token=;")));
});
