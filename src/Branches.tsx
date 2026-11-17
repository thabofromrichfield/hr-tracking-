import { FormEvent, useState } from 'react';
import { Building2, ChevronRight, Download, MapPin, MoreHorizontal, Plus, Search, Trash2, UserPlus, UsersRound, X } from 'lucide-react';
import { Avatar, EmployeeTable, Modal, PageBack, SearchInput } from './components';
import { Branch, Employee } from './types';

export default function Branches({ employees, branches, selectedId, onSelect, onOpenEmployee, onSaveBranch, onDeleteBranch, onAssign, onExport }: {
  employees: Employee[]; branches: Branch[]; selectedId?: string; onSelect: (id?: string) => void;
  onOpenEmployee: (id: string) => void; onSaveBranch: (branch: Branch) => void; onDeleteBranch: (id: string) => void;
  onAssign: (employeeId: string, branchId?: string) => void; onExport: (branch: Branch, members: Employee[]) => void;
}) {
  const [modal, setModal] = useState<'create' | 'members' | false>(false);
  const [query, setQuery] = useState('');
  const branch = branches.find(item => item.id === selectedId);
  const members = branch ? employees.filter(employee => employee.branchId === branch.id) : [];
  const active = employees.filter(employee => employee.status === 'Active' || employee.status === 'On leave');
  const unassigned = employees.filter(employee => !employee.branchId && employee.status !== 'Resigned' && employee.status !== 'Terminated');

  if (branch) return <div className="branches-page">
    <PageBack onClick={() => onSelect()}>All branches</PageBack>
    <div className="page-heading group-heading"><div className="heading-with-icon"><div className="page-icon" style={{ background: `${branch.color}18`, color: branch.color }}><Building2 size={24} /></div><div><div className="eyebrow">Branch</div><h1>{branch.name}</h1><p>{branch.description || 'No description yet'}</p></div></div><div className="heading-actions"><button className="btn btn-secondary" onClick={() => onExport(branch, members)}><Download size={16} />Export members</button><button className="btn btn-primary" onClick={() => setModal('members')}><UserPlus size={17} />Manage members</button></div></div>
    <div className="group-stats"><div><UsersRound size={18} /><span><strong>{members.length}</strong> people assigned</span></div><div><span className="mini-label">Branch lead</span><strong>{branch.lead || 'No lead assigned'}</strong></div><div><span className="mini-label">Active members</span><strong>{members.filter(member => member.status === 'Active').length}</strong></div><div><span className="mini-label">On leave</span><strong>{members.filter(member => member.status === 'On leave').length}</strong></div></div>
    <section className="card directory-card"><div className="directory-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search branch members..." /><button className="icon-btn bordered" title="Delete branch" onClick={() => { if (confirm(`Delete ${branch.name}? Employees stay on the system but will not belong to a branch.`)) onDeleteBranch(branch.id); }}><Trash2 size={18} /></button></div><EmployeeTable employees={members.filter(employee => employee.fullName.toLowerCase().includes(query.toLowerCase()))} onOpen={onOpenEmployee} branches={branches} /><div className="table-footer"><span>{members.length} of {employees.length} employees in {branch.name}</span><span>Peopleflow HR · Branch records</span></div></section>
    {modal === 'members' && <MembersModal branch={branch} employees={employees} onClose={() => setModal(false)} onAssign={onAssign} />}
  </div>;

  return <div className="branches-page">
    <div className="page-heading"><div><div className="eyebrow">ORGANISATION</div><h1>Branches</h1><p>Group your people by the branch they report to — Ekurhuleni, Joburg, or Tshwane.</p></div><button className="btn btn-primary" onClick={() => setModal('create')}><Plus size={17} />Add branch</button></div>
    <div className="group-overview"><div><Building2 size={20} /><span><strong>{branches.length}</strong> branches</span></div><p>{active.filter(employee => employee.branchId).length} of {active.length} active employees are assigned to a branch{unassigned.length ? ` · ${unassigned.length} still unassigned` : ''}</p></div>
    <div className="groups-grid">{branches.map(branch => {
      const count = employees.filter(employee => employee.branchId === branch.id && employee.status !== 'Resigned' && employee.status !== 'Terminated').length;
      const preview = employees.filter(employee => employee.branchId === branch.id).slice(0, 4);
      return <button className="group-card card" key={branch.id} onClick={() => onSelect(branch.id)}><div className="group-card-top"><div className="group-icon" style={{ background: `${branch.color}18`, color: branch.color }}><MapPin size={21} /></div><ChevronRight size={19} /></div><h2>{branch.name}</h2><p>{branch.description}</p><div className="group-card-bottom"><div className="avatar-stack">{preview.map(employee => <Avatar key={employee.id} employee={employee} size="xs" />)}{count > 4 && <span>+{count - 4}</span>}</div><strong>{count} members</strong></div></button>;
    })}<button className="new-group-card" onClick={() => setModal('create')}><span><Plus size={22} /></span><strong>Add another branch</strong><p>Create a new operating location</p></button></div>
    {modal === 'create' && <BranchModal branches={branches} employees={employees} onClose={() => setModal(false)} onSave={branch => { onSaveBranch(branch); setModal(false); }} />}
  </div>;
}

