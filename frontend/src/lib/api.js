const BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api`;
const TOKEN_KEY = 'blc-nexus-token';

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(method, path, body) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Cannot reach the BLC Nexus server. Check your connection and try again.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!res.ok) {
    // An expired/invalid session: drop the token and let the app redirect to login.
    if (res.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event('blc-auth-expired'));
    }
    throw new ApiError(res.status, data?.error || res.statusText || 'Request failed', data?.details);
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  patch: (path, body = {}) => request('PATCH', path, body),
  put: (path, body = {}) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
};

/** Download a protected file (needs the auth header, so a plain link will not work). */
export async function downloadFile(path, filename) {
  const token = tokenStore.get();
  const res = await fetch(BASE + path.replace(/^\/api/, ''), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, 'Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Turn an ApiError into a friendly message (includes first field error if present). */
export function errorMessage(err) {
  const field = err?.details?.fieldErrors && Object.entries(err.details.fieldErrors)[0];
  if (field) return `${field[0]}: ${field[1][0]}`;
  return err?.message || 'Something went wrong';
}
