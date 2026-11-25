export type VerificationChannel = "email" | "sms";
export type EmailOtpKind = "email" | "signup";

export type MappedAuthErrorCode =
  | "unconfirmed_email"
  | "unprovisioned"
  | "rate_limited"
  | "invalid_otp"
  | "sms_provider_unconfigured"
  | "invalid_credentials";

export interface MappedAuthError {
  code: MappedAuthErrorCode;
  userMessage: string;
}

const ALLOWED_APP_ROLES = new Set([
  "super_admin",
  "hr_admin",
  "manager",
  "employee",
]);

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateEmail(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (!email) {
    return "Enter your work email address.";
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailPattern.test(email) || email.length > 254) {
    return "Enter a valid email address (for example, name@company.co.za).";
  }
  return null;
}

export function normalizeE164Phone(
  countryDialCode: string,
  rawInput: string
): { ok: true; e164: string } | { ok: false; error: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter your mobile phone number." };
  }

  let candidate: string;
  if (trimmed.startsWith("+")) {
    candidate = "+" + trimmed.slice(1).replace(/[\s()-]/g, "");
  } else {
    const cleanDial =
      "+" + countryDialCode.replace(/[^\d]/g, "");
    let nationalDigits = trimmed.replace(/[\s()-]/g, "");
    // Strip trunk prefix '0' when paired with a country dial code (e.g. 082 -> +2782)
    if (nationalDigits.startsWith("0")) {
      nationalDigits = nationalDigits.slice(1);
    }
    candidate = `${cleanDial}${nationalDigits}`;
  }

  if (!/^\+[1-9]\d{6,14}$/.test(candidate)) {
    return {
      ok: false,
      error:
        "Enter a valid phone number in international E.164 format (for example, +27 82 123 4567).",
    };
  }

  return { ok: true, e164: candidate };
}

export function validateOtpToken(
  raw: string,
  channel: VerificationChannel
): { ok: true; token: string } | { ok: false; error: string } {
  const cleaned = raw.replace(/[\s-]/g, "");
  if (!cleaned) {
    return {
      ok: false,
      error:
        channel === "email"
          ? "Enter the 6-to-8 digit verification code from your email."
          : "Enter the 6-digit SMS verification code.",
    };
  }

  if (!/^\d{6,8}$/.test(cleaned)) {
    return {
      ok: false,
      error:
        channel === "email"
          ? "Email verification codes must be 6 to 8 digits."
          : "SMS verification codes must be 6 to 8 digits.",
    };
  }

  return { ok: true, token: cleaned };
}

/**
 * Prevents open redirects (CWE-601) by permitting only same-origin relative paths.
 */
export function sanitizeRedirectPath(
  nextParam: string | null | undefined
): string {
  if (!nextParam || typeof nextParam !== "string") {
    return "/dashboard";
  }
  const trimmed = nextParam.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("://") ||
    /[\r\n\t]/.test(trimmed)
  ) {
    return "/dashboard";
  }
  return trimmed;
}

/**
 * Extracts authorization role strictly from server-controlled app_metadata,
 * never client-editable user_metadata.
 */
export function extractVerifiedRole(
  appMetadata: Record<string, unknown> | null | undefined
): string {
  if (!appMetadata || typeof appMetadata !== "object") {
    return "employee";
  }
  const rawRole = appMetadata.role;
  if (typeof rawRole === "string" && ALLOWED_APP_ROLES.has(rawRole)) {
    return rawRole;
  }
  return "employee";
}

export function mapAuthError(
  err: { message?: string; code?: string; status?: number } | null | undefined
): MappedAuthError {
  const code = (err?.code ?? "").toLowerCase();
  const message = (err?.message ?? "").toLowerCase();
  const status = err?.status ?? 0;

  if (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed")
  ) {
    return {
      code: "unconfirmed_email",
      userMessage:
        "Email verification is pending for this account. Enter your confirmation code below or request a new verification email.",
    };
  }

  if (
    code === "otp_disabled" ||
    message.includes("signups not allowed for otp") ||
    message.includes("user not found")
  ) {
    return {
      code: "unprovisioned",
      userMessage:
        "Account not found in PeopleFlow directory. Self-signup is disabled; add the user in Supabase Auth first, then sign in.",
    };
  }

  if (
    code.includes("sms_send_failed") ||
    code === "phone_provider_disabled" ||
    message.includes("unsupported phone provider") ||
    message.includes("error sending confirmation sms") ||
    message.includes("sms provider")
  ) {
    return {
      code: "sms_provider_unconfigured",
      userMessage:
        "Phone OTP is enabled on peopleflow, but an SMS gateway (for example Twilio) or test OTP number is not yet configured in Supabase Auth -> Providers -> Phone.",
    };
  }

  if (
    status === 429 ||
    code.includes("rate_limit") ||
    message.includes("rate limit") ||
    message.includes("for security purposes, you can only request this after")
  ) {
    return {
      code: "rate_limited",
      userMessage:
        "Too many authentication attempts or code requests. Wait 60 seconds and try again.",
    };
  }

  if (
    code === "otp_expired" ||
    message.includes("token has expired") ||
    message.includes("otp has expired") ||
    message.includes("token is invalid")
  ) {
    return {
      code: "invalid_otp",
      userMessage:
        "Verification code is invalid or expired. Check the digits or request a fresh code.",
    };
  }

  return {
    code: "invalid_credentials",
    userMessage:
      "Invalid credentials or unprovisioned account. Verify your details or use Email / Phone OTP.",
  };
}
