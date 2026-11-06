import { useState } from 'react';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../lib/api.js';
import { useFetch } from '../lib/hooks.js';
import { Badge, EmptyState, ErrorNote, Field, Modal, SkeletonBlock, Table } from './ui.jsx';

/**
 * Generic list + create/edit/delete manager used for offices, forum categories
 * and performance snapshots.
 *
 * fields: [{ name, label, type: text|textarea|number|select|datetime|date|checkbox, options?, required?, hint? }]
 * toForm(item)   -> initial form values (default: copy of item)
 * toPayload(form)-> JSON body to send (default: form)
 */
export default function ResourceManager({
  title,
  endpoint,
  listKey,
  columns,
  fields,
  canDelete = false,
  toForm = (item) => item,
  toPayload = (form) => form,
  emptyText = 'Nothing here yet.',
  defaults = {},
  onChange,
}) {
  const { data, error, loading, reload } = useFetch(endpoint);
  const [editing, setEditing] = useState(null); // null | {item?}
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const items = data?.[listKey] || [];

  const open = (item) => {
    setForm(item ? toForm(item) : { ...defaults });
    setEditing({ item });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = toPayload(form);
      if (editing.item) await api.patch(`${endpoint}/${editing.item.id}`, body);
      else await api.post(endpoint, body);
      toast.success('Saved');
      setEditing(null);
      await reload();
      onChange?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm('Delete this item? This cannot be undone.')) return;
    try {
      await api.del(`${endpoint}/${item.id}`);
      toast.success('Deleted');
      await reload();
      onChange?.();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  return (
    <section className="card" aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold tracking-wide text-gold-soft">{title}</h2>
        <button type="button" className="btn-gold" onClick={() => open(null)}>
          + Add
        </button>
      </div>

      {loading && <SkeletonBlock rows={3} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {!loading && !error && items.length === 0 && <EmptyState>{emptyText}</EmptyState>}
      {!loading && !error && items.length > 0 && (
        <Table>
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => (
                <th key={c.key} className="th">
                  {c.label}
                </th>
              ))}
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-line/60">
                {columns.map((c) => (
                  <td key={c.key} className="td">
                    {c.render ? c.render(item) : String(item[c.key] ?? '—')}
                  </td>
                ))}
                <td className="td whitespace-nowrap text-right">
                  <button type="button" className="btn-ghost px-2 py-1" onClick={() => open(item)}>
                    Edit
                  </button>
                  {canDelete && (
                    <button type="button" className="btn-danger ml-1 px-2 py-1" onClick={() => remove(item)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {editing && (
        <Modal title={`${editing.item ? 'Edit' : 'Add'} — ${title}`} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-4">
            {fields.map((f) => {
              const id = `rm-${f.name}`;
              const value = form[f.name] ?? '';
              let input;
              if (f.type === 'textarea') {
                input = <textarea id={id} className="input min-h-[90px]" required={f.required} value={value} onChange={(e) => set(f.name, e.target.value)} />;
              } else if (f.type === 'select') {
                input = (
                  <select id={id} className="input" required={f.required} value={value} onChange={(e) => set(f.name, e.target.value)}>
                    {!f.required && <option value="">—</option>}
                    {f.options.map((o) => (
                      <option key={o.value ?? o} value={o.value ?? o}>
                        {o.label ?? o}
                      </option>
                    ))}
                  </select>
                );
              } else if (f.type === 'checkbox') {
                input = (
                  <input id={id} type="checkbox" className="h-5 w-5 accent-[rgb(var(--c-gold))]" checked={Boolean(form[f.name])} onChange={(e) => set(f.name, e.target.checked)} />
                );
              } else {
                const htmlType = { datetime: 'datetime-local', date: 'date', number: 'number' }[f.type] || 'text';
                input = (
                  <input id={id} type={htmlType} step={f.type === 'number' ? 'any' : undefined} className="input" required={f.required} value={value} onChange={(e) => set(f.name, e.target.value)} />
                );
              }
              return (
                <Field key={f.name} label={f.label} htmlFor={id} hint={f.hint}>
                  {input}
                </Field>
              );
            })}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-gold" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

export { Badge };
