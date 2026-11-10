import { FormEvent, useState } from 'react';
import { ChevronRight, Download, FolderTree, MoreHorizontal, Pencil, Plus, Search, Trash2, UserPlus, UsersRound, X } from 'lucide-react';
import { Avatar, EmployeeTable, Modal, PageBack, SearchInput } from './components';
import { Employee, Group } from './types';

export default function Groups({ employees, groups, selectedId, onSelect, onOpenEmployee, onSaveGroup, onDeleteGroup, onMembership, onExport }: {
  employees: Employee[]; groups: Group[]; selectedId?: string; onSelect: (id?: string) => void; onOpenEmployee: (id: string) => void;
  onSaveGroup: (group: Group) => void; onDeleteGroup: (id: string) => void; onMembership: (employeeId: string, groupId: string, add: boolean) => void; onExport: (group: Group) => void;
}) {
  const [modal, setModal] = useState<'create' | 'members' | false>(false);
  const [query, setQuery] = useState('');
  const group = groups.find(g => g.id === selectedId);
  const members = group ? employees.filter(e => e.groups.includes(group.id)) : [];
  const active = employees.filter(e => e.status === 'Active' || e.status === 'On leave');

  if (group) return <div className="groups-page">
    <PageBack onClick={() => onSelect()}>All groups</PageBack>
    <div className="page-heading group-heading"><div className="heading-with-icon"><div className="page-icon" style={{ background: `${group.color}18`, color: group.color }}><UsersRound size={24} /></div><div><div className="eyebrow">{group.parentId ? groups.find(g => g.id === group.parentId)?.name : 'Company group'}</div><h1>{group.name}</h1><p>{group.description}</p></div></div><div className="heading-actions"><button className="btn btn-secondary" onClick={() => onExport(group)}><Download size={16} />Export members</button><button className="btn btn-primary" onClick={() => setModal('members')}><UserPlus size={17} />Manage members</button></div></div>
    <div className="group-stats"><div><UsersRound size={18} /><span><strong>{members.length}</strong> total members</span></div><div><span className="mini-label">Group lead</span><strong>{group.lead || 'No lead assigned'}</strong></div><div><span className="mini-label">Active members</span><strong>{members.filter(m => m.status === 'Active').length}</strong></div></div>
    <section className="card directory-card"><div className="directory-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search group members..." /><button className="icon-btn bordered" onClick={() => { if (confirm(`Delete ${group.name}? Members will remain in the directory.`)) onDeleteGroup(group.id); }} title="Delete group"><Trash2 size={18} /></button></div><EmployeeTable employees={members.filter(e => e.fullName.toLowerCase().includes(query.toLowerCase()))} onOpen={onOpenEmployee} /></section>
    {modal === 'members' && <MembersModal group={group} employees={employees} onClose={() => setModal(false)} onMembership={onMembership} />}
  </div>;

  return <div className="groups-page">
    <div className="page-heading"><div><div className="eyebrow">ORGANISATION</div><h1>Groups & divisions</h1><p>Bring people together by team, site, division, or project crew.</p></div><button className="btn btn-primary" onClick={() => setModal('create')}><Plus size={17} />Create group</button></div>
    <div className="group-overview"><div><UsersRound size={20} /><span><strong>{groups.length}</strong> groups</span></div><p>{active.filter(e => e.groups.length).length} of {active.length} active employees belong to at least one group</p></div>
    <div className="groups-grid">{groups.map(group => {
      const count = employees.filter(e => e.groups.includes(group.id) && e.status !== 'Resigned' && e.status !== 'Terminated').length;
      const membersPreview = employees.filter(e => e.groups.includes(group.id)).slice(0, 4);
      const children = groups.filter(g => g.parentId === group.id);
      return <button className="group-card card" key={group.id} onClick={() => onSelect(group.id)}><div className="group-card-top"><div className="group-icon" style={{ background: `${group.color}18`, color: group.color }}><UsersRound size={22} /></div><ChevronRight size={19} /></div><h2>{group.name}</h2><p>{group.description}</p>{group.parentId && <span className="parent-group"><FolderTree size={13} />{groups.find(g => g.id === group.parentId)?.name}</span>}<div className="group-card-bottom"><div className="avatar-stack">{membersPreview.map(e => <Avatar key={e.id} employee={e} size="xs" />)}{count > 4 && <span>+{count - 4}</span>}</div><strong>{count} members</strong></div></button>;
    })}<button className="new-group-card" onClick={() => setModal('create')}><span><Plus size={22} /></span><strong>Create a new group</strong><p>Organise another part of your company</p></button></div>
    {modal === 'create' && <GroupModal groups={groups} employees={employees} onClose={() => setModal(false)} onSave={g => { onSaveGroup(g); setModal(false); }} />}
  </div>;
}

function GroupModal({ groups, employees, onClose, onSave }: { groups: Group[]; employees: Employee[]; onClose: () => void; onSave: (group: Group) => void }) {
  const [form, setForm] = useState({ name: '', description: '', lead: '', parentId: '' });
  return <Modal title="Create a group" subtitle="Organise people by team, division, site, or project" onClose={onClose}><form onSubmit={(e: FormEvent) => { e.preventDefault(); onSave({ ...form, parentId: form.parentId || undefined, id: crypto.randomUUID(), color: ['#6d5bd0', '#347c70', '#d17a56', '#5278bd'][groups.length % 4] }); }}><div className="modal-body"><div className="form-grid"><label className="field field-full"><span>Group name<em>*</em></span><input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Johannesburg team" /></label><label className="field field-full"><span>Short description</span><textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label className="field"><span>Group lead</span><select value={form.lead} onChange={e => setForm({ ...form, lead: e.target.value })}><option value="">No lead assigned</option>{employees.filter(e => e.status === 'Active').map(e => <option key={e.id}>{e.fullName}</option>)}</select></label><label className="field"><span>Parent group</span><select value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value })}><option value="">None — top-level group</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary"><Plus size={16} />Create group</button></div></form></Modal>;
}

function MembersModal({ group, employees, onClose, onMembership }: { group: Group; employees: Employee[]; onClose: () => void; onMembership: (employeeId: string, groupId: string, add: boolean) => void }) {
  const [query, setQuery] = useState('');
  return <Modal title={`Manage ${group.name}`} subtitle="Add or remove people from this group" onClose={onClose}><div className="modal-body member-modal"><SearchInput value={query} onChange={setQuery} placeholder="Find an employee..." /><div className="member-list">{employees.filter(e => e.fullName.toLowerCase().includes(query.toLowerCase())).map(employee => { const member = employee.groups.includes(group.id); return <div key={employee.id}><Avatar employee={employee} size="sm" /><div><strong>{employee.fullName}</strong><span>{employee.jobTitle}</span></div><button className={`btn btn-small ${member ? 'btn-secondary' : 'btn-primary'}`} onClick={() => onMembership(employee.id, group.id, !member)}>{member ? <><X size={14} />Remove</> : <><Plus size={14} />Add</>}</button></div>; })}</div></div><div className="modal-footer"><button className="btn btn-primary" onClick={onClose}>Done</button></div></Modal>;
}
