import { type FormEvent, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { validateEmail } from './lib/auth-validation.ts';
import {
  signInWithEmailPassword,
  type AuthenticatedUser,
} from './lib/supabase.ts';

export default function AuthScreen({
  initialError,
  onAuthenticated,
}: {
  initialError?: string;
  onAuthenticated: (user: AuthenticatedUser) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError ?? '');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage('');

    const emailErr = validateEmail(email);
    if (emailErr) {
      setErrorMessage(emailErr);
      return;
    }
    if (!password) {
      setErrorMessage('Enter your password.');
      return;
    }

    setLoading(true);
    try {
      const result = await signInWithEmailPassword(email, password);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      onAuthenticated(result.user);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lock-screen">
      <div className="lock-brand">
        <div className="brand-mark">
          <span />
          <span />
        </div>
        Peopleflow
      </div>

      <div className="lock-card auth-card-wide">
        <div className="lock-icon" aria-hidden="true">
          <LockKeyhole size={24} />
        </div>
        <h1>Sign in to Peopleflow</h1>
        <p>Enter your registered workspace email and password.</p>

        {errorMessage && (
          <div role="alert" aria-live="assertive" className="auth-notice auth-notice--error auth-notice--spaced">
            {errorMessage}
          </div>
        )}

        <form className="auth-form auth-form--direct" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="pf-login-email">
              Work email<em>*</em>
            </label>
            <input
              id="pf-login-email"
              name="email"
              type="email"
              autoFocus
              autoComplete="username"
              placeholder="name@company.co.za"
              value={email}
              onChange={event => setEmail(event.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="pf-login-password">
              Password<em>*</em>
            </label>
            <div className="auth-pw-row">
              <input
                id="pf-login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="btn btn-secondary auth-pw-toggle"
                onClick={() => setShowPassword(prev => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in to workspace'}
          </button>
        </form>

        <small className="auth-security-foot">
          <ShieldCheck size={14} />
          Invite-only access · Reloading signs out automatically
        </small>
      </div>

      <p className="lock-foot">
        New users can only join via a single-use verification link sent from Add user.
      </p>
    </div>
  );
}
