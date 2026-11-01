import { useEffect, useRef } from 'react';
import { titleCase } from '../lib/format.js';

export const Card = ({ className = '', children, ...rest }) => (
  <div className={`card ${className}`} {...rest}>
    {children}
  </div>
);

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const Skeleton = ({ className = 'h-5 w-full' }) => (
  <div className={`animate-pulse rounded bg-raised ${className}`} aria-hidden="true" />
);

export function SkeletonBlock({ rows = 4 }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`h-5 ${i % 2 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export const ErrorNote = ({ error, retry }) => (
  <div role="alert" className="rounded-lg border border-danger/50 bg-danger/10 p-4 text-sm text-danger">
    {error?.message || 'Something went wrong.'}{' '}
    {retry && (
      <button type="button" className="underline" onClick={retry}>
        Try again
      </button>
    )}
  </div>
);

export const EmptyState = ({ children }) => (
  <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">{children}</div>
);

const TONES = {
  gold: 'border-gold/50 text-gold',
  ok: 'border-ok/50 text-ok',
  danger: 'border-danger/50 text-danger',
  muted: 'border-line text-muted',
};
const STATUS_TONE = {
  PAID: 'ok', FULFILLED: 'ok', APPROVED: 'ok', ACTIVE: 'ok', GOING: 'ok', OPEN: 'ok', CLAIMED: 'ok', AVAILABLE: 'ok',
  UNPAID: 'gold', PENDING: 'gold', WAITLISTED: 'gold', INVITED: 'gold', MAYBE: 'gold', PURCHASED: 'gold', OFFICER: 'gold', ADMIN: 'gold',
  LATE: 'danger', REJECTED: 'danger', SUSPENDED: 'danger', CANCELLED: 'danger', NOT_GOING: 'danger',
};

export const Badge = ({ value, tone }) => (
  <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${TONES[tone || STATUS_TONE[value] || 'muted']}`}>
    {titleCase(value)}
  </span>
);

export function Field({ label, htmlFor, hint, children }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('input,select,textarea,button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="card my-8 w-full max-w-lg shadow-gold">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button type="button" className="btn-ghost px-2 py-1" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Table = ({ children }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[480px] border-collapse">{children}</table>
  </div>
);
