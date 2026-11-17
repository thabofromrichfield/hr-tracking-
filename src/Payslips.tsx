import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Banknote, Download, Eye, FileText, Pencil, Plus, Printer, Receipt, Trash2 } from 'lucide-react';
import { Avatar, Modal, formatDate } from './components';
import { Branch, Employee, Payslip } from './types';
import { UIF_MONTHLY_CAP, downloadFile, monthKey, monthLabel, toCsv, uifContribution, zar } from './time';

const round = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
const lastDayOf = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month, 0).toISOString().slice(0, 10);
};

export default function Payslips({ employees, branches, payslips, onGenerate, onUpdate, onDelete, notify }: {
  employees: Employee[]; branches: Branch[]; payslips: Payslip[];
  onGenerate: (slips: Payslip[]) => void; onUpdate: (slip: Payslip) => void; onDelete: (id: string) => void; notify: (message: string) => void;
}) {
  const [period, setPeriod] = useState(() => monthKey());
  const [branchId, setBranchId] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [viewing, setViewing] = useState<Payslip>();
  const [editing, setEditing] = useState<Payslip>();
  const monthSlips = payslips.filter(slip => slip.period === period && (branchId === 'all' || employees.find(employee => employee.id === slip.employeeId)?.branchId === branchId));
  const totals = useMemo(() => ({
    gross: monthSlips.reduce((sum, slip) => sum + slip.gross, 0),
    deductions: monthSlips.reduce((sum, slip) => sum + slip.paye + slip.uifEmployee + slip.deductions, 0),
    net: monthSlips.reduce((sum, slip) => sum + slip.net, 0),
    uif: monthSlips.reduce((sum, slip) => sum + slip.uifEmployee + slip.uifEmployer, 0),
  }), [monthSlips]);

  const exportCsv = () => {
    if (!monthSlips.length) { notify('No payslips to export for this period'); return; }
    const headers = ['Employee', 'Employee number', 'Branch', 'Period', 'Pay date', 'Gross', 'PAYE', 'UIF employee', 'UIF employer', 'Other deductions', 'Net pay'];
    const rows = monthSlips.map(slip => {
      const employee = employees.find(person => person.id === slip.employeeId);
      return [employee?.fullName || '', employee?.employeeNumber || '', branches.find(branch => branch.id === employee?.branchId)?.name || '', slip.period, slip.payDate, slip.gross.toFixed(2), slip.paye.toFixed(2), slip.uifEmployee.toFixed(2), slip.uifEmployer.toFixed(2), slip.deductions.toFixed(2), slip.net.toFixed(2)];
    });
    downloadFile(new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }), `peopleflow-payslips-${period}.csv`);
    notify(`${monthSlips.length} payslips exported`);
  };

  return <div className="payslips-page">
    <div className="page-heading"><div><div className="eyebrow">PAYROLL</div><h1>Payslips</h1><p>Generate monthly payslips with optional UIF, then review or print them.</p></div><div className="heading-actions"><button className="btn btn-secondary" onClick={exportCsv}><Download size={16} />Export CSV</button><button className="btn btn-primary" onClick={() => setGenerating(true)}><Plus size={16} />Generate payslips</button></div></div>

    <div className="hr-stats">
      <div><span className="hr-stat-icon"><Receipt size={18} /></span><div><small>Payslips this period</small><strong>{monthSlips.length}</strong></div></div>
      <div><span className="hr-stat-icon"><Banknote size={18} /></span><div><small>Gross payroll</small><strong>{zar(totals.gross)}</strong></div></div>
      <div><span className="hr-stat-icon amber"><Banknote size={18} /></span><div><small>Deductions</small><strong>{zar(totals.deductions)}</strong></div></div>
      <div><span className="hr-stat-icon green"><Banknote size={18} /></span><div><small>Net payroll</small><strong>{zar(totals.net)}</strong></div></div>
    </div>

    <section className="card directory-card">
      <div className="directory-toolbar week-toolbar"><div className="week-nav"><label className="sort-select"><span>Pay period</span><input type="month" value={period} onChange={event => setPeriod(event.target.value || monthKey())} /></label><strong>{monthLabel(period)}</strong></div><label className="sort-select"><span>Branch</span><select value={branchId} onChange={event => setBranchId(event.target.value)}><option value="all">All branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></div>
      <div className="table-scroll"><table className="employee-table payslip-table"><thead><tr><th>Employee</th><th>Gross</th><th>PAYE</th><th>UIF (employee)</th><th>Other</th><th>Net pay</th><th /></tr></thead>
        <tbody>{monthSlips.map(slip => {
          const employee = employees.find(person => person.id === slip.employeeId);
          if (!employee) return null;
          return <tr key={slip.id}><td><div className="person-cell"><Avatar employee={employee} /><div><strong>{employee.fullName}</strong><span>{branches.find(branch => branch.id === employee.branchId)?.name || 'No branch'} · {employee.employeeNumber}</span></div></div></td><td>{zar(slip.gross)}</td><td>{zar(slip.paye)}</td><td>{slip.includeUif ? zar(slip.uifEmployee) : <span className="muted-text">No UIF</span>}</td><td>{zar(slip.deductions)}</td><td><strong>{zar(slip.net)}</strong></td><td><div className="row-actions"><button className="icon-btn" title="View payslip" onClick={() => setViewing(slip)}><Eye size={16} /></button><button className="icon-btn" title="Edit payslip" onClick={() => setEditing(slip)}><Pencil size={15} /></button><button className="icon-btn delete-btn" title="Delete payslip" onClick={() => { if (confirm('Delete this payslip?')) onDelete(slip.id); }}><Trash2 size={15} /></button></div></td></tr>;
        })}</tbody></table>{!monthSlips.length && <div className="empty-table"><Receipt size={28} /><h3>No payslips for {monthLabel(period)}</h3><p>Generate payslips from each employee's monthly salary. Add salaries on the employee form first.</p><button className="btn btn-primary btn-small" onClick={() => setGenerating(true)}>Generate payslips</button></div>}</div>
      <div className="table-footer"><span>{monthSlips.length} payslip{monthSlips.length === 1 ? '' : 's'} · UIF {zar(totals.uif)} (employee + employer)</span><span>PAYE is entered manually — check it against SARS tables</span></div>
    </section>

    {generating && <GenerateModal employees={employees} branches={branches} payslips={payslips} period={period} branchId={branchId} onClose={() => setGenerating(false)} onGenerate={slips => { onGenerate(slips); setGenerating(false); }} />}
    {editing && <EditModal slip={editing} employee={employees.find(person => person.id === editing.employeeId)} onClose={() => setEditing(undefined)} onSave={slip => { onUpdate(slip); setEditing(undefined); notify('Payslip updated'); }} />}
    {viewing && <PayslipModal slip={viewing} employee={employees.find(person => person.id === viewing.employeeId)} branch={branches.find(branch => branch.id === employees.find(person => person.id === viewing.employeeId)?.branchId)} onClose={() => setViewing(undefined)} />}
  </div>;
}

