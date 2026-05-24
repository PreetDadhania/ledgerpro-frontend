export const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);

export const fmtDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const txnTotal = (t) =>
  (Number(t.quantity) || 0) * (Number(t.pricePerUnit) || 0) + (Number(t.extraMoney) || 0);

// CSV Export
const csvQ = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
export function exportCSV(customers, transactions, payments) {
  const rows = ['TYPE,ID,FIELD1,FIELD2,FIELD3,FIELD4,FIELD5,FIELD6,FIELD7'];
  customers.forEach((c) => rows.push(`CUSTOMER,${c._id},${csvQ(c.name)},${csvQ(c.mobile)},,,,`));
  transactions.forEach((t) => rows.push(`TRANSACTION,${t._id},${t.customerId},${csvQ(t.itemName)},${t.quantity},${t.pricePerUnit},${t.extraMoney},${csvQ(t.date)},${csvQ(t.note || '')}`));
  payments.forEach((p) => rows.push(`PAYMENT,${p._id},${p.customerId},${csvQ(p.mode)},${p.amount},${csvQ(p.date)},${csvQ(p.note || '')},,`));
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `LedgerPro-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Excel download
export function downloadExcel(customer, txns, pmts) {
  const totalBilled = txns.reduce((s, t) => s + (t.total || txnTotal(t)), 0);
  const totalPaid = pmts.reduce((s, p) => s + p.amount, 0);
  const outstanding = totalBilled - totalPaid;
  let html = `<html><head><meta charset="utf-8"/></head><body>
<h2>${customer.name} — Statement</h2><p>Mobile: ${customer.mobile || 'N/A'}</p>
<h3>Transactions</h3><table border="1" cellpadding="6">
<tr><th>Date</th><th>Item</th><th>Qty</th><th>Price/Unit</th><th>Extra</th><th>Total</th><th>Note</th></tr>`;
  txns.forEach((t) => { html += `<tr><td>${fmtDate(t.date)}</td><td>${t.itemName}</td><td>${t.quantity}</td><td>₹${fmt(t.pricePerUnit)}</td><td>₹${fmt(t.extraMoney)}</td><td>₹${fmt(t.total || txnTotal(t))}</td><td>${t.note || ''}</td></tr>`; });
  html += `</table><h3>Payments</h3><table border="1" cellpadding="6">
<tr><th>Date</th><th>Mode</th><th>Amount</th><th>Note</th></tr>`;
  pmts.forEach((p) => { html += `<tr><td>${fmtDate(p.date)}</td><td>${p.mode}</td><td>₹${fmt(p.amount)}</td><td>${p.note || ''}</td></tr>`; });
  html += `</table><h3>Summary</h3><table border="1" cellpadding="6">
<tr><td><b>Total Billed</b></td><td>₹${fmt(totalBilled)}</td></tr>
<tr><td><b>Total Paid</b></td><td>₹${fmt(totalPaid)}</td></tr>
<tr><td><b>Outstanding</b></td><td>₹${fmt(outstanding)}</td></tr>
</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${customer.name}-statement.xls`; a.click(); URL.revokeObjectURL(a.href);
}

// PDF download
export function downloadPDF(customer, txns, pmts) {
  const totalBilled = txns.reduce((s, t) => s + (t.total || txnTotal(t)), 0);
  const totalPaid = pmts.reduce((s, p) => s + p.amount, 0);
  const outstanding = totalBilled - totalPaid;
  const w = window.open('', '_blank');
  if (!w) { alert('Allow popups for PDF download'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${customer.name}</title>
<style>body{font-family:'Segoe UI',sans-serif;padding:40px;color:#0f172a;max-width:820px;margin:auto}
h1{color:#3b6ef5;border-bottom:3px solid #3b6ef5;padding-bottom:10px}h3{color:#3730a3;margin:22px 0 10px}
.meta{color:#64748b;font-size:13px;margin:3px 0}table{width:100%;border-collapse:collapse;margin:10px 0}
th{background:#3b6ef5;color:#fff;padding:9px 12px;text-align:left;font-size:12px}
td{padding:8px 12px;border-bottom:1px solid #e0e7ff;font-size:13px}tr:nth-child(even) td{background:#f8faff}
.box{background:#f0f4ff;border:1px solid #c7d2fe;border-radius:10px;padding:18px;margin-top:20px}
.due{color:#dc2626;font-weight:800;font-size:18px}
.btn{background:#3b6ef5;color:#fff;border:none;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px;margin-bottom:20px;font-weight:600}
@media print{.btn{display:none}}</style></head><body>
<button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
<h1>Customer Statement</h1>
<p class="meta"><b>Name:</b> ${customer.name}</p>
<p class="meta"><b>Mobile:</b> ${customer.mobile || 'N/A'}</p>
<p class="meta"><b>Generated:</b> ${fmtDate(todayStr())}</p>
<h3>📦 Transactions</h3>
<table><tr><th>Date</th><th>Item</th><th>Qty</th><th>Price/Unit</th><th>Extra</th><th>Total</th><th>Note</th></tr>
${txns.map((t) => `<tr><td>${fmtDate(t.date)}</td><td>${t.itemName}</td><td>${t.quantity}</td><td>₹${fmt(t.pricePerUnit)}</td><td>₹${fmt(t.extraMoney)}</td><td><b>₹${fmt(t.total || txnTotal(t))}</b></td><td>${t.note || '—'}</td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#aaa">No transactions</td></tr>'}
</table>
<h3>💳 Payments</h3>
<table><tr><th>Date</th><th>Mode</th><th>Amount</th><th>Note</th></tr>
${pmts.map((p) => `<tr><td>${fmtDate(p.date)}</td><td>${p.mode}</td><td><b>₹${fmt(p.amount)}</b></td><td>${p.note || '—'}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#aaa">No payments</td></tr>'}
</table>
<div class="box"><p>Total Billed: <b>₹${fmt(totalBilled)}</b></p>
<p>Total Paid: <b>₹${fmt(totalPaid)}</b></p>
<p>Outstanding: <span class="due">₹${fmt(outstanding)}</span></p></div>
</body></html>`);
  w.document.close();
}
