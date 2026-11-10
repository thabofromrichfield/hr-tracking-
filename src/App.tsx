import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, ChevronDown, ChevronRight, CircleHelp, Cloud, Download, FileText, LayoutDashboard, LockKeyhole, Menu, Plus, Search, Settings, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react';
import { initialCustomFields, initialEmployees, initialGroups } from './data';
import { CustomField, Employee, Group } from './types';
import { Avatar, SearchInput } from './components';
import Overview from './Overview';
import Directory from './Directory';
import Profile from './Profile';
import Groups from './Groups';
import SettingsPage from './Settings';
import EmployeeForm from './EmployeeForm';

const load = <T,>(key: string, fallback: T): T => { try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) : fallback; } catch { return fallback; } };
type View = 'overview' | 'directory' | 'profile' | 'groups' | 'settings';

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>(() => load('peopleflow-employees', initialEmployees));
  const [groups, setGroups] = useState<Group[]>(() => load('peopleflow-groups', initialGroups));
  const [customFields, setCustomFields] = useState<CustomField[]>(() => load('peopleflow-fields', initialCustomFields));
  const [view, setView] = useState<View>('overview');
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedGroup, setSelectedGroup] = useState<string>();
  const [directoryStatus, setDirectoryStatus] = useState<string>();
  const [employeeModal, setEmployeeModal] = useState<'add' | 'edit' | false>(false);
  const [toast, setToast] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [locked, setLocked] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = employees.find(e => e.id === selectedId);
  const currentCount = employees.filter(e => e.status === 'Active' || e.status === 'On leave').length;
  const searchResults = globalSearch.trim() ? employees.filter(e => [e.fullName, e.jobTitle, e.employeeNumber, e.department].some(v => v.toLowerCase().includes(globalSearch.toLowerCase()))).slice(0, 5) : [];

  useEffect(() => { localStorage.setItem('peopleflow-employees', JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem('peopleflow-groups', JSON.stringify(groups)); }, [groups]);
  useEffect(() => { localStorage.setItem('peopleflow-fields', JSON.stringify(customFields)); }, [customFields]);
  useEffect(() => { const fn = (e: KeyboardEvent) => { if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) { e.preventDefault(); searchRef.current?.focus(); } }; window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); } }, [toast]);

  const notify = (message: string) => setToast(message);
  const navigate = (next: View) => { setView(next); setMobileNav(false); setSelectedGroup(undefined); setGlobalSearch(''); if (next !== 'directory') setDirectoryStatus(undefined); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const openEmployee = (id: string) => { setSelectedId(id); setView('profile'); setGlobalSearch(''); setSearchFocus(false); setMobileNav(false); window.scrollTo(0, 0); };
  const openDirectory = (status?: string) => { setDirectoryStatus(status); setView('directory'); };
  const saveEmployee = (data: Omit<Employee, 'id' | 'lastUpdated' | 'workHistory' | 'documents' | 'groups'>) => {
    if (employeeModal === 'edit' && selected) { setEmployees(list => list.map(e => e.id === selected.id ? { ...e, ...data, lastUpdated: new Date().toISOString() } : e)); notify('Employee profile updated'); }
    else { const employee: Employee = { ...data, id: crypto.randomUUID(), custom: { ...data.custom }, groups: [], workHistory: [], documents: [], lastUpdated: new Date().toISOString() }; setEmployees(list => [...list, employee]); setSelectedId(employee.id); setView('profile'); notify(`${employee.fullName} added to your team`); }
    setEmployeeModal(false);
  };
  const updateEmployee = (employee: Employee, message: string) => { setEmployees(list => list.map(e => e.id === employee.id ? employee : e)); notify(message); };
  const exportCsv = (list: Employee[], filename = 'peopleflow-employees') => {
    const headers = ['Full name', 'Employee number', 'ID number', 'Job title', 'Department', 'Manager', 'Employment type', 'Status', 'Start date', 'End date', 'Email', 'Phone', 'Groups'];
    const rows = list.map(e => [e.fullName, e.employeeNumber, e.idNumber, e.jobTitle, e.department, e.manager, e.employmentType, e.status, e.startDate, e.endDate || '', e.email, e.phone, e.groups.map(id => groups.find(g => g.id === id)?.name).filter(Boolean).join('; ')]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
    download(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `${filename}-${new Date().toISOString().slice(0, 10)}.csv`); notify(`${list.length} employee records exported`);
  };
  const saveGroup = (group: Group) => { setGroups(list => [...list, group]); setSelectedGroup(group.id); notify(`${group.name} created`); };
  const membership = (employeeId: string, groupId: string, add: boolean) => setEmployees(list => list.map(e => e.id === employeeId ? { ...e, groups: add ? [...e.groups, groupId] : e.groups.filter(id => id !== groupId), lastUpdated: new Date().toISOString() } : e));
  const backup = () => { download(new Blob([JSON.stringify({ employees, groups, customFields, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }), 'peopleflow-backup.json'); notify('Workspace backup downloaded'); };

  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;

  return <div className="app-shell">
    {mobileNav && <div className="nav-overlay" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
      <div className="sidebar-top-space" aria-hidden="true" />
      <div className="sidebar-workspace-label">HR MANAGEMENT</div>
      <nav className="main-nav"><span className="nav-label">WORKSPACE</span><NavItem icon={<LayoutDashboard size={19} />} label="Overview" active={view === 'overview'} onClick={() => navigate('overview')} /><NavItem icon={<UsersRound size={19} />} label="Employees" active={view === 'directory' || view === 'profile'} badge={currentCount} onClick={() => navigate('directory')} /><NavItem icon={<UserRound size={19} />} label="Groups & divisions" active={view === 'groups'} onClick={() => navigate('groups')} /><span className="nav-label nav-label-second">MANAGE</span><NavItem icon={<Settings size={19} />} label="Settings" active={view === 'settings'} onClick={() => navigate('settings')} /></nav>
      <div className="sidebar-bottom"><div className="quick-add"><div className="quick-add-icon"><Plus size={20} /></div><h3>Grow your team</h3><p>Add a new employee and keep every detail in one place.</p><button onClick={() => setEmployeeModal('add')}>Register employee<ChevronRight size={14} /></button></div><button className="help-link" onClick={() => notify('Help centre: use / to search, or open Settings to manage your workspace')}><CircleHelp size={18} /><span>Help & shortcuts</span><kbd>?</kbd></button><div className="sidebar-copyright">© 2026 Peopleflow HR<br /><span>Private & secure workspace</span></div></div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)}><Menu size={21} /></button><span className="breadcrumb">{view === 'overview' ? 'Overview' : view === 'directory' ? 'Employee directory' : view === 'profile' ? selected?.fullName : view === 'groups' ? 'Groups & divisions' : 'Workspace settings'}</span></div><div className="topbar-right"><div className="global-search-wrap"><label className="global-search"><Search size={17} /><input ref={searchRef} value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} onFocus={() => setSearchFocus(true)} onBlur={() => setTimeout(() => setSearchFocus(false), 150)} placeholder="Search employees..." /><kbd>/</kbd></label>{searchFocus && globalSearch && <div className="search-results">{searchResults.map(e => <button key={e.id} onMouseDown={() => openEmployee(e.id)}><Avatar employee={e} size="sm" /><div><strong>{e.fullName}</strong><span>{e.jobTitle} · {e.department}</span></div><ChevronRight size={15} /></button>)}{!searchResults.length && <div className="no-search-results">No matching employees</div>}</div>}</div><div className="workspace-chip"><UsersRound size={15} /><span>Peopleflow HR</span><ChevronDown size={12} /></div><div className="relative"><button className="icon-btn notification-btn" onClick={() => setNotifications(!notifications)}><Bell size={19} /><i /></button>{notifications && <div className="notifications-pop"><div className="pop-head"><strong>Notifications</strong><button onClick={() => setNotifications(false)}><X size={16} /></button></div><div className="notification-item"><span className="notification-icon amber"><UserRound size={17} /></span><div><strong>2 people are on leave</strong><p>Sipho and Maya are currently away.</p><small>Today</small></div></div><div className="notification-item"><span className="notification-icon green"><FileText size={17} /></span><div><strong>Profile recently updated</strong><p>Naledi’s employee record was updated.</p><small>2 days ago</small></div></div><button className="notifications-done" onClick={() => setNotifications(false)}>Mark all as read</button></div>}</div><div className="topbar-divider" /><div className="relative"><button className="topbar-user" onClick={() => setUserMenu(!userMenu)}><div className="user-avatar">SN</div><span>Sarah</span><ChevronDown size={14} /></button>{userMenu && <div className="context-menu user-menu"><div><strong>Sarah Ndlovu</strong><span>sarah@peopleflow.co.za</span></div><button onClick={() => { navigate('settings'); setUserMenu(false); }}><Settings size={16} />Workspace settings</button><button onClick={() => { setLocked(true); setUserMenu(false); }}><LockKeyhole size={16} />Lock workspace</button></div>}</div></div></header>
      <div className="page-content">
        {view === 'overview' && <Overview employees={employees} onOpen={openEmployee} onDirectory={openDirectory} onAdd={() => setEmployeeModal('add')} onExport={() => exportCsv(employees)} />}
        {view === 'directory' && <Directory key={directoryStatus || 'default'} employees={employees} groups={groups} initialStatus={directoryStatus} onOpen={openEmployee} onAdd={() => setEmployeeModal('add')} onExport={list => exportCsv(list, 'peopleflow-directory')} />}
        {view === 'profile' && selected && <Profile employee={selected} groups={groups} customFields={customFields} onBack={() => navigate('directory')} onEdit={() => setEmployeeModal('edit')} onUpdate={updateEmployee} onGroup={id => { setSelectedGroup(id); setView('groups'); }} notify={notify} />}
        {view === 'groups' && <Groups employees={employees} groups={groups} selectedId={selectedGroup} onSelect={setSelectedGroup} onOpenEmployee={openEmployee} onSaveGroup={saveGroup} onDeleteGroup={id => { setGroups(list => list.filter(g => g.id !== id)); setEmployees(list => list.map(e => ({ ...e, groups: e.groups.filter(g => g !== id) }))); setSelectedGroup(undefined); notify('Group deleted'); }} onMembership={membership} onExport={group => exportCsv(employees.filter(e => e.groups.includes(group.id)), group.name.toLowerCase().replaceAll(' ', '-'))} />}
        {view === 'settings' && <SettingsPage customFields={customFields} onAdd={field => { setCustomFields(list => [...list, field]); notify('Custom field added'); }} onDelete={id => { const field = customFields.find(f => f.id === id); setCustomFields(list => list.filter(f => f.id !== id)); if (field) setEmployees(list => list.map(e => { const custom = { ...e.custom }; delete custom[field.label]; return { ...e, custom }; })); notify('Custom field removed'); }} onBackup={backup} onReset={() => { setEmployees(initialEmployees); setGroups(initialGroups); setCustomFields(initialCustomFields); notify('Sample workspace restored'); }} notify={notify} />}
      </div>
      <footer className="app-footer"><span><Cloud size={14} />All changes saved locally</span><span>Peopleflow · Your people, organised.</span></footer>
    </main>
    {employeeModal && <EmployeeForm employee={employeeModal === 'edit' ? selected : undefined} customFields={customFields} onClose={() => setEmployeeModal(false)} onSave={saveEmployee} />}
    {toast && <div className="toast"><span><Check size={15} /></span>{toast}<button onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>;
}

function NavItem({ icon, label, active, badge, onClick }: { icon: React.ReactNode; label: string; active: boolean; badge?: number; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{badge !== undefined && <b>{badge}</b>}</button>;
}
function download(blob: Blob, name: string) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  return <div className="lock-screen"><form className="lock-card" onSubmit={e => { e.preventDefault(); onUnlock(); }}><div className="lock-icon"><LockKeyhole size={25} /></div><h1>Welcome back, Sarah</h1><p>Your private HR workspace is locked.</p><div className="lock-user"><div className="user-avatar">SN</div><div><strong>Sarah Ndlovu</strong><span>HR Administrator</span></div></div><label className="field"><span>Password</span><input type="password" required autoFocus value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" /></label><button className="btn btn-primary">Unlock workspace</button><small><ShieldCheck size={14} />Authorised HR users only</small></form><p className="lock-foot">Employee information is personal. Handle it with care.</p></div>;
}
