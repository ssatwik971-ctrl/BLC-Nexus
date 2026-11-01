import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Card, ErrorNote, Field } from '../../components/ui.jsx';
import Logo from '../../components/Logo.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useTitle } from '../../lib/hooks.js';

const Shell = ({ title, children }) => (
  <div className="mx-auto flex max-w-md flex-col items-center px-4 py-10">
    <Logo size="md" />
    <Card className="mt-6 w-full">
      <h1 className="mb-4 font-display text-2xl font-extrabold">{title}</h1>
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
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  useTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email });
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

/** Shared screen for "activate invited account" and "reset password". */
export function SetPassword({ mode }) {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { acceptInvite } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const invite = mode === 'invite';
  useTitle(invite ? 'Activate account' : 'Reset password');

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError({ message: 'Passwords do not match' });
    setBusy(true);
    setError(null);
    try {
      if (invite) {
        await acceptInvite(token, password);
        toast.success('Welcome to BLC!');
        navigate('/app', { replace: true });
      } else {
        await api.post('/auth/reset-password', { token, password });
        toast.success('Password updated. Please sign in.');
        navigate('/login', { replace: true });
      }
    } catch (err) {
      setError({ message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  if (!token) return <Shell title="Link problem"><p className="text-sm text-muted">This link is missing its token. Open the link from your email again.</p></Shell>;

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
