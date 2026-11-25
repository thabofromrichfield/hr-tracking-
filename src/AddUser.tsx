import { type FormEvent, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MailPlus,
  RefreshCw,
  Send,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { validateEmail } from './lib/auth-validation.ts';
import {
  inviteWorkspaceUser,
  listWorkspaceUsers,
  type AuthenticatedUser,
  type WorkspaceUserRecord,
} from './lib/supabase.ts';

function formatInviteState(row: WorkspaceUserRecord): {
  label: string;
  tone: 'active' | 'pending' | 'expired';
} {
  if (row.password_set || row.status === 'active') {
    return { label: 'Active · Password set', tone: 'active' };
  }
  if (row.invite_expires_at) {
    const remainingMs = new Date(row.invite_expires_at).getTime() - Date.now();
    if (remainingMs <= 0) {
      return { label: 'Verification link expired', tone: 'expired' };
    }
    const mins = Math.max(1, Math.ceil(remainingMs / 60000));
    return { label: `Invite sent · ${mins}m left`, tone: 'pending' };
  }
  return { label: 'Invite sent · Pending setup', tone: 'pending' };
}

function formatRoleBadge(role: WorkspaceUserRecord['role']): string {
  switch (role) {
    case 'hr_admin':
      return 'HR administrator';
    case 'manager':
      return 'Manager';
    default:
      return 'HR user';
  }
}

export default function AddUserPage({
  authUser,
  notify,
}: {
  authUser: AuthenticatedUser;
  notify: (message: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<'hr_user' | 'manager' | 'hr_admin'>('hr_user');
  const [sending, setSending] = useState(false);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [users, setUsers] = useState<WorkspaceUserRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  async function refreshUsers() {
    setLoadingList(true);
    try {
      const rows = await listWorkspaceUsers();
      setUsers(rows);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    void refreshUsers();
  }, []);

  async function handleInviteSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const emailErr = validateEmail(email);
    if (emailErr) {
      setErrorMessage(emailErr);
      return;
    }

    setSending(true);
    try {
      const result = await inviteWorkspaceUser({
        email,
        fullName,
        department,
        role,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setSuccessMessage(
        `One-time verification link sent to ${result.user.email} (valid for ${result.expiresInMinutes} minutes).`
      );
      notify(`Verification link sent to ${result.user.email}`);
      setEmail('');
      setFullName('');
      setDepartment('');
      setRole('hr_user');
      await refreshUsers();
    } finally {
      setSending(false);
    }
  }

  async function handleResend(row: WorkspaceUserRecord) {
    setErrorMessage('');
    setSuccessMessage('');
    setResendingEmail(row.email);
    try {
      const result = await inviteWorkspaceUser({
        email: row.email,
        fullName: row.full_name,
        jobTitle: row.job_title,
        department: row.department,
        role: row.role,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      setSuccessMessage(
        `Fresh one-time verification link sent to ${row.email} (valid for ${result.expiresInMinutes} minutes).`
      );
      notify(`Fresh verification link sent to ${row.email}`);
      await refreshUsers();
    } finally {
      setResendingEmail(null);
    }
  }

  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ACCESS &amp; INVITATIONS</div>
          <h1>Add user</h1>
          <p>
            Send a single-use, time-limited verification link so a new user can
            enter the dashboard, edit their details, and set their own password.
          </p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void refreshUsers()}
            disabled={loadingList}
          >
            <RefreshCw size={15} />
            Refresh list
          </button>
        </div>
      </div>

      <div className="invite-grid">
        <section className="card settings-card">
          <div className="card-title">
            <div>
              <h2>
                <UserPlus size={17} style={{ verticalAlign: '-3px', marginRight: 7 }} />
                Invite workspace user
              </h2>
              <p>
                Only invited emails can activate an account. Links work once and
                expire after 60 minutes.
              </p>
            </div>
          </div>

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

          <form className="invite-form" onSubmit={handleInviteSubmit} noValidate>
            <label className="field">
              <span>
                Work email<em>*</em>
              </span>
              <input
                type="email"
                placeholder="colleague@company.co.za"
                value={email}
                onChange={event => setEmail(event.target.value)}
                disabled={sending}
                required
              />
            </label>

            <div className="settings-form">
              <label className="field">
                <span>Initial name (optional)</span>
                <input
                  type="text"
                  placeholder="User can edit on arrival"
                  value={fullName}
                  onChange={event => setFullName(event.target.value)}
                  disabled={sending}
                />
              </label>

              <label className="field">
                <span>Access role</span>
                <select
                  value={role}
                  onChange={event =>
                    setRole(
                      event.target.value as 'hr_user' | 'manager' | 'hr_admin'
                    )
                  }
                  disabled={sending}
                >
                  <option value="hr_user">HR user</option>
                  <option value="manager">Manager</option>
                  <option value="hr_admin">HR administrator</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Department (optional)</span>
              <input
                type="text"
                placeholder="e.g. People & Culture"
                value={department}
                onChange={event => setDepartment(event.target.value)}
                disabled={sending}
              />
            </label>

            <div className="invite-submit-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={sending}
              >
                <Send size={15} />
                {sending ? 'Sending verification link…' : 'Send verification link'}
              </button>
            </div>
          </form>

          <div className="settings-note">
            <ShieldCheck size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Invited by <strong>{authUser.identifier}</strong>. Public sign-up and
            OTP login are disabled — users sign in strictly with email and
            password after completing their one-time link setup.
          </div>
        </section>

        <section className="card settings-card">
          <div className="card-title">
            <div>
              <h2>
                <UsersRound size={17} style={{ verticalAlign: '-3px', marginRight: 7 }} />
                Workspace users ({users.length})
              </h2>
              <p>Active accounts and pending one-time email invitations.</p>
            </div>
          </div>

          {loadingList ? (
            <div className="empty-state">
              <Clock />
              <h3>Loading workspace users…</h3>
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <MailPlus />
              <h3>No invited users yet</h3>
              <p>Send a verification link on the left to add a colleague.</p>
            </div>
          ) : (
            <div className="invite-user-list">
              {users.map(row => {
                const state = formatInviteState(row);
                return (
                  <div key={row.id} className="invite-user-row">
                    <div className="invite-user-main">
                      <strong>{row.full_name || row.email}</strong>
                      <span>
                        {row.email}
                        {row.job_title ? ` · ${row.job_title}` : ''}
                        {row.department ? ` · ${row.department}` : ''}
                      </span>
                      <small>{formatRoleBadge(row.role)}</small>
                    </div>
                    <div className="invite-user-actions">
                      <span className={`invite-pill invite-pill--${state.tone}`}>
                        {state.tone === 'active' ? (
                          <CheckCircle2 size={13} />
                        ) : (
                          <Clock size={13} />
                        )}
                        {state.label}
                      </span>
                      {!row.password_set && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          disabled={resendingEmail === row.email}
                          onClick={() => void handleResend(row)}
                        >
                          {resendingEmail === row.email
                            ? 'Sending…'
                            : 'Resend link'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
