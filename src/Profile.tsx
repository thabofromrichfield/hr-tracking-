import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, CalendarDays, Check, ChevronRight, Download, Eye, EyeOff, File, FilePlus2, FileText, FolderOpen, Mail, MapPin, MoreHorizontal, Pencil, Phone, Plus, ShieldCheck, Trash2, Upload, UserRound, UsersRound, X } from 'lucide-react';
import { Avatar, Modal, PageBack, StatusBadge, formatDate, yearsAtCompany } from './components';
import { CustomField, Employee, EmployeeDocument, Group, Status, WorkEntry } from './types';

export default function Profile({ employee, groups, customFields, onBack, onEdit, onUpdate, onGroup, notify }: {
  employee: Employee; groups: Group[]; customFields: CustomField[]; onBack: () => void; onEdit: () => void;
  onUpdate: (employee: Employee, message: string) => void; onGroup: (id: string) => void; notify: (message: string) => void;
}) {
  const [tab, setTab] = useState<'overview' | 'history' | 'documents'>('overview');
  const [showId, setShowId] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [offboardOpen, setOffboardOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const docInput = useRef<HTMLInputElement>(null);
  const inactive = employee.status === 'Resigned' || employee.status === 'Terminated';
  const update = (patch: Partial<Employee>, message: string) => onUpdate({ ...employee, ...patch, lastUpdated: new Date().toISOString() }, message);

  return <div className="profile-page">
    <div className="profile-top"><PageBack onClick={onBack}>Employee directory</PageBack><div className="profile-actions"><button className="btn btn-secondary" onClick={onEdit}><Pencil size={16} />Edit profile</button><div className="relative"><button className="icon-btn bordered" onClick={() => setMenu(!menu)}><MoreHorizontal size={20} /></button>{menu && <div className="context-menu"><button onClick={() => { setTab('documents'); setMenu(false); }}><Upload size={16} />Upload document</button>{!inactive && <button className="danger-text" onClick={() => { setOffboardOpen(true); setMenu(false); }}><UserRound size={16} />Offboard employee</button>}</div>}</div></div></div>
    <section className="profile-hero card">
      <div className="profile-main"><Avatar employee={employee} size="xl" /><div><div className="profile-name"><h1>{employee.fullName}</h1><StatusBadge status={employee.status} /></div><p className="profile-role">{employee.jobTitle}<span>·</span>{employee.department}</p><div className="profile-meta"><span><Mail size={15} />{employee.email}</span><span><Phone size={15} />{employee.phone}</span><span><MapPin size={15} />{employee.address.split(',').slice(-2).join(',')}</span></div></div></div>
      <div className="profile-summary"><div><span>Employee number</span><strong>{employee.employeeNumber}</strong></div><div><span>Time at company</span><strong>{yearsAtCompany(employee.startDate, employee.endDate)}</strong></div><div><span>Start date</span><strong>{formatDate(employee.startDate)}</strong></div></div>
      {inactive && <div className="offboard-banner"><UserRound size={17} /><span>{employee.status} on {formatDate(employee.endDate, true)}. This record is retained for reference.</span><button onClick={() => update({ status: 'Active', endDate: undefined }, 'Employee reactivated')}>Reactivate</button></div>}
    </section>
    <div className="profile-tabs"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><UserRound size={17} />Overview</button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><BriefcaseBusiness size={17} />Work history<span>{employee.workHistory.length}</span></button><button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}><FolderOpen size={17} />Documents<span>{employee.documents.length}</span></button></div>

    {tab === 'overview' && <div className="profile-grid">
      <div className="profile-content">
        <section className="card detail-card"><div className="card-title"><h2>Personal information</h2><button className="text-btn" onClick={onEdit}><Pencil size={14} />Edit</button></div><div className="detail-grid">
          <Detail label="Full name" value={employee.fullName} /><Detail label="Date of birth" value={formatDate(employee.dob, true)} />
          <Detail label="ID number" value={<span className="sensitive-value">{showId ? employee.idNumber : `•••••••${employee.idNumber.slice(-4)}`}<button onClick={() => setShowId(!showId)} title={showId ? 'Hide ID number' : 'Show ID number'}>{showId ? <EyeOff size={15} /> : <Eye size={15} />}</button></span>} />
          <Detail label="Contact number" value={employee.phone} /><Detail label="Email address" value={employee.email} /><Detail label="Home address" value={employee.address} />
        </div><div className="emergency-box"><div className="emergency-icon"><Phone size={17} /></div><div><span>Emergency contact</span><strong>{employee.emergencyName || 'Not provided'}</strong></div><b>{employee.emergencyPhone}</b></div></section>
        <section className="card detail-card"><div className="card-title"><h2>About {employee.fullName.split(' ')[0]}</h2><span className="soft-label">Personal notes</span></div><p className="bio">{employee.bio || 'No bio has been added yet.'}</p><div className="about-row"><div><span>Skills & expertise</span><div className="tag-list">{employee.skills ? employee.skills.split(',').map(s => <span key={s}>{s.trim()}</span>) : <p>Not provided</p>}</div></div><div><span>Languages</span><p>{employee.languages || 'Not provided'}</p></div></div>{customFields.length > 0 && <div className="custom-details">{customFields.map(field => <Detail key={field.id} label={field.label} value={employee.custom[field.label] || '—'} />)}</div>}</section>
      </div>
      <aside className="profile-aside">
        <section className="card detail-card"><div className="card-title"><h2>Employment</h2></div><div className="employment-list"><Detail label="Department" value={employee.department} /><Detail label="Reports to" value={employee.manager} /><Detail label="Employment type" value={employee.employmentType} /><Detail label="Current status" value={<StatusBadge status={employee.status} />} /><Detail label="Start date" value={formatDate(employee.startDate, true)} />{employee.endDate && <Detail label="End date" value={formatDate(employee.endDate, true)} />}</div></section>
        <section className="card detail-card"><div className="card-title"><h2>Groups</h2><span className="count-pill">{employee.groups.length}</span></div><div className="profile-groups">{employee.groups.map(id => groups.find(g => g.id === id)).filter(Boolean).map(group => <button key={group!.id} onClick={() => onGroup(group!.id)}><span className="group-dot" style={{ background: group!.color }} /><span>{group!.name}</span><ChevronRight size={15} /></button>)}{!employee.groups.length && <p className="muted small">Not a member of any groups.</p>}</div></section>
        <div className="last-updated"><Check size={14} />Last updated {new Date(employee.lastUpdated).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </aside>
    </div>}

    {tab === 'history' && <section className="card history-card"><div className="card-title"><div><h2>Work history</h2><p>Roles, projects, and scope of work — newest first</p></div><button className="btn btn-primary btn-small" onClick={() => setHistoryOpen(true)}><Plus size={16} />Add entry</button></div><div className="timeline">{[...employee.workHistory].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((entry, i) => <div className="timeline-item" key={entry.id}><div className="timeline-marker"><BriefcaseBusiness size={16} /></div><div className="timeline-content"><div className="timeline-head"><div><h3>{entry.title}</h3><span>{entry.project}</span></div><span className="date-range">{formatDate(entry.startDate)} — {entry.endDate ? formatDate(entry.endDate) : 'Present'}</span></div><p>{entry.description}</p>{entry.document && <button className="inline-doc" onClick={() => downloadPlaceholder(entry.document!, notify)}><FileText size={16} /><span>{entry.document}</span><Download size={14} /></button>}</div><button className="icon-btn timeline-delete" onClick={() => { if (confirm('Remove this work history entry?')) update({ workHistory: employee.workHistory.filter(w => w.id !== entry.id) }, 'Work history entry removed'); }}><X size={16} /></button>{i < employee.workHistory.length - 1 && <div className="timeline-line" />}</div>)}{!employee.workHistory.length && <Empty icon={<BriefcaseBusiness />} title="No work history yet" text="Add a role, project, or duty to start building their history." />}</div></section>}

    {tab === 'documents' && <section className="card documents-card"><div className="card-title"><div><h2>Employee documents</h2><p>Contracts, identification, qualifications, and other records</p></div><button className="btn btn-primary btn-small" onClick={() => setDocsOpen(true)}><FilePlus2 size={16} />Upload document</button></div><div className="document-list">{employee.documents.map(doc => <div className="document-row" key={doc.id}><div className="doc-icon"><FileText size={21} /></div><div className="doc-name"><strong>{doc.name}</strong><span>{doc.type}<i>·</i>{doc.size}</span></div><span className="doc-date">Added {formatDate(doc.date)}</span><button className="icon-btn" title="Open document" onClick={() => openDocument(doc, notify)}><Eye size={18} /></button><label className="icon-btn" title="Replace document"><Upload size={17} /><input type="file" hidden onChange={e => replaceDocument(e, doc, employee, update, notify)} /></label><button className="icon-btn delete-btn" title="Remove document" onClick={() => { if (confirm(`Remove ${doc.name}?`)) update({ documents: employee.documents.filter(d => d.id !== doc.id) }, 'Document removed'); }}><Trash2 size={17} /></button></div>)}{!employee.documents.length && <Empty icon={<FolderOpen />} title="No documents uploaded" text="Keep important employee files together in one secure place." />}</div><div className="document-security"><ShieldCheck size={16} />Documents are private and only available to authorised HR users.</div></section>}

    {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} onSave={entry => { update({ workHistory: [entry, ...employee.workHistory] }, 'Work history entry added'); setHistoryOpen(false); }} />}
    {docsOpen && <DocumentModal onClose={() => setDocsOpen(false)} onSave={doc => { update({ documents: [doc, ...employee.documents] }, 'Document uploaded'); setDocsOpen(false); }} />}
    {offboardOpen && <OffboardModal employee={employee} onClose={() => setOffboardOpen(false)} onSave={(status, endDate) => { update({ status, endDate }, `${employee.fullName} marked as ${status.toLowerCase()}`); setOffboardOpen(false); }} />}
  </div>;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) { return <div className="detail"><span>{label}</span><div>{value || '—'}</div></div>; }
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="empty-state">{icon}<h3>{title}</h3><p>{text}</p></div>; }

