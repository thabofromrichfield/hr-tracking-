export type VerificationChannel = "email" | "sms";

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

export type ParsedInviteCallback =
  | { kind: "none" }
  | { kind: "expired"; message: string }
  | { kind: "rejected"; message: string }
  | { kind: "invite_session"; accessToken: string; refreshToken: string }
  | { kind: "invite_token_hash"; tokenHash: string };

const ALLOWED_APP_ROLES = new Set([
  "super_admin",
  "hr_admin",
  "hr_user",
  "manager",
  "employee",
]);

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateEmail(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (!email) {
    return "Enter a work email address.";
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailPattern.test(email) || email.length > 254) {
    return "Enter a valid email address (for example, name@company.co.za).";
  }
  return null;
}

export function validatePasswordSetup(
  password: string,
  confirmPassword: string
): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 128) {
    return "Password must be 128 characters or fewer.";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}

/**
 * Parses URL hash and query parameters strictly for single-use workspace
 * invitation callbacks (`type=invite`). All other callback types (`magiclink`,
 * `recovery`, `signup`, OAuth) are rejected so login is restricted exclusively
 * to Email + Password or a one-time invitation link.
 */
export function parseInviteUrlParams(
  rawHash: string,
  rawSearch: string
): ParsedInviteCallback {
  const cleanHash = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
  const cleanSearch = rawSearch.startsWith("?")
    ? rawSearch.slice(1)
    : rawSearch;

  const hashParams = new URLSearchParams(cleanHash);
  const searchParams = new URLSearchParams(cleanSearch);

  const errorCode =
    hashParams.get("error_code") ||
    searchParams.get("error_code") ||
    hashParams.get("error") ||
    searchParams.get("error");

  if (errorCode) {
    return {
      kind: "expired",
      message:
        "This verification link has already been used or has expired. Ask an administrator to send a new invite from Add user.",
    };
  }

  const hashAccessToken = hashParams.get("access_token");
  const hashRefreshToken = hashParams.get("refresh_token");
  const hashType = hashParams.get("type");

  if (hashAccessToken || hashType) {
    if (hashType !== "invite" || !hashAccessToken || !hashRefreshToken) {
      return {
        kind: "rejected",
        message:
          "Only one-time workspace invitation links are permitted. Sign in with your email and password.",
      };
    }
    return {
      kind: "invite_session",
      accessToken: hashAccessToken,
      refreshToken: hashRefreshToken,
    };
  }

  const queryTokenHash = searchParams.get("token_hash");
  const queryType = searchParams.get("type");
  const queryCode = searchParams.get("code");

  if (queryTokenHash || queryType || queryCode) {
    if (queryType === "invite" && queryTokenHash) {
      return {
        kind: "invite_token_hash",
        tokenHash: queryTokenHash,
      };
    }
    return {
      kind: "rejected",
      message:
        "Only one-time workspace invitation links are permitted. Sign in with your email and password.",
    };
  }

  return { kind: "none" };
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
    const cleanDial = "+" + countryDialCode.replace(/[^\d]/g, "");
    let nationalDigits = trimmed.replace(/[\s()-]/g, "");
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
  if (!cleaned || !/^\d{6,8}$/.test(cleaned)) {
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
        "Email verification is pending. Open the one-time verification link sent to your email to finish activating your account.",
    };
  }

  if (
    code === "otp_disabled" ||
    message.includes("signups not allowed") ||
    message.includes("user not found")
  ) {
    return {
      code: "unprovisioned",
      userMessage:
        "Account not found in Peopleflow. An administrator must invite your email from Add user.",
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
      userMessage: "Phone login is disabled on this workspace.",
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
        "Too many sign-in attempts. Wait 60 seconds and try again.",
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
        "This verification link is invalid or has expired. Ask an administrator to send a new invite.",
    };
  }

  return {
    code: "invalid_credentials",
    userMessage:
      "Incorrect email or password, or your invitation has not been completed yet.",
  };
}
