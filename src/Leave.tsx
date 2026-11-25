import { FormEvent, useMemo, useState } from 'react';
import { CalendarDays, Check, Plus, Search, Trash2, X } from 'lucide-react';
import { Avatar, Modal, formatDate } from './components';
import { Branch, Employee, LeaveRequest, LeaveStatus, LeaveType } from './types';
import { localDate, summarizeLeave, weekdayCount } from './time';
import { leaveTypes } from './data';

export default function Leave({ employees, branches, requests, onSave, onUpdate, onDelete, notify }: {
  employees: Employee[]; branches: Branch[]; requests: LeaveRequest[];
  onSave: (request: LeaveRequest) => void; onUpdate: (request: LeaveRequest) => void; onDelete: (id: string) => void; notify: (message: string) => void;
}) {
  const [status, setStatus] = useState<'All' | LeaveStatus>('All');
  const [branchId, setBranchId] = useState('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const today = localDate();
  const rows = requests
    .filter(request => {
      const employee = employees.find(person => person.id === request.employeeId);
      if (!employee) return false;
      if (status !== 'All' && request.status !== status) return false;
      if (branchId !== 'all' && employee.branchId !== branchId) return false;
      return !query || employee.fullName.toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const summary = useMemo(() => summarizeLeave(requests, employees, today), [requests, employees, today]);

  const decide = (request: LeaveRequest, next: LeaveStatus) => {
    onUpdate({ ...request, status: next });
    const name = employees.find(employee => employee.id === request.employeeId)?.fullName.split(' ')[0] || 'Request';
    notify(`${name}'s leave ${next.toLowerCase()}`);
  };

  return <div className="leave-page">
    <div className="page-heading"><div><div className="eyebrow">TIME OFF</div><h1>Leave requests</h1><p>Review time off, approve or decline it, and keep attendance in step.</p></div><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} />New request</button></div>

    <div className="hr-stats">
      <div><span className="hr-stat-icon amber"><CalendarDays size={18} /></span><div><small>Awaiting review</small><strong>{summary.pending}</strong></div></div>
      <div><span className="hr-stat-icon green"><Check size={18} /></span><div><small>Approved requests</small><strong>{summary.approved}</strong></div></div>
      <div><span className="hr-stat-icon"><CalendarDays size={18} /></span><div><small>People on leave today</small><strong>{summary.onLeaveToday}</strong></div></div>
      <div><span className="hr-stat-icon"><CalendarDays size={18} /></span><div><small>Approved days this year</small><strong>{summary.daysThisYear}</strong></div></div>
    </div>

    <section className="card directory-card">
      <div className="leave-tabs">{(['All', 'Pending', 'Approved', 'Declined'] as const).map(tab => <button key={tab} className={status === tab ? 'active' : ''} onClick={() => setStatus(tab)}>{tab}{tab === 'Pending' && summary.pending ? <span>{summary.pending}</span> : null}</button>)}</div>
      <div className="filter-bar"><label className="attendance-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search employee..." /></label><select value={branchId} onChange={event => setBranchId(event.target.value)}><option value="all">All branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
      <div className="table-scroll"><table className="employee-table leave-table"><thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map(request => {
          const employee = employees.find(person => person.id === request.employeeId);
          if (!employee) return null;
          return <tr key={request.id}><td><div className="person-cell"><Avatar employee={employee} /><div><strong>{employee.fullName}</strong><span>{branches.find(branch => branch.id === employee.branchId)?.name || 'No branch'}</span></div></div></td><td>{request.type}</td><td className="muted">{formatDate(request.startDate)} → {formatDate(request.endDate)}</td><td><strong>{request.days}</strong></td><td className="leave-reason" title={request.reason}>{request.reason || '—'}</td><td><span className={`status ${request.status === 'Approved' ? 'status-active' : request.status === 'Pending' ? 'status-on-leave' : 'status-terminated'}`}><i />{request.status}</span></td><td><div className="row-actions">{request.status !== 'Approved' && <button className="icon-btn approved-btn" title="Approve" onClick={() => decide(request, 'Approved')}><Check size={16} /></button>}{request.status !== 'Declined' && <button className="icon-btn" title="Decline" onClick={() => decide(request, 'Declined')}><X size={16} /></button>}<button className="icon-btn delete-btn" title="Delete" onClick={() => { if (confirm('Delete this leave request?')) onDelete(request.id); }}><Trash2 size={15} /></button></div></td></tr>;
        })}</tbody></table>{!rows.length && <div className="empty-table"><CalendarDays size={28} /><h3>No leave requests here</h3><p>{requests.length ? 'Try another status or branch.' : 'Capture a request to start tracking time off.'}</p>{!requests.length && <button className="btn btn-primary btn-small" onClick={() => setOpen(true)}>New request</button>}</div>}</div>
      <div className="table-footer"><span>{rows.length} request{rows.length === 1 ? '' : 's'} shown</span><span>Approved leave feeds attendance</span></div>
    </section>

    {open && <LeaveModal employees={employees} branches={branches} onClose={() => setOpen(false)} onSave={request => { onSave(request); setOpen(false); notify('Leave request captured'); }} />}
  </div>;
}

function LeaveModal({ employees, branches, onClose, onSave }: { employees: Employee[]; branches: Branch[]; onClose: () => void; onSave: (request: LeaveRequest) => void }) {
  const [form, setForm] = useState({ employeeId: employees[0]?.id || '', type: 'Annual' as LeaveType, startDate: localDate(), endDate: localDate(), reason: '' });
  const [error, setError] = useState('');
  const days = weekdayCount(form.startDate, form.endDate);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.employeeId) { setError('Add an employee first.'); return; }
    if (form.endDate < form.startDate) { setError('The end date must be on or after the start date.'); return; }
    if (!days) { setError('That range has no working days.'); return; }
    onSave({ id: crypto.randomUUID(), employeeId: form.employeeId, type: form.type, startDate: form.startDate, endDate: form.endDate, days, reason: form.reason, status: 'Pending', requestedAt: new Date().toISOString() });
  };
  return <Modal title="New leave request" subtitle="Working days are counted automatically, excluding weekends" onClose={onClose}>
    <form onSubmit={submit}><div className="modal-body"><div className="form-grid">
      <label className="field field-full"><span>Employee<em>*</em></span><select required value={form.employeeId} onChange={event => setForm({ ...form, employeeId: event.target.value })}>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName} · {branches.find(branch => branch.id === employee.branchId)?.name || 'No branch'}</option>)}{!employees.length && <option value="">No employees yet</option>}</select></label>
      <label className="field field-full"><span>Leave type</span><select value={form.type} onChange={event => setForm({ ...form, type: event.target.value as LeaveType })}>{leaveTypes.map(type => <option key={type}>{type}</option>)}</select></label>
      <label className="field"><span>From<em>*</em></span><input required type="date" value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} /></label>
      <label className="field"><span>To<em>*</em></span><input required type="date" value={form.endDate} onChange={event => setForm({ ...form, endDate: event.target.value })} /></label>
      <label className="field field-full"><span>Reason</span><textarea rows={3} value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} placeholder="Family responsibility, medical appointment, annual break..." /></label>
    </div><div className="hours-preview"><CalendarDays size={16} /><span>Working days requested</span><strong>{days}</strong></div>{error && <p className="form-error">{error}</p>}</div>
      <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!employees.length}>Capture request</button></div></form>
  </Modal>;
}
