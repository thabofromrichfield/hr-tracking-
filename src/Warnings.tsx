import { FormEvent, useMemo, useState } from 'react';
import { AlertTriangle, Check, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { Avatar, Modal, formatDate } from './components';
import { Branch, Employee, Warning, WarningCategory, WarningSeverity } from './types';
import { localDate } from './time';
import { warningCategories, warningSeverities } from './data';

export default function Warnings({ employees, branches, warnings, onSave, onUpdate, onDelete, notify }: {
  employees: Employee[]; branches: Branch[]; warnings: Warning[];
  onSave: (warning: Warning) => void; onUpdate: (warning: Warning) => void; onDelete: (id: string) => void; notify: (message: string) => void;
}) {
  const [category, setCategory] = useState<'All' | WarningCategory>('All');
  const [query, setQuery] = useState('');
  const [branchId, setBranchId] = useState('all');
  const [open, setOpen] = useState(false);
  const rows = warnings
    .filter(warning => {
      const employee = employees.find(person => person.id === warning.employeeId);
      if (!employee) return false;
      if (category !== 'All' && warning.category !== category) return false;
      if (branchId !== 'all' && employee.branchId !== branchId) return false;
      return !query || employee.fullName.toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => b.issuedDate.localeCompare(a.issuedDate));
  const summary = useMemo(() => ({
    total: warnings.length,
    open: warnings.filter(warning => !warning.acknowledged).length,
    final: warnings.filter(warning => warning.severity === 'Final').length,
    people: new Set(warnings.map(warning => warning.employeeId)).size,
  }), [warnings]);

  const labelFor = (warning: Warning) => warning.category === 'Custom' ? (warning.customCategory || 'Custom') : warning.category;

  return <div className="warnings-page">
    <div className="page-heading"><div><div className="eyebrow">EMPLOYEE RELATIONS</div><h1>Warnings</h1><p>Keep a fair, dated record of attendance, conduct, and duty warnings.</p></div><button className="btn btn-primary" onClick={() => setOpen(true)}><AlertTriangle size={16} />Issue warning</button></div>

    <div className="hr-stats">
      <div><span className="hr-stat-icon"><ShieldAlert size={18} /></span><div><small>Total warnings</small><strong>{summary.total}</strong></div></div>
      <div><span className="hr-stat-icon amber"><AlertTriangle size={18} /></span><div><small>Not acknowledged</small><strong>{summary.open}</strong></div></div>
      <div><span className="hr-stat-icon"><AlertTriangle size={18} /></span><div><small>Final written</small><strong>{summary.final}</strong></div></div>
      <div><span className="hr-stat-icon"><ShieldAlert size={18} /></span><div><small>Employees involved</small><strong>{summary.people}</strong></div></div>
    </div>

    <div className="warning-categories">
      {(['All', ...warningCategories] as const).map(item => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}<span>{item === 'All' ? warnings.length : warnings.filter(warning => warning.category === item).length}</span></button>)}
    </div>

    <section className="card directory-card">
      <div className="filter-bar"><label className="attendance-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search employee..." /></label><select value={branchId} onChange={event => setBranchId(event.target.value)}><option value="all">All branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
      <div className="table-scroll"><table className="employee-table warnings-table"><thead><tr><th>Employee</th><th>Category</th><th>Level</th><th>Issued</th><th>Issued by</th><th>Details</th><th>Acknowledged</th><th /></tr></thead>
        <tbody>{rows.map(warning => {
          const employee = employees.find(person => person.id === warning.employeeId);
          if (!employee) return null;
          return <tr key={warning.id}><td><div className="person-cell"><Avatar employee={employee} /><div><strong>{employee.fullName}</strong><span>{branches.find(branch => branch.id === employee.branchId)?.name || 'No branch'}</span></div></div></td><td><span className={`warning-tag ${warning.category.toLowerCase().replaceAll(' ', '-').replace('&', 'and')}`}>{labelFor(warning)}</span></td><td>{warning.severity}</td><td>{formatDate(warning.issuedDate)}</td><td className="muted">{warning.issuedBy || '—'}</td><td className="leave-reason" title={warning.details}>{warning.details || '—'}</td><td><button className={`ack-pill ${warning.acknowledged ? 'done' : ''}`} onClick={() => onUpdate({ ...warning, acknowledged: !warning.acknowledged })}>{warning.acknowledged ? <><Check size={13} />Acknowledged</> : 'Mark acknowledged'}</button></td><td><button className="icon-btn delete-btn" title="Delete warning" onClick={() => { if (confirm('Delete this warning?')) onDelete(warning.id); }}><Trash2 size={15} /></button></td></tr>;
        })}</tbody></table>{!rows.length && <div className="empty-table"><ShieldAlert size={28} /><h3>No warnings recorded</h3><p>{warnings.length ? 'Try another category, branch, or search term.' : 'Issue a warning to start a documented record.'}</p>{!warnings.length && <button className="btn btn-primary btn-small" onClick={() => setOpen(true)}>Issue warning</button>}</div>}</div>
      <div className="table-footer"><span>{rows.length} warning{rows.length === 1 ? '' : 's'} shown</span><span>Records are kept for authorised HR use</span></div>
    </section>

    {open && <WarningModal employees={employees} branches={branches} onClose={() => setOpen(false)} onSave={warning => { onSave(warning); setOpen(false); notify('Warning recorded'); }} />}
  </div>;
}

function WarningModal({ employees, branches, onClose, onSave }: { employees: Employee[]; branches: Branch[]; onClose: () => void; onSave: (warning: Warning) => void }) {
  const [form, setForm] = useState({ employeeId: employees[0]?.id || '', category: 'Attendance & time' as WarningCategory, customCategory: '', severity: 'Verbal' as WarningSeverity, issuedDate: localDate(), issuedBy: 'Sarah Ndlovu', details: '' });
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.employeeId) { setError('Add an employee first.'); return; }
    if (form.category === 'Custom' && !form.customCategory.trim()) { setError('Give the custom warning a name.'); return; }
    onSave({ id: crypto.randomUUID(), employeeId: form.employeeId, category: form.category, customCategory: form.category === 'Custom' ? form.customCategory.trim() : undefined, severity: form.severity, issuedDate: form.issuedDate, issuedBy: form.issuedBy, details: form.details, acknowledged: false });
  };
  return <Modal title="Issue a warning" subtitle="Record the details while they are fresh and specific" onClose={onClose}>
    <form onSubmit={submit}><div className="modal-body"><div className="form-grid">
      <label className="field field-full"><span>Employee<em>*</em></span><select required value={form.employeeId} onChange={event => setForm({ ...form, employeeId: event.target.value })}>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName} · {branches.find(branch => branch.id === employee.branchId)?.name || 'No branch'}</option>)}{!employees.length && <option value="">No employees yet</option>}</select></label>
      <label className="field"><span>Category</span><select value={form.category} onChange={event => setForm({ ...form, category: event.target.value as WarningCategory })}>{warningCategories.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="field"><span>Level</span><select value={form.severity} onChange={event => setForm({ ...form, severity: event.target.value as WarningSeverity })}>{warningSeverities.map(item => <option key={item}>{item}</option>)}</select></label>
      {form.category === 'Custom' && <label className="field field-full"><span>Custom warning name<em>*</em></span><input required value={form.customCategory} onChange={event => setForm({ ...form, customCategory: event.target.value })} placeholder="e.g. Safety PPE non-compliance" /></label>}
      <label className="field"><span>Issued on</span><input type="date" value={form.issuedDate} onChange={event => setForm({ ...form, issuedDate: event.target.value })} /></label>
      <label className="field"><span>Issued by</span><input value={form.issuedBy} onChange={event => setForm({ ...form, issuedBy: event.target.value })} /></label>
      <label className="field field-full"><span>Details<em>*</em></span><textarea required rows={4} value={form.details} onChange={event => setForm({ ...form, details: event.target.value })} placeholder="What happened, when, who was involved, and what was discussed" /></label>
    </div>{error && <p className="form-error">{error}</p>}</div>
      <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!employees.length}>Record warning</button></div></form>
  </Modal>;
}
