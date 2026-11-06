/** Download rows (array of arrays) as a CSV file. Values are quoted so commas and quotes are safe. */
export function downloadCsv(filename, rows) {
  const cell = (v) => {
    let s = String(v ?? '');
    // Stop spreadsheet apps from running text that starts like a formula.
    if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = rows.map((r) => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