function GenerateModal({ employees, branches, payslips, period, branchId, onClose, onGenerate }: {
  employees: Employee[]; branches: Branch[]; payslips: Payslip[]; period: string; branchId: string;
  onClose: () => void; onGenerate: (slips: Payslip[]) => void;
}) {
  const [payPeriod, setPayPeriod] = useState(period);
  const [payDate, setPayDate] = useState(lastDayOf(period));
  const [includeUif, setIncludeUif] = useState(true);
  const [payePercent, setPayePercent] = useState(0);
  const eligible = employees.filter(employee => (employee.status === 'Active' || employee.status === 'On leave') && Number(employee.monthlySalary) > 0 && (branchId === 'all' || employee.branchId === branchId));
  const existing = new Set(payslips.filter(slip => slip.period === payPeriod).map(slip => slip.employeeId));
  const pending = eligible.filter(employee => !existing.has(employee.id));
  const estimated = pending.reduce((sum, employee) => sum + Number(employee.monthlySalary || 0), 0);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const slips: Payslip[] = pending.map(employee => {
      const gross = round(Number(employee.monthlySalary));
      const uifEmployee = includeUif ? uifContribution(gross) : 0;
      const paye = round(gross * (Number(payePercent) / 100));
      return {
        id: crypto.randomUUID(), employeeId: employee.id, period: payPeriod, payDate: payDate || lastDayOf(payPeriod),
        gross, overtime: 0, allowances: 0, deductions: 0, paye, uifEmployee,
        uifEmployer: includeUif ? uifContribution(gross) : 0, includeUif,
        net: round(gross - paye - uifEmployee), notes: '', createdAt: new Date().toISOString(),
      };
    });
    onGenerate(slips);
  };

  return <Modal title="Generate payslips" subtitle="Created from each employee's monthly salary, one payslip per person" onClose={onClose}>
    <form onSubmit={submit}><div className="modal-body"><div className="form-grid">
      <label className="field"><span>Pay period</span><input type="month" value={payPeriod} onChange={event => { setPayPeriod(event.target.value || monthKey()); setPayDate(lastDayOf(event.target.value || monthKey())); }} /></label>
      <label className="field"><span>Pay date</span><input type="date" value={payDate} onChange={event => setPayDate(event.target.value)} /></label>
      <label className="field"><span>PAYE % of gross (optional)</span><input type="number" min={0} max={45} step={0.1} value={payePercent} onChange={event => setPayePercent(Number(event.target.value))} /></label>
      <div className="field"><span>UIF</span><label className="toggle-row"><input type="checkbox" checked={includeUif} onChange={event => setIncludeUif(event.target.checked)} /><span>Include UIF (1% employee + 1% employer, capped at {zar(UIF_MONTHLY_CAP)} each)</span></label></div>
    </div>
      <div className="generate-summary"><div><span>Employees with a salary</span><strong>{eligible.length}</strong></div><div><span>Already have a payslip</span><strong>{eligible.length - pending.length}</strong></div><div><span>Will be generated</span><strong>{pending.length}</strong></div><div><span>Estimated gross</span><strong>{zar(estimated)}</strong></div></div>
      {pending.length > 0 && <div className="generate-list">{pending.slice(0, 6).map(employee => <div key={employee.id}><Avatar employee={employee} size="sm" /><span>{employee.fullName}</span><strong>{zar(Number(employee.monthlySalary || 0))}</strong></div>)}{pending.length > 6 && <p className="muted-text">and {pending.length - 6} more</p>}</div>}
      {!eligible.length && <p className="import-warning">No employees have a monthly salary yet. Open an employee, choose Edit profile, and add their monthly salary.</p>}
      {!pending.length && eligible.length > 0 && <p className="import-warning">Every employee in this scope already has a payslip for {monthLabel(payPeriod)}.</p>}
      <p className="import-meta">PAYE is not calculated automatically. Enter a percentage here or adjust each payslip afterwards. UIF uses the 1% employee and employer contribution with the monthly ceiling.</p>
    </div>
      <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!pending.length}><FileText size={16} />Generate {pending.length || ''} payslip{pending.length === 1 ? '' : 's'}</button></div></form>
  </Modal>;
}

