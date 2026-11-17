import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Building2, CalendarCheck, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, Cloud, Clock, Download, FileArchive, FileSpreadsheet, FileText, LayoutDashboard, LockKeyhole, Menu, Plus, Receipt, Search, Settings, ShieldAlert, ShieldCheck, Upload, UserRound, UsersRound, X } from 'lucide-react';
import { initialBranches, initialCustomFields, initialEmployees } from './data';
import { Branch, CustomField, Employee, LeaveRequest, Payslip, TimeEntry, Warning } from './types';
import { Avatar, Modal } from './components';
import { createWorkspaceZip, readWorkspaceBackup, WorkspaceImport } from './backup';
import { coversDate, downloadFile, localDate } from './time';
import Overview from './Overview';
import Directory from './Directory';
import Profile from './Profile';
import Branches from './Branches';
import SettingsPage from './Settings';
import EmployeeForm from './EmployeeForm';
import Timesheets, { exportTimesheets } from './Timesheets';
import Attendance from './Attendance';
import Leave from './Leave';
import Payslips from './Payslips';
import WarningsPage from './Warnings';

const load = <T,>(key: string, fallback: T): T => { try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) : fallback; } catch { return fallback; } };

/** Version 3 introduced branches, time, leave, payslips, and warnings. */
const STORAGE_VERSION = '3';
const STORAGE_KEYS = ['peopleflow-employees', 'peopleflow-branches', 'peopleflow-groups', 'peopleflow-fields', 'peopleflow-timesheets', 'peopleflow-leave', 'peopleflow-payslips', 'peopleflow-warnings'];
const prepareStorage = () => {
  try {
    if (localStorage.getItem('peopleflow-storage-version') === STORAGE_VERSION) return;
    STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    localStorage.setItem('peopleflow-storage-version', STORAGE_VERSION);
  } catch { /* storage unavailable — the in-memory workspace still works */ }
};
prepareStorage();

type View = 'overview' | 'directory' | 'profile' | 'branches' | 'timesheets' | 'attendance' | 'leave' | 'payslips' | 'warnings' | 'settings';

const BOM = '\ufeff';

