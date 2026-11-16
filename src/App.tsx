import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bell, Check, ChevronDown, ChevronRight, CircleHelp, Cloud, Download, FileArchive, FileSpreadsheet, FileText, LayoutDashboard, LockKeyhole, Menu, Plus, Search, Settings, ShieldCheck, Upload, UserRound, UsersRound, X } from 'lucide-react';
import { initialCustomFields, initialEmployees, initialGroups } from './data';
import { CustomField, Employee, Group } from './types';
import { Avatar, Modal, SearchInput, formatDate } from './components';
import { createWorkspaceZip, readWorkspaceBackup, WorkspaceImport } from './backup';
import Overview from './Overview';
import Directory from './Directory';
import Profile from './Profile';
import Groups from './Groups';
import SettingsPage from './Settings';
import EmployeeForm from './EmployeeForm';

const load = <T,>(key: string, fallback: T): T => { try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) : fallback; } catch { return fallback; } };

/**
 * Version 2 begins a fresh workspace: previously stored sample records are
 * removed once, then the HR team builds their own data from scratch.
 */
const STORAGE_VERSION = '2';
const STORAGE_KEYS = ['peopleflow-employees', 'peopleflow-groups', 'peopleflow-fields'];
const prepareStorage = () => {
  try {
    if (localStorage.getItem('peopleflow-storage-version') === STORAGE_VERSION) return;
    STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    localStorage.setItem('peopleflow-storage-version', STORAGE_VERSION);
  } catch { /* storage unavailable — the in-memory workspace still works */ }
};
prepareStorage();

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
  const [exportMenu, setExportMenu] = useState(false);
  const [importPreview, setImportPreview] = useState<WorkspaceImport>();
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const storageWarning = useRef(false);
  const [locked, setLocked] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = employees.find(e => e.id === selectedId);
  const currentCount = employees.filter(e => e.status === 'Active' || e.status === 'On leave').length;
  const onLeaveNow = employees.filter(e => e.status === 'On leave');
  const latestUpdated = [...employees].sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))[0];
  const searchResults = globalSearch.trim() ? employees.filter(e => [e.fullName, e.jobTitle, e.employeeNumber, e.department].some(v => v.toLowerCase().includes(globalSearch.toLowerCase()))).slice(0, 5) : [];

  const persist = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      storageWarning.current = false;
    } catch {
      if (!storageWarning.current) {
        storageWarning.current = true;
        notify('Browser storage is full — this change may not survive a reload. Remove large documents or lower the backup size.');
      }
    }
  };
  useEffect(() => { persist('peopleflow-employees', employees); }, [employees]);
  useEffect(() => { persist('peopleflow-groups', groups); }, [groups]);
  useEffect(() => { persist('peopleflow-fields', customFields); }, [customFields]);
  useEffect(() => { const fn = (e: KeyboardEvent) => { if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) { e.preventDefault(); searchRef.current?.focus(); } }; window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn); }, []);
  useEffect(() => {
    const closePanels = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.notifications-pop, .notification-btn')) setNotifications(false);
      if (!target.closest('.user-menu, .topbar-user')) setUserMenu(false);
      if (!target.closest('.topbar-export-trigger, .topbar-export-menu')) setExportMenu(false);
    };
    document.addEventListener('mousedown', closePanels);
    return () => document.removeEventListener('mousedown', closePanels);
  }, []);
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
  const backup = async () => {
    notify('Preparing your ZIP backup…');
    try {
      const { blob, fileName, counts } = await createWorkspaceZip(employees, groups, customFields);
      download(blob, fileName);
      const files = counts.documents + counts.photos;
      notify(`Backup downloaded · ${counts.employees} employees, ${counts.groups} groups, ${files} file${files === 1 ? '' : 's'}`);
    } catch {
      notify('The ZIP backup could not be created. Please try again.');
    }
  };

  const chooseImport = () => { setExportMenu(false); importRef.current?.click(); };
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    notify('Reading backup…');
    try {
      setImportPreview(await readWorkspaceBackup(file));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'That backup could not be read.');
    } finally {
      setImporting(false);
    }
  };
  const applyImport = () => {
    if (!importPreview) return;
    const { employees: importedEmployees, groups: importedGroups, customFields: importedFields, counts } = importPreview;
    setEmployees(importedEmployees);
    setGroups(importedGroups);
    setCustomFields(importedFields);
    setSelectedId(undefined);
    setSelectedGroup(undefined);
    setDirectoryStatus(undefined);
    setView('overview');
    setImportPreview(undefined);
    notify(`Backup restored · ${counts.employees} employees, ${counts.groups} groups, ${counts.documents + counts.photos} files`);
  };

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
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)}><Menu size={21} /></button><span className="breadcrumb">{view === 'overview' ? 'Overview' : view === 'directory' ? 'Employee directory' : view === 'profile' ? selected?.fullName : view === 'groups' ? 'Groups & divisions' : 'Workspace settings'}</span></div><div className="topbar-right"><div className="global-search-wrap"><label className="global-search"><Search size={17} /><input ref={searchRef} value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} onFocus={() => setSearchFocus(true)} onBlur={() => setTimeout(() => setSearchFocus(false), 150)} placeholder="Search employees..." /><kbd>/</kbd></label>{searchFocus && globalSearch && <div className="search-results">{searchResults.map(e => <button key={e.id} onMouseDown={() => openEmployee(e.id)}><Avatar employee={e} size="sm" /><div><strong>{e.fullName}</strong><span>{e.jobTitle} · {e.department}</span></div><ChevronRight size={15} /></button>)}{!searchResults.length && <div className="no-search-results">No matching employees</div>}</div>}</div><div className="workspace-chip"><UsersRound size={15} /><span>Peopleflow HR</span><ChevronDown size={12} /></div><div className="topbar-actions"><div className="relative"><button className="btn btn-secondary topbar-export-trigger" onClick={() => setExportMenu(!exportMenu)} aria-haspopup="true" aria-expanded={exportMenu}><Download size={14} /><span>Export</span><ChevronDown size={12} /></button>{exportMenu && <div className="export-menu topbar-export-menu"><button onClick={() => { setExportMenu(false); backup(); }}><FileArchive size={16} /><span>Full backup (.zip)<small>Every record, group, and file</small></span></button><button onClick={() => { setExportMenu(false); exportCsv(employees); }}><FileSpreadsheet size={16} /><span>Employee list (.csv)<small>Spreadsheet for reporting</small></span></button><div className="export-menu-divider" /><button onClick={chooseImport}><Upload size={16} /><span>Import backup<small>Restore a .zip or .json backup</small></span></button></div>}</div><button className="btn btn-primary" onClick={() => setEmployeeModal('add')}><Plus size={15} /><span>Add employee</span></button></div><div className="relative"><button className="icon-btn notification-btn" onClick={() => setNotifications(!notifications)} aria-label="Notifications"><Bell size={19} />{(onLeaveNow.length > 0 || latestUpdated) && <i />}</button>{notifications && <div className="notifications-pop"><div className="pop-head"><strong>Notifications</strong><button onClick={() => setNotifications(false)} aria-label="Close notifications"><X size={16} /></button></div>{onLeaveNow.length > 0 && <div className="notification-item"><span className="notification-icon amber"><UserRound size={17} /></span><div><strong>{onLeaveNow.length} {onLeaveNow.length === 1 ? 'person is' : 'people are'} on leave</strong><p>{onLeaveNow.map(e => e.fullName.split(' ')[0]).join(' and ')} currently away.</p><small>Today</small></div></div>}{latestUpdated && <div className="notification-item"><span className="notification-icon green"><FileText size={17} /></span><div><strong>Profile recently updated</strong><p>{latestUpdated.fullName}’s employee record was updated.</p><small>Latest change</small></div></div>}{!onLeaveNow.length && !latestUpdated && <div className="notification-empty"><Bell size={22} /><strong>No notifications yet</strong><p>Employee updates will appear here once you add people.</p></div>}<button className="notifications-done" onClick={() => setNotifications(false)}>Mark all as read</button></div>}</div><div className="topbar-divider" /><div className="relative"><button className="topbar-user" onClick={() => setUserMenu(!userMenu)}><div className="user-avatar">SN</div><span>Sarah</span><ChevronDown size={14} /></button>{userMenu && <div className="context-menu user-menu"><div><strong>Sarah Ndlovu</strong><span>sarah@peopleflow.co.za</span></div><button onClick={() => { navigate('settings'); setUserMenu(false); }}><Settings size={16} />Workspace settings</button><button onClick={() => { setLocked(true); setUserMenu(false); }}><LockKeyhole size={16} />Lock workspace</button></div>}</div></div></header>
      <div className="page-content">
        {view === 'overview' && <Overview employees={employees} onOpen={openEmployee} onDirectory={openDirectory} onAdd={() => setEmployeeModal('add')} onExport={() => exportCsv(employees)} />}
        {view === 'directory' && <Directory key={directoryStatus || 'default'} employees={employees} groups={groups} initialStatus={directoryStatus} onOpen={openEmployee} onAdd={() => setEmployeeModal('add')} onExport={list => exportCsv(list, 'peopleflow-directory')} />}
        {view === 'profile' && selected && <Profile employee={selected} groups={groups} customFields={customFields} onBack={() => navigate('directory')} onEdit={() => setEmployeeModal('edit')} onUpdate={updateEmployee} onGroup={id => { setSelectedGroup(id); setView('groups'); }} notify={notify} />}
        {view === 'groups' && <Groups employees={employees} groups={groups} selectedId={selectedGroup} onSelect={setSelectedGroup} onOpenEmployee={openEmployee} onSaveGroup={saveGroup} onDeleteGroup={id => { setGroups(list => list.filter(g => g.id !== id)); setEmployees(list => list.map(e => ({ ...e, groups: e.groups.filter(g => g !== id) }))); setSelectedGroup(undefined); notify('Group deleted'); }} onMembership={membership} onExport={group => exportCsv(employees.filter(e => e.groups.includes(group.id)), group.name.toLowerCase().replaceAll(' ', '-'))} />}
        {view === 'settings' && <SettingsPage customFields={customFields} onAdd={field => { setCustomFields(list => [...list, field]); notify('Custom field added'); }} onDelete={id => { const field = customFields.find(f => f.id === id); setCustomFields(list => list.filter(f => f.id !== id)); if (field) setEmployees(list => list.map(e => { const custom = { ...e.custom }; delete custom[field.label]; return { ...e, custom }; })); notify('Custom field removed'); }} onBackup={backup} onImport={chooseImport} onReset={() => { setEmployees(initialEmployees); setGroups(initialGroups); setCustomFields(initialCustomFields); setSelectedId(undefined); setSelectedGroup(undefined); setDirectoryStatus(undefined); notify('Workspace cleared — start by adding your first employee'); }} notify={notify} />}
      </div>
      <footer className="app-footer"><span><Cloud size={14} />All changes saved locally</span><span>Peopleflow · Your people, organised.</span></footer>
    </main>
    {employeeModal && <EmployeeForm employee={employeeModal === 'edit' ? selected : undefined} customFields={customFields} onClose={() => setEmployeeModal(false)} onSave={saveEmployee} />}
    <input ref={importRef} type="file" accept=".zip,.json,application/zip,application/json" hidden disabled={importing} onChange={handleImportFile} />
    {importPreview && <ImportModal data={importPreview} onCancel={() => setImportPreview(undefined)} onConfirm={applyImport} />}
    {importing && <span className="sr-only" role="status">Reading backup…</span>}
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