function EditModal({ slip, employee, onClose, onSave }: { slip: Payslip; employee?: Employee; onClose: () => void; onSave: (slip: Payslip) => void }) {
  const base = round(slip.gross - slip.overtime - slip.allowances);
  const [form, setForm] = useState({ basic: base, overtime: slip.overtime, allowances: slip.allowances, deductions: slip.deductions, paye: slip.paye, includeUif: slip.includeUif, payDate: slip.payDate, notes: slip.notes || '' });
  const gross = round(Number(form.basic) + Number(form.overtime) + Number(form.allowances));
  const uifEmployee = form.includeUif ? uifContribution(gross) : 0;
  const net = round(gross - Number(form.paye) - Number(form.deductions) - uifEmployee);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({ ...slip, gross, overtime: round(Number(form.overtime)), allowances: round(Number(form.allowances)), deductions: round(Number(form.deductions)), paye: round(Number(form.paye)), includeUif: form.includeUif, uifEmployee, uifEmployer: form.includeUif ? uifContribution(gross) : 0, net, payDate: form.payDate, notes: form.notes });
  };
  return <Modal title={`Edit payslip · ${employee?.fullName || 'Employee'}`} subtitle={monthLabel(slip.period)} onClose={onClose}>
    <form onSubmit={submit}><div className="modal-body"><div className="form-grid">
      <label className="field"><span>Basic salary</span><input type="number" min={0} step={0.01} value={form.basic} onChange={event => setForm({ ...form, basic: Number(event.target.value) })} /></label>
      <label className="field"><span>Overtime</span><input type="number" min={0} step={0.01} value={form.overtime} onChange={event => setForm({ ...form, overtime: Number(event.target.value) })} /></label>
      <label className="field"><span>Allowances</span><input type="number" min={0} step={0.01} value={form.allowances} onChange={event => setForm({ ...form, allowances: Number(event.target.value) })} /></label>
      <label className="field"><span>Other deductions</span><input type="number" min={0} step={0.01} value={form.deductions} onChange={event => setForm({ ...form, deductions: Number(event.target.value) })} /></label>
      <label className="field"><span>PAYE</span><input type="number" min={0} step={0.01} value={form.paye} onChange={event => setForm({ ...form, paye: Number(event.target.value) })} /></label>
      <label className="field"><span>Pay date</span><input type="date" value={form.payDate} onChange={event => setForm({ ...form, payDate: event.target.value })} /></label>
      <div className="field field-full"><span>UIF</span><label className="toggle-row"><input type="checkbox" checked={form.includeUif} onChange={event => setForm({ ...form, includeUif: event.target.checked })} /><span>Include UIF at 1% of gross (capped at {zar(UIF_MONTHLY_CAP)})</span></label></div>
      <label className="field field-full"><span>Notes</span><textarea rows={2} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label>
    </div>
      <div className="payslip-totals"><div><span>Gross</span><strong>{zar(gross)}</strong></div><div><span>UIF</span><strong>{zar(uifEmployee)}</strong></div><div><span>Net pay</span><strong>{zar(net)}</strong></div></div>
    </div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary">Save payslip</button></div></form>
  </Modal>;
}