const pageTitles: Record<View, string> = {
  overview: 'Overview',
  directory: 'Employee directory',
  profile: 'Employee profile',
  branches: 'Branches',
  timesheets: 'Timesheets',
  attendance: 'Attendance',
  leave: 'Leave requests',
  payslips: 'Payslips',
  warnings: 'Warnings',
  settings: 'Workspace settings',
};

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>(() => load('peopleflow-employees', initialEmployees));
  const [branches, setBranches] = useState<Branch[]>(() => load('peopleflow-branches', initialBranches));
  const [customFields, setCustomFields] = useState<CustomField[]>(() => load('peopleflow-fields', initialCustomFields));
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(() => load('peopleflow-timesheets', []));
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => load('peopleflow-leave', []));
  const [payslips, setPayslips] = useState<Payslip[]>(() => load('peopleflow-payslips', []));
  const [warnings, setWarnings] = useState<Warning[]>(() => load('peopleflow-warnings', []));
  const [view, setView] = useState<View>('overview');
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedBranchId, setSelectedBranchId] = useState<string>();
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
  const [locked, setLocked] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const storageWarning = useRef(false);
  const selected = employees.find(employee => employee.id === selectedId);
  const currentCount = employees.filter(employee => employee.status === 'Active' || employee.status === 'On leave').length;
  const today = localDate();
  const pendingLeave = leaveRequests.filter(request => request.status === 'Pending').length;
  const onLeaveToday = employees.filter(employee => employee.status === 'On leave' || leaveRequests.some(request => request.employeeId === employee.id && request.status === 'Approved' && coversDate(request.startDate, request.endDate, today)));
  const latestUpdated = [...employees].sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))[0];
  const searchResults = globalSearch.trim() ? employees.filter(employee => [employee.fullName, employee.jobTitle, employee.employeeNumber, employee.department].some(value => value.toLowerCase().includes(globalSearch.toLowerCase()))).slice(0, 5) : [];

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
  useEffect(() => { persist('peopleflow-branches', branches); }, [branches]);
  useEffect(() => { persist('peopleflow-fields', customFields); }, [customFields]);
  useEffect(() => { persist('peopleflow-timesheets', timeEntries); }, [timeEntries]);
  useEffect(() => { persist('peopleflow-leave', leaveRequests); }, [leaveRequests]);
  useEffect(() => { persist('peopleflow-payslips', payslips); }, [payslips]);
  useEffect(() => { persist('peopleflow-warnings', warnings); }, [warnings]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) { event.preventDefault(); searchRef.current?.focus(); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
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
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer); } }, [toast]);

  const notify = (message: string) => setToast(message);
  const navigate = (next: View) => { setView(next); setMobileNav(false); setSelectedBranchId(undefined); setGlobalSearch(''); if (next !== 'directory') setDirectoryStatus(undefined); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const openEmployee = (id: string) => { setSelectedId(id); setView('profile'); setGlobalSearch(''); setSearchFocus(false); setMobileNav(false); window.scrollTo(0, 0); };
  const openDirectory = (status?: string) => { setDirectoryStatus(status); setView('directory'); };
  const openBranch = (id?: string) => { setSelectedBranchId(id); setView('branches'); };

  const saveEmployee = (data: Omit<Employee, 'id' | 'lastUpdated' | 'workHistory' | 'documents'>) => {
    const clean: Omit<Employee, 'id' | 'lastUpdated' | 'workHistory' | 'documents'> = { ...data, branchId: data.branchId || undefined, monthlySalary: Number(data.monthlySalary) || 0 };
    if (employeeModal === 'edit' && selected) { setEmployees(list => list.map(employee => employee.id === selected.id ? { ...employee, ...clean, lastUpdated: new Date().toISOString() } : employee)); notify('Employee profile updated'); }
    else {
      const employee: Employee = { ...clean, id: crypto.randomUUID(), custom: { ...data.custom }, workHistory: [], documents: [], lastUpdated: new Date().toISOString() };
      setEmployees(list => [...list, employee]);
      setSelectedId(employee.id);
      setView('profile');
      notify(`${employee.fullName} added to your team`);
    }
    setEmployeeModal(false);
  };
  const updateEmployee = (employee: Employee, message: string) => { setEmployees(list => list.map(item => item.id === employee.id ? employee : item)); notify(message); };

  const exportCsv = (list: Employee[], filename = 'peopleflow-employees') => {
    const headers = ['Full name', 'Employee number', 'ID number', 'Job title', 'Department', 'Branch', 'Manager', 'Employment type', 'Status', 'Start date', 'End date', 'Email', 'Phone', 'Monthly salary'];
    const rows = list.map(employee => [employee.fullName, employee.employeeNumber, employee.idNumber, employee.jobTitle, employee.department, branches.find(branch => branch.id === employee.branchId)?.name || '', employee.manager, employee.employmentType, employee.status, employee.startDate, employee.endDate || '', employee.email, employee.phone, employee.monthlySalary || 0]);
    const csv = BOM + [headers, ...rows].map(row => row.map(value => "\"" + String(value ?? '').replaceAll('"', '""') + "\"").join(',')).join('\n');
    downloadFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filename}-${today}.csv`);
    notify(`${list.length} employee records exported`);
  };

  const saveBranch = (branch: Branch) => { setBranches(list => [...list, branch]); setSelectedBranchId(branch.id); notify(`${branch.name} branch added`); };
  const assignBranch = (employeeId: string, branchId?: string) => setEmployees(list => list.map(employee => employee.id === employeeId ? { ...employee, branchId, lastUpdated: new Date().toISOString() } : employee));
  const deleteBranch = (id: string) => { setBranches(list => list.filter(branch => branch.id !== id)); setEmployees(list => list.map(employee => employee.branchId === id ? { ...employee, branchId: undefined } : employee)); setSelectedBranchId(undefined); notify('Branch deleted'); };

  const saveTimeEntry = (entry: TimeEntry) => setTimeEntries(list => list.some(item => item.id === entry.id) ? list.map(item => item.id === entry.id ? entry : item) : [entry, ...list]);
  const approveTimeEntries = (ids: string[], approved: boolean) => setTimeEntries(list => list.map(entry => ids.includes(entry.id) ? { ...entry, approved } : entry));
  const saveLeave = (request: LeaveRequest) => setLeaveRequests(list => [request, ...list]);
  const updateLeave = (request: LeaveRequest) => setLeaveRequests(list => list.map(item => item.id === request.id ? request : item));
  const savePayslips = (slips: Payslip[]) => { setPayslips(list => [...slips, ...list]); notify(`${slips.length} payslip${slips.length === 1 ? '' : 's'} generated`); };
  const updatePayslip = (slip: Payslip) => setPayslips(list => list.map(item => item.id === slip.id ? slip : item));
  const saveWarning = (warning: Warning) => setWarnings(list => [warning, ...list]);
  const updateWarning = (warning: Warning) => setWarnings(list => list.map(item => item.id === warning.id ? warning : item));

  const backup = async () => {
    notify('Preparing your ZIP backup…');
    try {
      const { blob, fileName, counts } = await createWorkspaceZip(employees, branches, customFields, timeEntries, leaveRequests, payslips, warnings);
      downloadFile(blob, fileName);
      notify(`Backup downloaded · ${counts.employees} employees, ${counts.timeEntries} time entries, ${counts.payslips} payslips`);
    } catch {
      notify('The ZIP backup could not be created. Please try again.');
    }
  };

  const chooseImport = () => { setExportMenu(false); importRef.current?.click(); };
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    notify('Reading backup…');
    try {
      setImportPreview(await readWorkspaceBackup(file));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'That backup could not be read.');
    }
  };
  const applyImport = () => {
    if (!importPreview) return;
    setEmployees(importPreview.employees);
    setBranches(importPreview.branches);
    setCustomFields(importPreview.customFields);
    setTimeEntries(importPreview.timeEntries);
    setLeaveRequests(importPreview.leaveRequests);
    setPayslips(importPreview.payslips);
    setWarnings(importPreview.warnings);
    setSelectedId(undefined);
    setSelectedBranchId(undefined);
    setDirectoryStatus(undefined);
    setView('overview');
    setImportPreview(undefined);
    notify(`Backup restored · ${importPreview.counts.employees} employees and ${importPreview.counts.timeEntries} time entries`);
  };

  const clearWorkspace = () => {
    setEmployees(initialEmployees);
    setBranches(initialBranches);
    setCustomFields(initialCustomFields);
    setTimeEntries([]);
    setLeaveRequests([]);
    setPayslips([]);
    setWarnings([]);
    setSelectedId(undefined);
    setSelectedBranchId(undefined);
    setDirectoryStatus(undefined);
    notify('Workspace cleared — start by adding your first employee');
  };

  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;

  return <div className="app-shell">
    {mobileNav && <div className="nav-overlay" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
      <div className="sidebar-top-space" aria-hidden="true" />
      <div className="sidebar-workspace-label">HR MANAGEMENT</div>
      <nav className="main-nav">
        <span className="nav-label">WORKSPACE</span>
        <NavItem icon={<LayoutDashboard size={19} />} label="Overview" active={view === 'overview'} onClick={() => navigate('overview')} />
        <NavItem icon={<UsersRound size={19} />} label="Employees" active={view === 'directory' || view === 'profile'} badge={currentCount} onClick={() => navigate('directory')} />
        <NavItem icon={<Building2 size={19} />} label="Branches" active={view === 'branches'} onClick={() => navigate('branches')} />
        <NavItem icon={<Clock size={19} />} label="Timesheets" active={view === 'timesheets'} onClick={() => navigate('timesheets')} />
        <NavItem icon={<CalendarCheck size={19} />} label="Attendance" active={view === 'attendance'} onClick={() => navigate('attendance')} />
        <NavItem icon={<CalendarDays size={19} />} label="Leave requests" active={view === 'leave'} badge={pendingLeave || undefined} onClick={() => navigate('leave')} />
        <span className="nav-label nav-label-second">PAYROLL</span>
        <NavItem icon={<Receipt size={19} />} label="Payslips" active={view === 'payslips'} onClick={() => navigate('payslips')} />
        <span className="nav-label nav-label-second">MANAGE</span>
        <NavItem icon={<ShieldAlert size={19} />} label="Warnings" active={view === 'warnings'} onClick={() => navigate('warnings')} />
        <NavItem icon={<Settings size={19} />} label="Settings" active={view === 'settings'} onClick={() => navigate('settings')} />
      </nav>
      <div className="sidebar-bottom"><div className="quick-add"><div className="quick-add-icon"><Plus size={20} /></div><h3>Grow your team</h3><p>Add a new employee and keep every detail in one place.</p><button onClick={() => setEmployeeModal('add')}>Register employee<ChevronRight size={14} /></button></div><button className="help-link" onClick={() => notify('Help centre: use / to search, or open Settings to manage your workspace')}><CircleHelp size={18} /><span>Help & shortcuts</span><kbd>?</kbd></button><div className="sidebar-copyright">© 2026 Peopleflow HR<br /><span>Private & secure workspace</span></div></div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={21} /></button><span className="breadcrumb">{view === 'profile' ? selected?.fullName || pageTitles.profile : pageTitles[view]}</span></div><div className="topbar-right">
        <div className="global-search-wrap"><label className="global-search"><Search size={17} /><input ref={searchRef} value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} onFocus={() => setSearchFocus(true)} onBlur={() => setTimeout(() => setSearchFocus(false), 150)} placeholder="Search employees..." /><kbd>/</kbd></label>{searchFocus && globalSearch && <div className="search-results">{searchResults.map(employee => <button key={employee.id} onMouseDown={() => openEmployee(employee.id)}><Avatar employee={employee} size="sm" /><div><strong>{employee.fullName}</strong><span>{employee.jobTitle} · {employee.department}</span></div><ChevronRight size={15} /></button>)}{!searchResults.length && <div className="no-search-results">No matching employees</div>}</div>}</div>
        <div className="workspace-chip"><UsersRound size={15} /><span>Peopleflow HR</span><ChevronDown size={12} /></div>
        <div className="topbar-actions"><div className="relative"><button className="btn btn-secondary topbar-export-trigger" onClick={() => setExportMenu(!exportMenu)} aria-haspopup="true" aria-expanded={exportMenu}><Download size={14} /><span>Export</span><ChevronDown size={12} /></button>{exportMenu && <div className="export-menu topbar-export-menu"><button onClick={() => { setExportMenu(false); backup(); }}><FileArchive size={16} /><span>Full backup (.zip)<small>Every record, group, and file</small></span></button><button onClick={() => { setExportMenu(false); exportCsv(employees); }}><FileSpreadsheet size={16} /><span>Employee list (.csv)<small>Spreadsheet for reporting</small></span></button><div className="export-menu-divider" /><button onClick={chooseImport}><Upload size={16} /><span>Import backup<small>Restore a .zip or .json backup</small></span></button></div>}</div><button className="btn btn-primary" onClick={() => setEmployeeModal('add')}><Plus size={15} /><span>Add employee</span></button></div>
        <div className="relative"><button className="icon-btn notification-btn" onClick={() => setNotifications(!notifications)} aria-label="Notifications"><Bell size={19} />{(onLeaveToday.length > 0 || pendingLeave > 0 || latestUpdated) && <i />}</button>{notifications && <div className="notifications-pop"><div className="pop-head"><strong>Notifications</strong><button onClick={() => setNotifications(false)} aria-label="Close notifications"><X size={16} /></button></div>{pendingLeave > 0 && <div className="notification-item"><span className="notification-icon amber"><CalendarDays size={17} /></span><div><strong>{pendingLeave} leave request{pendingLeave === 1 ? '' : 's'} to review</strong><p>Approve or decline time off from the leave page.</p><small>Today</small></div></div>}{onLeaveToday.length > 0 && <div className="notification-item"><span className="notification-icon green"><UserRound size={17} /></span><div><strong>{onLeaveToday.length} {onLeaveToday.length === 1 ? 'person is' : 'people are'} away today</strong><p>{onLeaveToday.map(employee => employee.fullName.split(' ')[0]).join(' and ')}.</p><small>Today</small></div></div>}{latestUpdated && <div className="notification-item"><span className="notification-icon green"><FileText size={17} /></span><div><strong>Profile recently updated</strong><p>{latestUpdated.fullName}’s employee record was updated.</p><small>Latest change</small></div></div>}{!onLeaveToday.length && !pendingLeave && !latestUpdated && <div className="notification-empty"><Bell size={22} /><strong>No notifications yet</strong><p>Employee updates will appear here once you add people.</p></div>}<button className="notifications-done" onClick={() => setNotifications(false)}>Mark all as read</button></div>}</div>
        <div className="topbar-divider" /><div className="relative"><button className="topbar-user" onClick={() => setUserMenu(!userMenu)}><div className="user-avatar">SN</div><span>Sarah</span><ChevronDown size={14} /></button>{userMenu && <div className="context-menu user-menu"><div><strong>Sarah Ndlovu</strong><span>sarah@peopleflow.co.za</span></div><button onClick={() => { navigate('settings'); setUserMenu(false); }}><Settings size={16} />Workspace settings</button><button onClick={() => { setLocked(true); setUserMenu(false); }}><LockKeyhole size={16} />Lock workspace</button></div>}</div>
      </div></header>
      <div className="page-content">
        {view === 'overview' && <Overview employees={employees} onOpen={openEmployee} onDirectory={openDirectory} onAdd={() => setEmployeeModal('add')} onExport={() => exportCsv(employees)} />}
        {view === 'directory' && <Directory key={directoryStatus || 'default'} employees={employees} branches={branches} initialStatus={directoryStatus} onOpen={openEmployee} onAdd={() => setEmployeeModal('add')} onExport={list => exportCsv(list, 'peopleflow-directory')} />}
        {view === 'profile' && selected && <Profile employee={selected} branches={branches} customFields={customFields} onBack={() => navigate('directory')} onEdit={() => setEmployeeModal('edit')} onUpdate={updateEmployee} onBranch={() => openBranch(selected.branchId)} notify={notify} />}
        {view === 'branches' && <Branches employees={employees} branches={branches} selectedId={selectedBranchId} onSelect={setSelectedBranchId} onOpenEmployee={openEmployee} onSaveBranch={saveBranch} onDeleteBranch={deleteBranch} onAssign={assignBranch} onExport={(branch, members) => exportCsv(members, branch.name.toLowerCase())} />}
        {view === 'timesheets' && <Timesheets employees={employees} branches={branches} entries={timeEntries} onSave={saveTimeEntry} onDelete={id => { setTimeEntries(list => list.filter(entry => entry.id !== id)); notify('Session removed'); }} onApprove={approveTimeEntries} onExport={rows => { downloadFile(new Blob(['\ufeff' + exportTimesheets(rows, employees, branches)], { type: 'text/csv;charset=utf-8' }), `peopleflow-timesheets-${today}.csv`); notify(`${rows.length} sessions exported`); }} notify={notify} />}
        {view === 'attendance' && <Attendance employees={employees} branches={branches} entries={timeEntries} leaveRequests={leaveRequests} onSave={saveTimeEntry} onDelete={id => setTimeEntries(list => list.filter(entry => entry.id !== id))} onManageEmployees={() => navigate('directory')} notify={notify} />}
        {view === 'leave' && <Leave employees={employees} branches={branches} requests={leaveRequests} onSave={saveLeave} onUpdate={updateLeave} onDelete={id => { setLeaveRequests(list => list.filter(request => request.id !== id)); notify('Leave request deleted'); }} notify={notify} />}
        {view === 'payslips' && <Payslips employees={employees} branches={branches} payslips={payslips} onGenerate={savePayslips} onUpdate={updatePayslip} onDelete={id => { setPayslips(list => list.filter(slip => slip.id !== id)); notify('Payslip deleted'); }} notify={notify} />}
        {view === 'warnings' && <WarningsPage employees={employees} branches={branches} warnings={warnings} onSave={saveWarning} onUpdate={updateWarning} onDelete={id => { setWarnings(list => list.filter(warning => warning.id !== id)); notify('Warning deleted'); }} notify={notify} />}
        {view === 'settings' && <SettingsPage customFields={customFields} onAdd={field => { setCustomFields(list => [...list, field]); notify('Custom field added'); }} onDelete={id => { const field = customFields.find(item => item.id === id); setCustomFields(list => list.filter(item => item.id !== id)); if (field) setEmployees(list => list.map(employee => { const custom = { ...employee.custom }; delete custom[field.label]; return { ...employee, custom }; })); notify('Custom field removed'); }} onBackup={backup} onImport={chooseImport} onReset={clearWorkspace} notify={notify} />}
      </div>
      <footer className="app-footer"><span><Cloud size={14} />All changes saved locally</span><span>Peopleflow · Your people, organised.</span></footer>
    </main>
    {employeeModal && <EmployeeForm employee={employeeModal === 'edit' ? selected : undefined} customFields={customFields} branches={branches} onClose={() => setEmployeeModal(false)} onSave={saveEmployee} />}
    <input ref={importRef} type="file" accept=".zip,.json,application/zip,application/json" hidden onChange={handleImportFile} />
    {importPreview && <ImportModal data={importPreview} onCancel={() => setImportPreview(undefined)} onConfirm={applyImport} />}
    {toast && <div className="toast"><span><Check size={15} /></span>{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={15} /></button></div>}
  </div>;
}

function NavItem({ icon, label, active, badge, onClick }: { icon: React.ReactNode; label: string; active: boolean; badge?: number; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{badge !== undefined && <b>{badge}</b>}</button>;
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  return <div className="lock-screen"><form className="lock-card" onSubmit={event => { event.preventDefault(); onUnlock(); }}><div className="lock-icon"><LockKeyhole size={25} /></div><h1>Welcome back, Sarah</h1><p>Your private HR workspace is locked.</p><div className="lock-user"><div className="user-avatar">SN</div><div><strong>Sarah Ndlovu</strong><span>HR Administrator</span></div></div><label className="field"><span>Password</span><input type="password" required autoFocus value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" /></label><button className="btn btn-primary">Unlock workspace</button><small><ShieldCheck size={14} />Authorised HR users only</small></form><p className="lock-foot">Employee information is personal. Handle it with care.</p></div>;
}

function ImportModal({ data, onCancel, onConfirm }: { data: WorkspaceImport; onCancel: () => void; onConfirm: () => void }) {
  const files = data.counts.documents + data.counts.photos;
  const size = data.bytes > 1024 * 1024 ? `${(data.bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(data.bytes / 1024))} KB`;
  const large = data.bytes > 3500000;
  return <Modal title="Import this backup?" subtitle="Review what will be restored before replacing your workspace" onClose={onCancel}>
    <div className="modal-body">
      <div className="import-counts">
        <div><strong>{data.counts.employees}</strong><span>employees</span></div>
        <div><strong>{data.counts.branches}</strong><span>branches</span></div>
        <div><strong>{data.counts.customFields}</strong><span>custom fields</span></div>
        <div><strong>{files}</strong><span>stored files</span></div>
      </div>
      <p className="import-breakdown">Also includes {data.counts.timeEntries} time entries, {data.counts.leaveRequests} leave requests, {data.counts.payslips} payslips, and {data.counts.warnings} warnings.</p>
      <div className="import-note"><AlertTriangle size={17} /><p>Everything currently in this browser — employees, branches, time, leave, payslips, warnings, documents, and photos — will be replaced by this backup. Only workspace data is imported; the app itself is left untouched.</p></div>
      {data.source === 'json' && <p className="import-warning">This is an older JSON backup, so document and photo files were not included. Their details will be restored without the original files.</p>}
      {data.notices.map(notice => <p className="import-warning" key={notice}>{notice}</p>)}
      {large && <p className="import-warning">This backup is {size}. Browser storage is limited (about 5 MB), so some large files may not be saved after a reload.</p>}
      {!large && data.bytes > 0 && <p className="import-meta">Files to restore: {size}</p>}
    </div>
    <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="button" className="btn btn-danger" onClick={onConfirm}><Upload size={16} />Import and replace</button></div>
  </Modal>;
}