function HistoryModal({ onClose, onSave }: { onClose: () => void; onSave: (entry: WorkEntry) => void }) {
  const [form, setForm] = useState({ title: '', project: '', description: '', startDate: '', endDate: '', document: '' });
  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));
  return <Modal title="Add work history" subtitle="Record a role, project, duty, or scope of work" onClose={onClose}><form onSubmit={(e: FormEvent) => { e.preventDefault(); onSave({ ...form, id: crypto.randomUUID(), endDate: form.endDate || undefined }); }}><div className="modal-body form-grid"><label className="field"><span>Role or title<em>*</em></span><input required value={form.title} onChange={e => set('title', e.target.value)} /></label><label className="field"><span>Project or area<em>*</em></span><input required value={form.project} onChange={e => set('project', e.target.value)} /></label><label className="field"><span>Start date<em>*</em></span><input required type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></label><label className="field"><span>End date</span><input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} /></label><label className="field field-full"><span>Description & scope of work</span><textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What did this role or project involve?" /></label><label className="field field-full"><span>Attached document</span><input value={form.document} onChange={e => set('document', e.target.value)} placeholder="e.g. signed_scope.pdf" /></label></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary"><Plus size={16} />Add entry</button></div></form></Modal>;
}

function DocumentModal({ onClose, onSave }: { onClose: () => void; onSave: (doc: EmployeeDocument) => void }) {
  const [type, setType] = useState('Contract'); const [file, setFile] = useState<File>();
  const submit = (e: FormEvent) => {
    e.preventDefault(); if (!file) return;
    const finish = (data?: string) => onSave({ id: crypto.randomUUID(), name: file.name, type, size: file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`, date: new Date().toISOString().slice(0, 10), data });
    if (file.size < 1200000) { const reader = new FileReader(); reader.onload = () => finish(String(reader.result)); reader.readAsDataURL(file); } else finish();
  };
  return <Modal title="Upload a document" subtitle="Add a file to this employee's record" onClose={onClose}><form onSubmit={submit}><div className="modal-body"><label className={`drop-zone ${file ? 'has-file' : ''}`}><input type="file" required onChange={e => setFile(e.target.files?.[0])} />{file ? <><FileText size={30} /><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(0)} KB · Click to choose another</span></> : <><div><Upload size={24} /></div><strong>Choose a file to upload</strong><span>PDF, Word, image, or spreadsheet · up to 10 MB</span></>}</label><label className="field doc-type"><span>Document type</span><select value={type} onChange={e => setType(e.target.value)}>{['Contract', 'Scope of work', 'Identification', 'Qualification', 'Certificate', 'Offboarding', 'Other'].map(t => <option key={t}>{t}</option>)}</select></label></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!file}><Upload size={16} />Upload document</button></div></form></Modal>;
}

function OffboardModal({ employee, onClose, onSave }: { employee: Employee; onClose: () => void; onSave: (status: Status, endDate: string) => void }) {
  const [status, setStatus] = useState<Status>('Resigned'); const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  return <Modal title={`Offboard ${employee.fullName.split(' ')[0]}`} subtitle="Their record and documents will be kept for reference" onClose={onClose}><form onSubmit={e => { e.preventDefault(); onSave(status, endDate); }}><div className="modal-body"><div className="offboard-note"><UserRound size={20} /><p>This removes {employee.fullName} from the active employee list. You can still find their full profile using the directory filters.</p></div><div className="form-grid"><label className="field"><span>Leaving reason</span><select value={status} onChange={e => setStatus(e.target.value as Status)}><option>Resigned</option><option>Terminated</option></select></label><label className="field"><span>Last working day</span><input required type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-danger">Confirm offboarding</button></div></form></Modal>;
}

function openDocument(doc: EmployeeDocument, notify: (m: string) => void) {
  if (doc.data) { const a = document.createElement('a'); a.href = doc.data; a.target = '_blank'; a.rel = 'noopener'; a.click(); }
  else downloadPlaceholder(doc.name, notify);
}
function downloadPlaceholder(name: string, notify: (m: string) => void) {
  const blob = new Blob([`Peopleflow document record\n\nFile: ${name}\n\nThis sample record does not contain the original file. Upload or replace the document to store its contents.`], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.txt`; a.click(); URL.revokeObjectURL(a.href); notify('Sample document record downloaded');
}
function replaceDocument(e: ChangeEvent<HTMLInputElement>, doc: EmployeeDocument, employee: Employee, update: (p: Partial<Employee>, m: string) => void, notify: (m: string) => void) {
  const file = e.target.files?.[0]; if (!file) return;
  if (file.size > 1200000) return notify('Please choose a file smaller than 1.2 MB for browser storage');
  const reader = new FileReader(); reader.onload = () => update({ documents: employee.documents.map(d => d.id === doc.id ? { ...d, name: file.name, size: `${Math.round(file.size / 1024)} KB`, data: String(reader.result), date: new Date().toISOString().slice(0, 10) } : d) }, 'Document replaced'); reader.readAsDataURL(file);
}