function PayslipModal({ slip, employee, branch, onClose }: { slip: Payslip; employee?: Employee; branch?: Branch; onClose: () => void }) {
  useEffect(() => { document.body.classList.add('payslip-open'); return () => document.body.classList.remove('payslip-open'); }, []);
  if (!employee) return null;
  const basic = round(slip.gross - slip.overtime - slip.allowances);
  return <Modal title="Payslip" subtitle={`${monthLabel(slip.period)} · ${employee.fullName}`} onClose={onClose} wide>
    <div className="modal-body payslip-body">
      <div className="payslip-sheet">
        <div className="payslip-head"><div><div className="payslip-brand">Peopleflow HR</div><h2>Payslip</h2><p>{monthLabel(slip.period)} · Paid {formatDate(slip.payDate, true)}</p></div><div className="payslip-doc"><span>Employee number</span><strong>{employee.employeeNumber || '—'}</strong><span>Branch</span><strong>{branch?.name || 'Unassigned'}</strong></div></div>
        <div className="payslip-person"><div><span>Employee</span><strong>{employee.fullName}</strong></div><div><span>Job title</span><strong>{employee.jobTitle || '—'}</strong></div><div><span>ID number</span><strong>•••••••{employee.idNumber.slice(-4) || '——'}</strong></div><div><span>Department</span><strong>{employee.department || '—'}</strong></div></div>
        <div className="payslip-columns">
          <div><h3>Earnings</h3><div><span>Basic salary</span><strong>{zar(basic)}</strong></div><div><span>Overtime</span><strong>{zar(slip.overtime)}</strong></div><div><span>Allowances</span><strong>{zar(slip.allowances)}</strong></div><div className="payslip-row-total"><span>Gross pay</span><strong>{zar(slip.gross)}</strong></div></div>
          <div><h3>Deductions</h3><div><span>PAYE</span><strong>{zar(slip.paye)}</strong></div><div><span>UIF (employee)</span><strong>{slip.includeUif ? zar(slip.uifEmployee) : '—'}</strong></div><div><span>Other deductions</span><strong>{zar(slip.deductions)}</strong></div><div className="payslip-row-total"><span>Total deductions</span><strong>{zar(round(slip.paye + slip.uifEmployee + slip.deductions))}</strong></div></div>
        </div>
        <div className="payslip-net"><div><span>Net pay</span><small>Employee UIF {slip.includeUif ? zar(slip.uifEmployee) : 'R 0,00'} · Employer UIF {slip.includeUif ? zar(slip.uifEmployer) : 'R 0,00'}</small></div><strong>{zar(slip.net)}</strong></div>
        {slip.notes && <p className="payslip-notes">{slip.notes}</p>}
        <p className="payslip-footnote">This payslip is generated from workspace records. PAYE is captured manually — confirm it against SARS tables before paying. UIF uses 1% employee and 1% employer contributions, capped at {zar(UIF_MONTHLY_CAP)} per month each.</p>
      </div>
    </div>
    <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} />Print payslip</button></div>
  </Modal>;
}