function ImportModal({ data, onCancel, onConfirm }: { data: WorkspaceImport; onCancel: () => void; onConfirm: () => void }) {
  const files = data.counts.documents + data.counts.photos;
  const size = data.bytes > 1024 * 1024 ? `${(data.bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(data.bytes / 1024))} KB`;
  const large = data.bytes > 3500000;
  return <Modal title="Import this backup?" subtitle="Review what will be restored before replacing your workspace" onClose={onCancel}>
    <div className="modal-body">
      <div className="import-counts">
        <div><strong>{data.counts.employees}</strong><span>employees</span></div>
        <div><strong>{data.counts.groups}</strong><span>groups</span></div>
        <div><strong>{data.counts.customFields}</strong><span>custom fields</span></div>
        <div><strong>{files}</strong><span>stored files</span></div>
      </div>
      <div className="import-note">
        <AlertTriangle size={17} />
        <p>Everything currently in this browser — every employee, group, custom field, document, and photo — will be replaced by this backup. Only workspace data is imported; the app itself is left untouched.</p>
      </div>
      {data.source === 'json' && <p className="import-warning">This is an older JSON backup, so document and photo files were not included. Their details will be restored without the original files.</p>}
      {data.warnings.map(warning => <p className="import-warning" key={warning}>{warning}</p>)}
      {large && <p className="import-warning">This backup is {size}. Browser storage is limited (about 5 MB), so some large files may not be saved after a reload.</p>}
      {!large && data.bytes > 0 && <p className="import-meta">Files to restore: {size}</p>}
    </div>
    <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="button" className="btn btn-danger" onClick={onConfirm}><Upload size={16} />Import and replace</button></div>
  </Modal>;
}
