import { FormEvent, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, LogIn, LogOut, Pencil, Plus, Search, Trash2, UsersRound } from 'lucide-react';
import { Avatar, Modal } from './components';
import { Branch, Employee, LeaveRequest, TimeEntry } from './types';
import { addDays, coversDate, formatHours, localDate, localTime, shortDay, totalHours, workedHours } from './time';

export default function Attendance({ employees, branches, entries, leaveRequests, onSave, onDelete, onManageEmployees, notify }: {
  employees: Employee[]; branches: Branch[]; entries: TimeEntry[]; leaveRequests: LeaveRequest[];
  onSave: (entry: TimeEntry) => void; onDelete: (id: string) => void; onManageEmployees: () => void; notify: (message: string) => void;
}) {
  const [date, setDate] = useState(() => localDate());
  const [branchId, setBranchId] = useState('all');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<{ employeeId: string } | null>(null);
  const active = employees.filter(employee => employee.status === 'Active' || employee.status === 'On leave');
  const dayEntries = entries.filter(entry => entry.date === date);
  const rows = active.filter(employee => (branchId === 'all' || employee.branchId === branchId) && employee.fullName.toLowerCase().includes(query.toLowerCase())).map(employee => {
    const sessions = dayEntries.filter(entry => entry.employeeId === employee.id);
    const onLeave = leaveRequests.some(request => request.employeeId === employee.id && request.status === 'Approved' && coversDate(request.startDate, request.endDate, date));
    const open = sessions.find(entry => !entry.clockOut);
    return { employee, sessions, onLeave, open, hours: totalHours(sessions) };
  });
  const totals = useMemo(() => ({
    present: rows.filter(row => row.sessions.length > 0).length,
    onLeave: rows.filter(row => row.onLeave).length,
    absent: rows.filter(row => !row.sessions.length && !row.onLeave).length,
    hours: rows.reduce((sum, row) => sum + row.hours, 0),
  }), [rows]);

  const quickClock = (employee: Employee, open: TimeEntry | undefined) => {
    if (open) {
      onSave({ ...open, clockOut: localTime(), source: 'Clock' });
      notify(`${employee.fullName.split(' ')[0]} clocked out at ${localTime()}`);
      return;
    }
    onSave({ id: crypto.randomUUID(), employeeId: employee.id, date, clockIn: localTime(), breakMinutes: 60, approved: false, source: 'Clock', notes: '' });
    notify(`${employee.fullName.split(' ')[0]} clocked in at ${localTime()}`);
  };

  return <div className="attendance-page">
    <div className="page-heading"><div><div className="eyebrow">TIME & ATTENDANCE</div><h1>Attendance</h1><p>Record who is on site today, clock people in and out, and fix their sessions.</p></div><div className="heading-actions"><button className="btn btn-secondary" onClick={onManageEmployees}><UsersRound size={16} />Manage employees</button><button className="btn btn-primary" onClick={() => setModal({ employeeId: active[0]?.id || '' })} disabled={!active.length}><Plus size={16} />Record time</button></div></div>

    <div className="hr-stats">
      <div><span className="hr-stat-icon green"><Check size={18} /></span><div><small>Present</small><strong>{totals.present}</strong></div></div>
      <div><span className="hr-stat-icon amber"><CalendarDays size={18} /></span><div><small>On approved leave</small><strong>{totals.onLeave}</strong></div></div>
      <div><span className="hr-stat-icon"><UsersRound size={18} /></span><div><small>No time recorded</small><strong>{totals.absent}</strong></div></div>
      <div><span className="hr-stat-icon"><Clock size={18} /></span><div><small>Hours recorded</small><strong>{formatHours(totals.hours)}</strong></div></div>
    </div>

    <section className="card directory-card">
      <div className="directory-toolbar week-toolbar">
        <div className="week-nav"><button className="icon-btn bordered" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft size={18} /></button><div><strong>{new Date(`${date}T12:00:00`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong><span>{date === localDate() ? 'Today' : 'Attendance for this day'}</span></div><button className="icon-btn bordered" onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><ChevronRight size={18} /></button><button className="btn btn-secondary btn-small" onClick={() => setDate(localDate())}>Today</button></div>
        <label className="sort-select"><span>Date</span><input type="date" value={date} onChange={event => setDate(event.target.value || localDate())} /></label>
      </div>
      <div className="filter-bar"><label className="attendance-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find an employee..." /></label><select value={branchId} onChange={event => setBranchId(event.target.value)}><option value="all">All branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
      <div className="table-scroll"><table className="employee-table attendance-table"><thead><tr><th>Employee</th><th>Branch</th><th>Status</th><th>Clock in</th><th>Clock out</th><th>Hours</th><th /></tr></thead>
        <tbody>{rows.map(({ employee, sessions, onLeave, open, hours }) => {
          const first = sessions.slice().sort((a, b) => a.clockIn.localeCompare(b.clockIn))[0];
          const last = sessions.slice().sort((a, b) => (a.clockOut || '').localeCompare(b.clockOut || '')).filter(entry => entry.clockOut).pop();
          return <tr key={employee.id} onClick={() => setModal({ employeeId: employee.id })}>
            <td><div className="person-cell"><Avatar employee={employee} /><div><strong>{employee.fullName}</strong><span>{employee.jobTitle}</span></div></div></td>
            <td>{branches.find(branch => branch.id === employee.branchId)?.name || <span className="muted-text">Unassigned</span>}</td>
            <td>{onLeave ? <span className="status status-on-leave"><i />On leave</span> : open ? <span className="status status-active"><i />On shift</span> : sessions.length ? <span className="status status-active"><i />Present</span> : <span className="status status-resigned"><i />No time</span>}</td>
            <td className="mono">{first?.clockIn || '—'}</td><td className="mono">{last?.clockOut || (open ? 'On shift' : '—')}</td><td><strong>{formatHours(hours)}</strong></td>
            <td><div className="row-actions"><button className={`btn btn-small ${open ? 'btn-secondary' : 'btn-primary'}`} onClick={event => { event.stopPropagation(); quickClock(employee, open); }}>{open ? <><LogOut size={14} />Clock out</> : <><LogIn size={14} />Clock in</>}</button><button className="icon-btn" title="Edit sessions" onClick={event => { event.stopPropagation(); setModal({ employeeId: employee.id }); }}><Pencil size={15} /></button></div></td>
          </tr>;
        })}</tbody></table>{!rows.length && <div className="empty-table"><UsersRound size={28} /><h3>No employees to show</h3><p>{employees.length ? 'Try another branch or search term.' : 'Add employees, then record their time here.'}</p>{!employees.length && <button className="btn btn-primary btn-small" onClick={onManageEmployees}>Manage employees</button>}</div>}</div>
      <div className="table-footer"><span>{rows.length} employee{rows.length === 1 ? '' : 's'} · {formatHours(totals.hours)} recorded</span><span>{shortDay(date)} attendance</span></div>
    </section>

    {modal && (() => {
      const employee = employees.find(person => person.id === modal.employeeId);
      if (!employee) return null;
      return <DayModal employee={employee} date={date} sessions={dayEntries.filter(entry => entry.employeeId === employee.id)} branches={branches} onClose={() => setModal(null)} onSave={onSave} onDelete={onDelete} />;
    })()}
  </div>;
}

function DayModal({ employee, date, sessions, branches, onClose, onSave, onDelete }: {
  employee: Employee; date: string; sessions: TimeEntry[]; branches: Branch[];
  onClose: () => void; onSave: (entry: TimeEntry) => void; onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | undefined>();
  const [clockIn, setClockIn] = useState('08:00');
  const [clockOut, setClockOut] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [error, setError] = useState('');
  const branch = branches.find(item => item.id === employee.branchId);

  const reset = () => { setEditingId(undefined); setClockIn('08:00'); setClockOut('17:00'); setBreakMinutes(60); setError(''); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (clockOut <= clockIn) { setError('Clock-out must be after clock-in.'); return; }
    const existing = sessions.find(entry => entry.id === editingId);
    onSave({ id: editingId || crypto.randomUUID(), employeeId: employee.id, date, clockIn, clockOut, breakMinutes: Number(breakMinutes) || 0, approved: existing?.approved ?? false, source: existing?.source || 'Manual', notes: existing?.notes || '' });
    reset();
  };

  return <Modal title={`Time for ${employee.fullName}`} subtitle={`${new Date(`${date}T12:00:00`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })} · ${branch?.name || 'No branch'}`} onClose={onClose}>
    <div className="modal-body">
      <div className="attendance-session-list">{sessions.map(entry => <div key={entry.id}><div><strong className="mono">{entry.clockIn} – {entry.clockOut || 'open'}</strong><span>{formatHours(workedHours(entry))} · {entry.breakMinutes} min break</span></div><div className="row-actions"><button className="icon-btn" title="Edit" onClick={() => { setEditingId(entry.id); setClockIn(entry.clockIn); setClockOut(entry.clockOut || '17:00'); setBreakMinutes(entry.breakMinutes); }}><Pencil size={15} /></button><button className="icon-btn delete-btn" title="Delete" onClick={() => { if (confirm('Delete this session?')) { onDelete(entry.id); if (editingId === entry.id) reset(); } }}><Trash2 size={15} /></button></div></div>)}{!sessions.length && <p className="gf-list-empty">No sessions recorded for this day.</p>}</div>
      <form className="attendance-form" onSubmit={submit}>
        <div className="form-grid"><label className="field"><span>Clock in</span><input type="time" value={clockIn} onChange={event => setClockIn(event.target.value)} /></label><label className="field"><span>Clock out</span><input type="time" value={clockOut} onChange={event => setClockOut(event.target.value)} /></label><label className="field"><span>Break (min)</span><input type="number" min={0} max={480} value={breakMinutes} onChange={event => setBreakMinutes(Number(event.target.value))} /></label><label className="field"><span>Shift length</span><input readOnly value={formatHours(workedHours({ clockIn, clockOut, breakMinutes: Number(breakMinutes) || 0 }))} /></label></div>
        {error && <p className="form-error">{error}</p>}
        <div className="attendance-form-actions">{editingId && <button type="button" className="btn btn-secondary btn-small" onClick={reset}>Cancel edit</button>}<button className="btn btn-primary btn-small">{editingId ? 'Save session' : 'Add session'}</button></div>
      </form>
    </div>
    <div className="modal-footer"><button className="btn btn-primary" onClick={onClose}>Done</button></div>
  </Modal>;
}
