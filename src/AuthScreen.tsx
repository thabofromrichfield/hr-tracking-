import React, { useEffect, useRef, useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { Eye, EyeOff, KeyRound, Mail, Phone, ShieldCheck } from 'lucide-react';
import {
  clearPersistedAuthArtifacts,
  getPeopleflowSupabase,
  toAuthenticatedUser,
  type AuthenticatedUser,
} from './lib/supabase';
import {
  mapAuthError,
  normalizeE164Phone,
  normalizeEmail,
  validateEmail,
  validateOtpToken,
  type EmailOtpKind,
} from './lib/auth-validation';

type AuthTab = 'password' | 'email_otp' | 'phone_otp';
type OtpStep = 'request' | 'verify';

interface StatusNotice {
  tone: 'error' | 'ok' | 'info';
  text: string;
}

const DIAL_CODES = [
  { code: '+27', label: 'ZA +27' },
  { code: '+44', label: 'UK +44' },
  { code: '+1', label: 'US +1' },
  { code: '+234', label: 'NG +234' },
  { code: '+254', label: 'KE +254' },
  { code: '+267', label: 'BW +267' },
  { code: '+263', label: 'ZW +263' },
  { code: '+91', label: 'IN +91' },
  { code: '+61', label: 'AU +61' },
];

const VALID_EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

const TABS: { id: AuthTab; label: string; icon: React.ReactNode }[] = [
  { id: 'password', label: 'Email & Password', icon: <KeyRound size={13} /> },
  { id: 'email_otp', label: 'Email OTP', icon: <Mail size={13} /> },
  { id: 'phone_otp', label: 'Number OTP', icon: <Phone size={13} /> },
];

export default function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: AuthenticatedUser) => void;
}) {
  const [tab, setTab] = useState<AuthTab>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [dialCode, setDialCode] = useState('+27');
  const [phoneInput, setPhoneInput] = useState('');
  const [resolvedE164, setResolvedE164] = useState('');

  const [otpStep, setOtpStep] = useState<OtpStep>('request');
  const [emailOtpKind, setEmailOtpKind] = useState<EmailOtpKind>('email');
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<StatusNotice | null>(null);

  const tabRefs = useRef<Record<AuthTab, HTMLButtonElement | null>>({
    password: null,
    email_otp: null,
    phone_otp: null,
  });

  // Always clear persisted storage/cookies on mount; only process one-time email verification link tokens if present in URL
  useEffect(() => {
    clearPersistedAuthArtifacts();

    let active = true;
    async function handleIncomingVerificationUrl() {
      const searchParams = new URLSearchParams(window.location.search);
      const tokenHash = searchParams.get('token_hash');
      const rawType = searchParams.get('type');
      const hasHashToken = window.location.hash.includes('access_token=');

      if (!tokenHash && !hasHashToken) {
        return;
      }

      setBusy(true);
      try {
        const supabase = getPeopleflowSupabase();

        if (
          tokenHash &&
          rawType &&
          VALID_EMAIL_OTP_TYPES.has(rawType as EmailOtpType)
        ) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: rawType as EmailOtpType,
          });
          window.history.replaceState({}, document.title, window.location.pathname);

          if (error || !data.user) {
            if (active) {
              setNotice({
                tone: 'error',
                text: 'Verification link expired or was already used. Request a new code below.',
              });
            }
            return;
          }

          if (rawType === 'recovery') {
            if (active) {
              setRecoveryMode(true);
              setNotice({
                tone: 'info',
                text: 'Identity verified. Set a new password below to enter Peopleflow.',
              });
            }
            return;
          }

          const verifiedUser = toAuthenticatedUser(data.user);
          if (active && verifiedUser) {
            onAuthenticated(verifiedUser);
          }
          return;
        }

        if (hasHashToken) {
          const hashParams = new URLSearchParams(window.location.hash.slice(1));
          const accessToken = hashParams.get('access_token');
          const hashType = hashParams.get('type');
          window.history.replaceState({}, document.title, window.location.pathname);

          if (accessToken) {
            const { data, error } = await supabase.auth.getUser(accessToken);
            if (!error && data.user) {
              if (hashType === 'recovery') {
                const refreshToken = hashParams.get('refresh_token') ?? '';
                await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                if (active) {
                  setRecoveryMode(true);
                  setNotice({
                    tone: 'info',
                    text: 'Identity verified. Choose a new password below.',
                  });
                }
                return;
              }
              const verifiedUser = toAuthenticatedUser(data.user);
              if (active && verifiedUser) {
                clearPersistedAuthArtifacts();
                onAuthenticated(verifiedUser);
                return;
              }
            }
          }
        }
      } catch {
        if (active) {
          setNotice({
            tone: 'error',
            text: 'Could not verify email link. Sign in or request a code below.',
          });
        }
      } finally {
        if (active) {
          setBusy(false);
        }
      }
    }

    handleIncomingVerificationUrl();
    return () => {
      active = false;
    };
  }, [onAuthenticated]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function selectTab(next: AuthTab) {
    setTab(next);
    setOtpStep('request');
    setOtpCode('');
    setNotice(null);
    if (next === 'email_otp') {
      setEmailOtpKind('email');
    }
  }

  function handleTabKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const idx = TABS.findIndex((item) => item.id === tab);
    let nextIdx = -1;
    if (e.key === 'ArrowRight') {
      nextIdx = (idx + 1) % TABS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (idx - 1 + TABS.length) % TABS.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = TABS.length - 1;
    }
    if (nextIdx >= 0) {
      e.preventDefault();
      const target = TABS[nextIdx].id;
      selectTab(target);
      tabRefs.current[target]?.focus();
    }
  }

  async function verifyAndCompleteSignIn(accessToken: string) {
    const supabase = getPeopleflowSupabase();
    const { data, error } = await supabase.auth.getUser(accessToken);
    clearPersistedAuthArtifacts();

    if (error || !data.user) {
      setNotice({
        tone: 'error',
        text: 'Unable to verify user record in peopleflow. Please try again.',
      });
      setBusy(false);
      return;
    }

    const verifiedUser = toAuthenticatedUser(data.user);
    if (!verifiedUser) {
      setEmail(data.user.email ?? email);
      setTab('email_otp');
      setEmailOtpKind('signup');
      setOtpStep('verify');
      setNotice({
        tone: 'info',
        text: 'Email verification is required before signing in. Enter your confirmation code or resend the email below.',
      });
      setBusy(false);
      return;
    }

    onAuthenticated(verifiedUser);
  }

  async function handlePasswordSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setNotice({ tone: 'error', text: emailError });
      return;
    }
    if (!password) {
      setNotice({ tone: 'error', text: 'Enter your password.' });
      return;
    }

    const cleanEmail = normalizeEmail(email);
    setBusy(true);
    try {
      const supabase = getPeopleflowSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const mapped = mapAuthError(error);
        if (mapped.code === 'unconfirmed_email') {
          setEmail(cleanEmail);
          setTab('email_otp');
          setEmailOtpKind('signup');
          setOtpStep('verify');
          setNotice({ tone: 'info', text: mapped.userMessage });
        } else {
          setNotice({ tone: 'error', text: mapped.userMessage });
        }
        setBusy(false);
        return;
      }

      if (!data.session?.access_token) {
        setNotice({
          tone: 'error',
          text: 'Authentication failed. Confirm your email or retry.',
        });
        setBusy(false);
        return;
      }

      await verifyAndCompleteSignIn(data.session.access_token);
    } catch {
      setNotice({
        tone: 'error',
        text: 'Network error connecting to peopleflow database. Please retry.',
      });
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    setNotice(null);
    const emailError = validateEmail(email);
    if (emailError) {
      setNotice({
        tone: 'error',
        text: 'Enter your registered email address first, then select Reset password.',
      });
      return;
    }

    const cleanEmail = normalizeEmail(email);
    setBusy(true);
    try {
      const supabase = getPeopleflowSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin,
      });
      if (error) {
        setNotice({ tone: 'error', text: mapAuthError(error).userMessage });
      } else {
        setCooldown(60);
        setNotice({
          tone: 'ok',
          text: `If ${cleanEmail} is registered in peopleflow, a password recovery link was sent.`,
        });
      }
    } catch {
      setNotice({
        tone: 'error',
        text: 'Unable to request password recovery right now.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveRecoveredPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    if (newPassword.length < 6) {
      setNotice({
        tone: 'error',
        text: 'Password must be at least 6 characters.',
      });
      return;
    }
    setBusy(true);
    try {
      const supabase = getPeopleflowSupabase();
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      clearPersistedAuthArtifacts();
      if (error || !data.user) {
        setNotice({
          tone: 'error',
          text: error?.message ?? 'Could not update password.',
        });
        setBusy(false);
        return;
      }
      const verified = toAuthenticatedUser(data.user);
      if (verified) {
        onAuthenticated(verified);
      } else {
        setRecoveryMode(false);
        setNotice({
          tone: 'ok',
          text: 'Password updated. Sign in with your email and new password.',
        });
        setBusy(false);
      }
    } catch {
      setNotice({ tone: 'error', text: 'Network error updating password.' });
      setBusy(false);
    }
  }

  async function handleSendEmailCode(e?: React.FormEvent) {
    if (e) {
      e.preventDefault();
    }
    setNotice(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setNotice({ tone: 'error', text: emailError });
      return;
    }

    const cleanEmail = normalizeEmail(email);
    setBusy(true);
    try {
      const supabase = getPeopleflowSupabase();
      const emailRedirectTo = window.location.origin;

      if (emailOtpKind === 'signup') {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: cleanEmail,
          options: { emailRedirectTo },
        });
        if (error) {
          setNotice({ tone: 'error', text: mapAuthError(error).userMessage });
          setBusy(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            shouldCreateUser: false,
            emailRedirectTo,
          },
        });
        if (error) {
          setNotice({ tone: 'error', text: mapAuthError(error).userMessage });
          setBusy(false);
          return;
        }
      }

      setEmail(cleanEmail);
      setOtpStep('verify');
      setCooldown(60);
      setNotice({
        tone: 'ok',
        text: `Verification sent to ${cleanEmail}. Enter the 6-to-8 digit code or click the email link.`,
      });
    } catch {
      setNotice({
        tone: 'error',
        text: 'Network error sending email verification.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyEmailOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setNotice({ tone: 'error', text: emailError });
      return;
    }
    const tokenCheck = validateOtpToken(otpCode, 'email');
    if (!tokenCheck.ok) {
      setNotice({ tone: 'error', text: tokenCheck.error });
      return;
    }

    const cleanEmail = normalizeEmail(email);
    setBusy(true);
    try {
      const supabase = getPeopleflowSupabase();
      const candidateTypes: EmailOtpType[] =
        emailOtpKind === 'signup'
          ? ['signup', 'email', 'invite']
          : ['email', 'signup', 'invite'];

      let sessionToken: string | null = null;
      let lastError: { message?: string; code?: string; status?: number } | null =
        null;

      for (const candidateType of candidateTypes) {
        const res = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: tokenCheck.token,
          type: candidateType,
        });
        if (!res.error && res.data.session?.access_token) {
          sessionToken = res.data.session.access_token;
          break;
        }
        lastError = res.error;
      }

      if (!sessionToken) {
        setNotice({ tone: 'error', text: mapAuthError(lastError).userMessage });
        setBusy(false);
        return;
      }

      await verifyAndCompleteSignIn(sessionToken);
    } catch {
      setNotice({
        tone: 'error',
        text: 'Unable to verify email code right now.',
      });
      setBusy(false);
    }
  }

  async function handleSendPhoneOtp(e?: React.FormEvent) {
    if (e) {
      e.preventDefault();
    }
    setNotice(null);

    const check = normalizeE164Phone(dialCode, phoneInput);
    if (!check.ok) {
      setNotice({ tone: 'error', text: check.error });
      return;
    }

    setBusy(true);
    try {
      const supabase = getPeopleflowSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        phone: check.e164,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        setNotice({ tone: 'error', text: mapAuthError(error).userMessage });
        setBusy(false);
        return;
      }

      setResolvedE164(check.e164);
      setOtpStep('verify');
      setCooldown(60);
      setNotice({
        tone: 'ok',
        text: `SMS code sent to ${check.e164}. Enter the 6-digit code below.`,
      });
    } catch {
      setNotice({
        tone: 'error',
        text: 'Network error sending SMS verification code.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyPhoneOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);

    const targetPhone =
      resolvedE164 ||
      (() => {
        const check = normalizeE164Phone(dialCode, phoneInput);
        return check.ok ? check.e164 : '';
      })();

    if (!targetPhone) {
      setNotice({
        tone: 'error',
        text: 'Enter a valid mobile number (for example, +27 82 123 4567).',
      });
      return;
    }

    const tokenCheck = validateOtpToken(otpCode, 'sms');
    if (!tokenCheck.ok) {
      setNotice({ tone: 'error', text: tokenCheck.error });
      return;
    }

    setBusy(true);
    try {
      const supabase = getPeopleflowSupabase();
      const { data, error } = await supabase.auth.verifyOtp({
        phone: targetPhone,
        token: tokenCheck.token,
        type: 'sms',
      });

      if (error || !data.session?.access_token) {
        setNotice({ tone: 'error', text: mapAuthError(error).userMessage });
        setBusy(false);
        return;
      }

      await verifyAndCompleteSignIn(data.session.access_token);
    } catch {
      setNotice({
        tone: 'error',
        text: 'Unable to verify SMS code right now.',
      });
      setBusy(false);
    }
  }

  return (
    <main className="lock-screen">
      <div className="lock-card auth-card-wide">
        <div className="lock-icon" aria-hidden="true">
          <ShieldCheck size={24} />
        </div>
        <h1>Sign in to Peopleflow</h1>
        <p>
          Authenticate with an existing <strong>peopleflow</strong> database
          account. Sessions do not persist across page reloads.
        </p>

        {!recoveryMode && (
          <div
            className="auth-tablist"
            role="tablist"
            aria-label="Authentication method"
            onKeyDown={handleTabKeyDown}
          >
            {TABS.map((item) => {
              const selected = tab === item.id;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    tabRefs.current[item.id] = el;
                  }}
                  id={`auth-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`auth-panel-${item.id}`}
                  tabIndex={selected ? 0 : -1}
                  className={`auth-tab ${selected ? 'active' : ''}`}
                  onClick={() => selectTab(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {notice && (
          <div
            className={`auth-notice auth-notice--${notice.tone}`}
            role={notice.tone === 'error' ? 'alert' : 'status'}
            aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}
          >
            {notice.text}
          </div>
        )}

        {recoveryMode ? (
          <form className="auth-form" onSubmit={handleSaveRecoveredPassword}>
            <label className="field" htmlFor="recovery-password">
              <span>
                New password<em>*</em>
              </span>
              <input
                id="recovery-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
              />
            </label>
            <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? 'Saving password…' : 'Update password & sign in'}
            </button>
          </form>
        ) : (
          <>
            {/* TAB 1: EMAIL & PASSWORD */}
            {tab === 'password' && (
              <form
                id="auth-panel-password"
                role="tabpanel"
                aria-labelledby="auth-tab-password"
                className="auth-form"
                onSubmit={handlePasswordSignIn}
                noValidate
              >
                <label className="field" htmlFor="login-email">
                  <span>
                    Email address<em>*</em>
                  </span>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
                  />
                </label>

                <div className="field">
                  <div className="auth-label-row">
                    <label htmlFor="login-password">
                      Password<em>*</em>
                    </label>
                    <button
                      type="button"
                      className="text-btn"
                      disabled={busy || cooldown > 0}
                      onClick={handleForgotPassword}
                    >
                      {cooldown > 0 ? `Reset wait (${cooldown}s)` : 'Reset password'}
                    </button>
                  </div>
                  <div className="auth-pw-row">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="btn btn-secondary auth-pw-toggle"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary auth-submit"
                  disabled={busy}
                >
                  {busy ? 'Signing in…' : 'Sign in to HR dashboard'}
                </button>
              </form>
            )}

            {/* TAB 2: EMAIL VERIFICATION / OTP */}
            {tab === 'email_otp' && (
              <div
                id="auth-panel-email_otp"
                role="tabpanel"
                aria-labelledby="auth-tab-email_otp"
              >
                {otpStep === 'request' ? (
                  <form className="auth-form" onSubmit={handleSendEmailCode} noValidate>
                    <label className="field" htmlFor="otp-email">
                      <span>
                        Registered email address<em>*</em>
                      </span>
                      <input
                        id="otp-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your registered email"
                      />
                    </label>

                    <button
                      type="submit"
                      className="btn btn-primary auth-submit"
                      disabled={busy || cooldown > 0}
                    >
                      {busy
                        ? 'Sending verification…'
                        : cooldown > 0
                        ? `Resend in ${cooldown}s`
                        : 'Send email verification code'}
                    </button>

                    <div className="auth-inline-row">
                      <span>Already have a confirmation or OTP code?</span>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => {
                          const err = validateEmail(email);
                          if (err) {
                            setNotice({ tone: 'error', text: err });
                            return;
                          }
                          setEmail(normalizeEmail(email));
                          setOtpStep('verify');
                        }}
                      >
                        Enter code
                      </button>
                    </div>
                  </form>
                ) : (
                  <form className="auth-form" onSubmit={handleVerifyEmailOtp} noValidate>
                    <div className="field">
                      <div className="auth-label-row">
                        <label htmlFor="email-otp-code">
                          Email verification code<em>*</em>
                        </label>
                        <button
                          type="button"
                          className="text-btn"
                          onClick={() => {
                            setOtpStep('request');
                            setOtpCode('');
                          }}
                        >
                          Change email
                        </button>
                      </div>
                      <input
                        id="email-otp-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={8}
                        autoFocus
                        className="auth-otp-input"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="6 to 8 digit code"
                      />
                      <small className="auth-field-help">
                        Sent to <strong>{email}</strong>
                      </small>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary auth-submit"
                      disabled={busy}
                    >
                      {busy ? 'Verifying code…' : 'Verify email & sign in'}
                    </button>

                    <div className="auth-inline-row">
                      <span>Need another code?</span>
                      <button
                        type="button"
                        className="text-btn"
                        disabled={busy || cooldown > 0}
                        onClick={() => handleSendEmailCode()}
                      >
                        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 3: PHONE NUMBER OTP */}
            {tab === 'phone_otp' && (
              <div
                id="auth-panel-phone_otp"
                role="tabpanel"
                aria-labelledby="auth-tab-phone_otp"
              >
                {otpStep === 'request' ? (
                  <form className="auth-form" onSubmit={handleSendPhoneOtp} noValidate>
                    <div className="field">
                      <label htmlFor="phone-number-input">
                        Registered mobile number<em>*</em>
                      </label>
                      <div className="auth-phone-row">
                        <select
                          id="phone-dial-code"
                          aria-label="Country dial code"
                          value={dialCode}
                          onChange={(e) => setDialCode(e.target.value)}
                        >
                          {DIAL_CODES.map((d) => (
                            <option key={d.code} value={d.code}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                        <input
                          id="phone-number-input"
                          type="tel"
                          autoComplete="tel-national"
                          required
                          autoFocus
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          placeholder="082 123 4567"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary auth-submit"
                      disabled={busy || cooldown > 0}
                    >
                      {busy
                        ? 'Sending SMS OTP…'
                        : cooldown > 0
                        ? `Resend in ${cooldown}s`
                        : 'Send number OTP'}
                    </button>

                    <div className="auth-inline-row">
                      <span>Already have an SMS OTP code?</span>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => {
                          const check = normalizeE164Phone(dialCode, phoneInput);
                          if (!check.ok) {
                            setNotice({ tone: 'error', text: check.error });
                            return;
                          }
                          setResolvedE164(check.e164);
                          setOtpStep('verify');
                        }}
                      >
                        Enter code
                      </button>
                    </div>
                  </form>
                ) : (
                  <form className="auth-form" onSubmit={handleVerifyPhoneOtp} noValidate>
                    <div className="field">
                      <div className="auth-label-row">
                        <label htmlFor="sms-otp-code">
                          SMS OTP code<em>*</em>
                        </label>
                        <button
                          type="button"
                          className="text-btn"
                          onClick={() => {
                            setOtpStep('request');
                            setOtpCode('');
                          }}
                        >
                          Change number
                        </button>
                      </div>
                      <input
                        id="sms-otp-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={8}
                        autoFocus
                        className="auth-otp-input"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="6-digit SMS code"
                      />
                      <small className="auth-field-help">
                        Sent to <strong>{resolvedE164}</strong>
                      </small>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary auth-submit"
                      disabled={busy}
                    >
                      {busy ? 'Verifying OTP…' : 'Verify number & sign in'}
                    </button>

                    <div className="auth-inline-row">
                      <span>Did not receive SMS?</span>
                      <button
                        type="button"
                        className="text-btn"
                        disabled={busy || cooldown > 0}
                        onClick={() => handleSendPhoneOtp()}
                      >
                        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend SMS'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </>
        )}

        <small className="auth-security-foot">
          <ShieldCheck size={14} />
          Existing <code>peopleflow</code> directory users only · No session
          cookies stored
        </small>
      </div>
      <p className="lock-foot">
        Employee information is personal. Handle it with care.
      </p>
    </main>
  );
}