function BranchModal({ branches, employees, onClose, onSave }: { branches: Branch[]; employees: Employee[]; onClose: () => void; onSave: (branch: Branch) => void }) {
  const [form, setForm] = useState({ name: '', description: '', lead: '' });
  return <Modal title="Add a branch" subtitle="Branches group people and their time records by location" onClose={onClose}><form onSubmit={(event: FormEvent) => { event.preventDefault(); onSave({ ...form, id: crypto.randomUUID(), color: ['#5B6CF9', '#06B6D4', '#F59E0B', '#10B981', '#EC4899'][branches.length % 5] }); }}><div className="modal-body"><div className="form-grid"><label className="field field-full"><span>Branch name<em>*</em></span><input required autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="e.g. Ekurhuleni" /></label><label className="field field-full"><span>Short description</span><textarea rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="What work happens at this branch?" /></label><label className="field field-full"><span>Branch lead</span><select value={form.lead} onChange={event => setForm({ ...form, lead: event.target.value })}><option value="">No lead assigned</option>{employees.filter(employee => employee.status === 'Active').map(employee => <option key={employee.id} value={employee.fullName}>{employee.fullName}</option>)}</select></label></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary"><Plus size={16} />Add branch</button></div></form></Modal>;
}

function MembersModal({ branch, employees, onClose, onAssign }: { branch: Branch; employees: Employee[]; onClose: () => void; onAssign: (employeeId: string, branchId?: string) => void }) {
  const [query, setQuery] = useState('');
  return <Modal title={`Manage ${branch.name}`} subtitle="Every employee belongs to one branch or none" onClose={onClose}><div className="modal-body member-modal"><SearchInput value={query} onChange={setQuery} placeholder="Find an employee..." /><div className="member-list">{employees.filter(employee => employee.fullName.toLowerCase().includes(query.toLowerCase())).map(employee => {
    const assigned = employee.branchId === branch.id;
    const elsewhere = !assigned && employees.length > 0 && employee.branchId ? true : false;
    return <div key={employee.id}><Avatar employee={employee} size="sm" /><div><strong>{employee.fullName}</strong><span>{employee.jobTitle}{elsewhere ? ' · moving here unassigns their branch' : ''}</span></div><button className={`btn btn-small ${assigned ? 'btn-secondary' : 'btn-primary'}`} onClick={() => onAssign(employee.id, assigned ? undefined : branch.id)}>{assigned ? <><X size={14} />Remove</> : <><Plus size={14} />Add</>}</button></div>;
  })}{!employees.length && <p className="gf-list-empty">No employees yet. Register employees first, then assign their branch.</p>}</div></div><div className="modal-footer"><button className="btn btn-primary" onClick={onClose}>Done</button></div></Modal>;
}
