import { FormEvent, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock, Download, Pencil, Plus, Trash2, UsersRound } from 'lucide-react';
import { Avatar, Modal } from './components';
import { Branch, Employee, TimeEntry } from './types';
import { addDays, formatHours, localDate, shortDay, startOfWeek, toCsv, totalHours, weekDates, weekLabel, workedHours } from './time';

export default function Timesheets({ employees, branches, entries, onSave, onDelete, onApprove, onExport, notify }: {
  employees: Employee[]; branches: Branch[]; entries: TimeEntry[];
  onSave: (entry: TimeEntry) => void; onDelete: (id: string) => void; onApprove: (ids: string[], approved: boolean) => void;
  onExport: (rows: TimeEntry[]) => void; notify: (message: string) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(localDate()));
  const [branchId, setBranchId] = useState('all');
  const [employeeId, setEmployeeId] = useState('all');
  const [status, setStatus] = useState('All');
  const [editing, setEditing] = useState<TimeEntry | 'new' | null>(null);
  const days = weekDates(weekStart);
  const weekEntries = entries.filter(entry => days.includes(entry.date));
  const scoped = weekEntries.filter(entry => {
    const employee = employees.find(person => person.id === entry.employeeId);
    if (!employee) return false;
    if (branchId !== 'all' && employee.branchId !== branchId) return false;
    if (employeeId !== 'all' && entry.employeeId !== employeeId) return false;
    if (status === 'Pending' && entry.approved) return false;
    if (status === 'Approved' && !entry.approved) return false;
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date) || (employees.find(e => e.id === a.employeeId)?.fullName || '').localeCompare(employees.find(e => e.id === b.employeeId)?.fullName || ''));
  const totals = useMemo(() => ({
    hours: totalHours(scoped),
    approved: scoped.filter(entry => entry.approved).length,
    pending: scoped.filter(entry => !entry.approved).length,
    people: new Set(scoped.map(entry => entry.employeeId)).size,
  }), [scoped]);

  return <div className="timesheets-page">
    <div className="page-heading"><div><div className="eyebrow">TIME & ATTENDANCE</div><h1>Timesheets</h1><p>Review clocked hours, fix sessions, and approve the week.</p></div><div className="heading-actions"><button className="btn btn-secondary" onClick={() => onExport(scoped)}><Download size={16} />Export week</button><button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} />Add session</button></div></div>

    <div className="hr-stats">
      <div><span className="hr-stat-icon"><Clock size={18} /></span><div><small>Hours this week</small><strong>{formatHours(totals.hours)}</strong></div></div>
      <div><span className="hr-stat-icon green"><Check size={18} /></span><div><small>Approved sessions</small><strong>{totals.approved}</strong></div></div>
      <div><span className="hr-stat-icon amber"><Clock size={18} /></span><div><small>Awaiting approval</small><strong>{totals.pending}</strong></div></div>
      <div><span className="hr-stat-icon"><UsersRound size={18} /></span><div><small>People recorded</small><strong>{totals.people}</strong></div></div>
    </div>

    <section className="card directory-card">
      <div className="directory-toolbar week-toolbar">
        <div className="week-nav"><button className="icon-btn bordered" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week"><ChevronLeft size={18} /></button><div><strong>{weekLabel(weekStart)}</strong><span>Week starting {shortDay(weekStart)}</span></div><button className="icon-btn bordered" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week"><ChevronRight size={18} /></button><button className="btn btn-secondary btn-small" onClick={() => setWeekStart(startOfWeek(localDate()))}>This week</button></div>
        <label className="sort-select"><span>Week of</span><input type="date" value={weekStart} onChange={event => setWeekStart(startOfWeek(event.target.value || localDate()))} /></label>
      </div>
      <div className="filter-bar"><select value={branchId} onChange={event => setBranchId(event.target.value)}><option value="all">All branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><select value={employeeId} onChange={event => setEmployeeId(event.target.value)}><option value="all">All employees</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</select><select value={status} onChange={event => setStatus(event.target.value)}><option>All</option><option>Pending</option><option>Approved</option></select>{totals.pending > 0 && <button className="btn btn-small btn-secondary approve-all" onClick={() => { onApprove(scoped.filter(entry => !entry.approved).map(entry => entry.id), true); notify(`${totals.pending} session${totals.pending === 1 ? '' : 's'} approved`); }}><Check size={14} />Approve all shown</button>}</div>
      <div className="table-scroll"><table className="employee-table timesheet-table"><thead><tr><th>Employee</th><th>Date</th><th>Clock in</th><th>Clock out</th><th>Break</th><th>Hours</th><th>Status</th><th /></tr></thead>
        <tbody>{scoped.map(entry => {
          const employee = employees.find(person => person.id === entry.employeeId);
          if (!employee) return null;
          const branch = branches.find(item => item.id === employee.branchId);
          return <tr key={entry.id}><td><div className="person-cell"><Avatar employee={employee} /><div><strong>{employee.fullName}</strong><span>{branch?.name || 'No branch'} · {employee.employeeNumber}</span></div></div></td><td>{shortDay(entry.date)}</td><td className="mono">{entry.clockIn}</td><td className="mono">{entry.clockOut || <span className="muted-text">Open</span>}</td><td>{entry.breakMinutes} min</td><td><strong>{formatHours(workedHours(entry))}</strong></td><td><span className={`status ${entry.approved ? 'status-active' : 'status-on-leave'}`}><i />{entry.approved ? 'Approved' : 'Pending'}</span></td><td><div className="row-actions"><button className={`icon-btn ${entry.approved ? 'approved-btn' : ''}`} title={entry.approved ? 'Reopen session' : 'Approve session'} onClick={() => onApprove([entry.id], !entry.approved)}><Check size={16} /></button><button className="icon-btn" title="Edit session" onClick={() => setEditing(entry)}><Pencil size={15} /></button><button className="icon-btn delete-btn" title="Delete session" onClick={() => { if (confirm('Delete this clocking session?')) onDelete(entry.id); }}><Trash2 size={15} /></button></div></td></tr>;
        })}</tbody></table>{!scoped.length && <div className="empty-table"><Clock size={28} /><h3>No sessions this week</h3><p>Add a session or record time from the Attendance page.</p></div>}</div>
      <div className="table-footer"><span>{scoped.length} session{scoped.length === 1 ? '' : 's'} · {formatHours(totals.hours)} total</span><span>Timesheets are stored in this browser</span></div>
    </section>

    {editing && <SessionModal entry={editing === 'new' ? undefined : editing} employees={employees} branches={branches} onClose={() => setEditing(null)} onSave={entry => { onSave(entry); setEditing(null); }} />}
  </div>;
}

