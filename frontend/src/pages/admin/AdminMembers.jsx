import { useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, ErrorNote, Field, Modal, PageHeader, SkeletonBlock, Table } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDate } from '../../lib/format.js';

export default function AdminMembers() {
  useTitle('Members');
  const { user: me, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const { data, error, loading, reload } = useFetch('/admin/users');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', inGameName: '', role: 'MEMBER' });
  const [busy, setBusy] = useState(false);

  const act = async (fn, ok) => {
    try {
      await fn();
      toast.success(ok);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    await act(async () => {
      await api.post('/admin/users', form);
      setOpen(false);
      setForm({ email: '', inGameName: '', role: 'MEMBER' });
    }, 'Member record created. An email with a signup link was sent.');
    setBusy(false);
  };

  return (
    <>
      <PageHeader
        title="Members"
        subtitle={isAdmin
          ? 'Make members officers and manage access. Approved members get an email with a signup link; Netlify sends the confirmation and password-reset emails.'
          : 'Suspend or remove regular members. Only the admin can make someone an officer or invite new members.'}
        actions={isAdmin && <button type="button" className="btn-gold" onClick={() => setOpen(true)}>Invite member</button>}
      />
      {loading && <SkeletonBlock rows={6} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && (
        <div className="card p-0">
          <Table>
            <thead>
              <tr className="border-b border-line">
                <th className="th" scope="col">Member</th>
                <th className="th" scope="col">Email</th>
                <th className="th" scope="col">Role</th>
                <th className="th" scope="col">Status</th>
                <th className="th" scope="col">Joined</th>
                <th className="th text-right" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => {
                const self = u.id === me.id;
                const isAdminRow = u.role === 'ADMIN';
                // Officers can only manage regular members; nobody can change the admin account.
                const canManage = !self && !isAdminRow && (isAdmin || u.role === 'MEMBER');
                return (
                  <tr key={u.id} className="border-b border-line/60">
                    <td className="td font-semibold">{u.inGameName}{self && <span className="text-gold"> (you)</span>}</td>
                    <td className="td text-muted">{u.email}</td>
                    <td className="td">
                      {isAdmin && !self && !isAdminRow ? (
                        <>
                          <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.inGameName}</label>
                          <select id={`role-${u.id}`} className="input w-auto py-1" value={u.role} onChange={(e) => act(() => api.patch(`/admin/users/${u.id}`, { role: e.target.value }), 'Role updated')}>
                            <option>MEMBER</option><option>OFFICER</option>
                          </select>
                        </>
                      ) : <Badge value={u.role} />}
                    </td>
                    <td className="td"><Badge value={u.status} /></td>
                    <td className="td text-muted">{fmtDate(u.joinedAt)}</td>
                    <td className="td whitespace-nowrap text-right">
                      {canManage && <button type="button" className="btn-ghost px-2 py-1" onClick={() => act(() => api.post(`/admin/users/${u.id}/reset-password`), u.status === 'INVITED' ? 'Signup email sent again.' : 'Ask the member to use “Forgot password?” on the login page.')}>{u.status === 'INVITED' ? 'Resend signup email' : 'Password help'}</button>}
                      {canManage && u.status === 'ACTIVE' && <button type="button" className="btn-outline ml-1 px-2 py-1" onClick={() => act(() => api.patch(`/admin/users/${u.id}`, { status: 'SUSPENDED' }), 'Suspended')}>Suspend</button>}
                      {canManage && u.status === 'SUSPENDED' && <button type="button" className="btn-outline ml-1 px-2 py-1" onClick={() => act(() => api.patch(`/admin/users/${u.id}`, { status: 'ACTIVE' }), 'Reactivated')}>Reactivate</button>}
                      {canManage && <button type="button" className="btn-danger ml-1 px-2 py-1" onClick={() => window.confirm(`Remove ${u.inGameName}? This deletes their account.`) && act(() => api.del(`/admin/users/${u.id}`), 'Member removed')}>Remove</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {open && (
        <Modal title="Invite a member" onClose={() => setOpen(false)}>
          <form onSubmit={invite} className="space-y-4">
            <Field label="Email" htmlFor="iv-email"><input id="iv-email" type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="In-game name" htmlFor="iv-name"><input id="iv-name" className="input" required minLength={2} maxLength={40} value={form.inGameName} onChange={(e) => setForm({ ...form, inGameName: e.target.value })} /></Field>
            <Field label="Role" htmlFor="iv-role">
              <select id="iv-role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option>MEMBER</option><option>OFFICER</option></select>
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-gold" disabled={busy}>{busy ? 'Saving…' : 'Create member'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
