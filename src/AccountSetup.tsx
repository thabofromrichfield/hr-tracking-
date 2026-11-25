import { type FormEvent, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, ShieldCheck, UserCheck } from 'lucide-react';
import { validatePasswordSetup } from './lib/auth-validation.ts';
import {
  saveOwnProfileAndPassword,
  type AuthenticatedUser,
} from './lib/supabase.ts';

export default function AccountSetupPage({
  authUser,
  onUpdated,
  notify,
}: {
  authUser: AuthenticatedUser;
  onUpdated: (user: AuthenticatedUser) => void;
  notify: (message: string) => void;
}) {
  const isInitialOnboarding = authUser.mustSetupPassword;

  const [fullName, setFullName] = useState(
    authUser.displayName === authUser.email ? '' : authUser.displayName
  );
  const [jobTitle, setJobTitle] = useState(authUser.jobTitle);
  const [department, setDepartment] = useState(authUser.department);
  const [phone, setPhone] = useState(authUser.contactPhone);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Enter your full name.');
      return;
    }

    if (isInitialOnboarding || password || confirmPassword) {
      const pwError = validatePasswordSetup(password, confirmPassword);
      if (pwError) {
        setErrorMessage(pwError);
        return;
      }
    }

    setSaving(true);
    try {
      const result = await saveOwnProfileAndPassword({
        fullName,
        jobTitle,
        department,
        phone,
        newPassword: password || undefined,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setPassword('');
      setConfirmPassword('');
      onUpdated(result.user);
      const msg = isInitialOnboarding
        ? 'Account activated — your details and password are saved.'
        : 'Account details updated.';
      setSuccessMessage(msg);
      notify(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {isInitialOnboarding ? 'ONE-TIME INVITE VERIFIED' : 'MY ACCOUNT'}
          </div>
          <h1>
            {isInitialOnboarding
              ? 'Complete your profile & set password'
              : 'My profile & password'}
          </h1>
          <p>
            {isInitialOnboarding
              ? 'Your single-use verification link has been verified. Edit your details and create your password below to finish activating your workspace login.'
              : 'Update your personal workspace details or change your sign-in password.'}
          </p>
        </div>
      </div>

      <section className="card settings-card account-setup-card">
        {isInitialOnboarding && (
          <div className="privacy-hero" style={{ marginBottom: 20 }}>
            <ShieldCheck size={24} />
            <div>
              <h3>One-time verification link used</h3>
              <p>
                This link cannot be used again. Set your password below before
                refreshing or leaving the page so you can sign in with{' '}
                <strong>{authUser.identifier}</strong> and your password.
              </p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="auth-notice auth-notice--error">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div role="status" className="auth-notice auth-notice--ok">
            {successMessage}
          </div>
        )}

        <form className="invite-form" onSubmit={handleSubmit} noValidate>
          <div className="settings-form">
            <label className="field">
              <span>Verified email</span>
              <input type="email" value={authUser.email ?? ''} disabled />
            </label>

            <label className="field">
              <span>Access role</span>
              <input type="text" value={authUser.roleLabel} disabled />
            </label>

            <label className="field">
              <span>
                Full name<em>*</em>
              </span>
              <input
                type="text"
                placeholder="e.g. Lerato Molefe"
                value={fullName}
                onChange={event => setFullName(event.target.value)}
                disabled={saving}
                required
              />
            </label>

            <label className="field">
              <span>Job title</span>
              <input
                type="text"
                placeholder="e.g. HR Generalist"
                value={jobTitle}
                onChange={event => setJobTitle(event.target.value)}
                disabled={saving}
              />
            </label>

            <label className="field">
              <span>Department</span>
              <input
                type="text"
                placeholder="e.g. People Operations"
                value={department}
                onChange={event => setDepartment(event.target.value)}
                disabled={saving}
              />
            </label>

            <label className="field">
              <span>Contact phone</span>
              <input
                type="tel"
                placeholder="e.g. +27 82 000 0000"
                value={phone}
                onChange={event => setPhone(event.target.value)}
                disabled={saving}
              />
            </label>
          </div>

          <div className="account-pw-section">
            <h3>
              <KeyRound size={16} />
              {isInitialOnboarding
                ? 'Create your sign-in password'
                : 'Change password (optional)'}
            </h3>
            <p>
              Minimum 8 characters with at least one letter and one number.
            </p>

            <div className="settings-form">
              <label className="field">
                <span>
                  {isInitialOnboarding ? 'New password' : 'New password'}
                  {isInitialOnboarding && <em>*</em>}
                </span>
                <div className="auth-pw-row">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    disabled={saving}
                    required={isInitialOnboarding}
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
              </label>

              <label className="field">
                <span>
                  Confirm password{isInitialOnboarding && <em>*</em>}
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  disabled={saving}
                  required={isInitialOnboarding}
                />
              </label>
            </div>
          </div>

          <div className="invite-submit-row">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {isInitialOnboarding ? <UserCheck size={16} /> : <Check size={16} />}
              {saving
                ? 'Saving…'
                : isInitialOnboarding
                ? 'Save details & set password'
                : 'Save changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