function SessionModal({ entry, employees, branches, onClose, onSave }: {
  entry?: TimeEntry; employees: Employee[]; branches: Branch[]; onClose: () => void; onSave: (entry: TimeEntry) => void;
}) {
  const [form, setForm] = useState({
    employeeId: entry?.employeeId || employees[0]?.id || '',
    date: entry?.date || localDate(),
    clockIn: entry?.clockIn || '08:00',
    clockOut: entry?.clockOut || '17:00',
    breakMinutes: entry?.breakMinutes ?? 60,
    notes: entry?.notes || '',
  });
  const [error, setError] = useState('');
  const hours = workedHours({ clockIn: form.clockIn, clockOut: form.clockOut, breakMinutes: Number(form.breakMinutes) || 0 });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.clockOut || !form.clockIn) { setError('Add both a clock-in and clock-out time.'); return; }
    if (form.clockOut <= form.clockIn) { setError('Clock-out must be after clock-in.'); return; }
    onSave({
      id: entry?.id || crypto.randomUUID(),
      employeeId: form.employeeId,
      date: form.date,
      clockIn: form.clockIn,
      clockOut: form.clockOut,
      breakMinutes: Number(form.breakMinutes) || 0,
      notes: form.notes,
      approved: entry?.approved ?? false,
      source: entry?.source || 'Manual',
    });
  };
  return <Modal title={entry ? 'Edit clocking session' : 'Add a clocking session'} subtitle="Hours are calculated automatically from the times and break" onClose={onClose}>
    <form onSubmit={submit}><div className="modal-body"><div className="form-grid">
      <label className="field field-full"><span>Employee<em>*</em></span><select required value={form.employeeId} onChange={event => setForm({ ...form, employeeId: event.target.value })}>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName} · {branches.find(branch => branch.id === employee.branchId)?.name || 'No branch'}</option>)}{!employees.length && <option value="">No employees yet</option>}</select></label>
      <label className="field"><span>Date<em>*</em></span><input required type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></label>
      <label className="field"><span>Break (minutes)</span><input type="number" min={0} max={480} value={form.breakMinutes} onChange={event => setForm({ ...form, breakMinutes: Number(event.target.value) })} /></label>
      <label className="field"><span>Clock in<em>*</em></span><input required type="time" value={form.clockIn} onChange={event => setForm({ ...form, clockIn: event.target.value })} /></label>
      <label className="field"><span>Clock out<em>*</em></span><input required type="time" value={form.clockOut} onChange={event => setForm({ ...form, clockOut: event.target.value })} /></label>
      <label className="field field-full"><span>Notes</span><textarea rows={2} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Overtime, site visit, or anything worth noting" /></label>
    </div><div className="hours-preview"><Clock size={16} /><span>Calculated shift</span><strong>{formatHours(hours)}</strong></div>{error && <p className="form-error">{error}</p>}</div>
    <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!employees.length}>{entry ? 'Save session' : 'Add session'}</button></div></form>
  </Modal>;
}

export function exportTimesheets(rows: TimeEntry[], employees: Employee[], branches: Branch[]) {
  const headers = ['Employee', 'Employee number', 'Branch', 'Date', 'Clock in', 'Clock out', 'Break (min)', 'Hours', 'Status', 'Notes'];
  const data = rows.map(entry => {
    const employee = employees.find(person => person.id === entry.employeeId);
    return [employee?.fullName || '', employee?.employeeNumber || '', branches.find(branch => branch.id === employee?.branchId)?.name || '', entry.date, entry.clockIn, entry.clockOut || '', entry.breakMinutes, workedHours(entry).toFixed(2), entry.approved ? 'Approved' : 'Pending', entry.notes || ''];
  });
  return toCsv(headers, data);
}
