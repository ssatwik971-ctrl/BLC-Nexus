import { Link } from 'react-router-dom';
import { useTitle } from '../../lib/hooks.js';

export default function NotFound() {
  useTitle('Page not found');
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="font-display text-6xl font-extrabold gold-text">404</p>
      <h1 className="mt-4 text-xl font-bold">This page is not in the vault</h1>
      <p className="mt-2 text-sm text-muted">The page you were looking for does not exist or has moved.</p>
      <Link to="/" className="btn-gold mt-6">Back to home</Link>
    </div>
  );
}
