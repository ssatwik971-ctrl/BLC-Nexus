import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Card, ErrorNote, Field } from '../../components/ui.jsx';
import Logo from '../../components/Logo.jsx';
import { errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useTitle } from '../../lib/hooks.js';

const Shell = ({ title, children }) => (
  <div className="mx-auto flex max-w-md flex-col items-center px-4 py-10">
    <Logo size="md" />
    <Card className="animate-fade-up mt-6 w-full !p-6 shadow-gold sm:!p-8">
      <h1 className="mb-1 font-display text-2xl font-bold tracking-wide gold-text">{title}</h1>
      <div className="gold-rule mb-5 max-w-[9rem]" aria-hidden="true"><span /></div>
      {children}
    </Card>
  </div>
);

export function Login() {
  useTitle('Member login');
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(location.state?.from || '/app', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Member login">
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote error={{ message: errorMessage(error) }} />}
        <Field label="Email" htmlFor="l-email"><input id="l-email" type="email" autoComplete="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" htmlFor="l-pw"><input id="l-pw" type="password" autoComplete="current-password" className="input" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <div className="flex justify-between text-sm">
          <Link to="/forgot-password" className="text-gold underline">Forgot password?</Link>
          <Link to="/apply" className="text-muted hover:text-gold">Not a member? Apply</Link>
        </div>
        <p className="border-t border-line pt-3 text-center text-xs text-muted">
          BLC admin? <Link to="/admin-login" className="text-gold underline">Sign in with your PIN</Link>
        </p>
      </form>
    </Shell>
  );
}

/** The admin signs in with the ADMIN_EMAIL and ADMIN_PIN set in the Netlify environment variables. */
export function AdminLogin() {
  useTitle('Admin sign-in');
  const { user, adminLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminLogin(email, pin);
      navigate('/app', { replace: true });
    } catch (err) {
      setPin('');
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Admin sign-in">
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote error={{ message: errorMessage(error) }} />}
        <Field label="Admin email" htmlFor="a-email"><input id="a-email" type="email" autoComplete="username" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="PIN" htmlFor="a-pin" hint="The ADMIN_PIN you set in the site's environment variables."><input id="a-pin" type="password" autoComplete="current-password" className="input" required value={pin} onChange={(e) => setPin(e.target.value)} /></Field>
        <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? 'Unlocking…' : 'Unlock admin account'}</button>
        <p className="text-center text-sm"><Link to="/login" className="text-muted hover:text-gold">Member login</Link></p>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  useTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { requestPasswordRecovery } = useAuth();
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await requestPasswordRecovery(email);
      setSent(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Forgot password">
      {sent ? (
        <p className="text-sm text-muted">If an account exists for that email, a reset link is on its way. It expires in 1 hour.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" htmlFor="f-email"><input id="f-email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </Shell>
  );
}

/** Netlify Identity invitation acceptance and password recovery screen. */
export function SetPassword({ mode }) {
  const { acceptInvite, finishRecovery } = useAuth();
  const [params] = useSearchParams();
  const inviteToken = params.get('token') || '';
  const recoveryReady = params.get('recovery') === '1';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const invite = mode === 'invite';
  const ready = invite ? Boolean(inviteToken) : recoveryReady;
  useTitle(invite ? 'Activate account' : 'Reset password');

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 10) return setError({ message: 'Use at least 10 characters.' });
    if (password !== confirm) return setError({ message: 'Passwords do not match.' });
    setBusy(true);
    setError(null);
    try {
      if (invite) await acceptInvite(inviteToken, password);
      else await finishRecovery(password);
      toast.success(invite ? 'Welcome to BLC Nexus!' : 'Password updated.');
      navigate(invite ? '/app' : '/login', { replace: true });
    } catch (err) {
      setError({ message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <Shell title="Link problem"><p className="text-sm text-muted">Open the latest Netlify Identity invitation or password-recovery email link again. The link must be processed on this site.</p></Shell>;

  return (
    <Shell title={invite ? 'Activate your account' : 'Choose a new password'}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote error={error} />}
        <Field label="New password" htmlFor="p-new" hint="At least 10 characters."><input id="p-new" type="password" autoComplete="new-password" minLength={10} className="input" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Confirm password" htmlFor="p-conf"><input id="p-conf" type="password" autoComplete="new-password" minLength={10} className="input" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? 'Saving…' : invite ? 'Activate account' : 'Update password'}</button>
      </form>
    </Shell>
  );
}
