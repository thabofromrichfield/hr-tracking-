import { useEffect, useState } from 'react';
import { ChevronDown, Download, Filter, Plus, SlidersHorizontal, UsersRound, X } from 'lucide-react';
import { EmployeeTable, ExportMenu, SearchInput } from './components';
import { departments } from './data';
import { Branch, Employee } from './types';

export default function Directory({ employees, branches, initialStatus, onOpen, onAdd, onExport }: {
  employees: Employee[]; branches: Branch[]; initialStatus?: string; onOpen: (id: string) => void; onAdd: () => void; onExport: (employees: Employee[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(initialStatus || 'Current employees');
  const [type, setType] = useState('All types');
  const [department, setDepartment] = useState('All departments');
  const [branch, setBranch] = useState('All branches');
  const [sort, setSort] = useState('Name A–Z');
  const [exportOpen, setExportOpen] = useState(false);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.export-menu, .directory-export-trigger')) setExportOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const filtered = employees.filter(e => {
    const q = query.toLowerCase();
    const matchesQuery = !q || [e.fullName, e.idNumber, e.employeeNumber, e.department, e.jobTitle, e.email].some(v => v.toLowerCase().includes(q));
    const matchesStatus = status === 'All statuses' || (status === 'Current employees' ? e.status === 'Active' || e.status === 'On leave' : e.status === status);
    return matchesQuery && matchesStatus && (type === 'All types' || e.employmentType === type) && (department === 'All departments' || e.department === department) && (branch === 'All branches' || e.branchId === branch);
  }).sort((a, b) => sort === 'Name A–Z' ? a.fullName.localeCompare(b.fullName) : sort === 'Newest first' ? b.startDate.localeCompare(a.startDate) : a.department.localeCompare(b.department));
  const hasFilters = query || status !== 'Current employees' || type !== 'All types' || department !== 'All departments' || branch !== 'All branches';
  const reset = () => { setQuery(''); setStatus('Current employees'); setType('All types'); setDepartment('All departments'); setBranch('All branches'); };
  return <div className="directory-page"><div className="page-heading"><div><div className="eyebrow">YOUR PEOPLE</div><h1>Employee directory</h1><p>Find, view, and manage everyone in your organisation.</p></div><div className="heading-actions"><div className="relative"><button className="btn btn-secondary directory-export-trigger" onClick={() => setExportOpen(!exportOpen)}><Download size={16} />Export list<ChevronDown size={13} /></button>{exportOpen && <ExportMenu onCsv={() => onExport(filtered)} onPrint={() => window.print()} onClose={() => setExportOpen(false)} />}</div><button className="btn btn-primary" onClick={onAdd}><Plus size={18} />Add employee</button></div></div>
    <section className="card directory-card"><div className="directory-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search name, ID, role, or department..." /><label className="sort-select"><span>Sort:</span><select value={sort} onChange={e => setSort(e.target.value)}><option>Name A–Z</option><option>Newest first</option><option>Department</option></select><ChevronDown size={14} /></label></div>
      <div className="filter-bar"><div className="filters-label"><SlidersHorizontal size={16} /><span>Filters</span></div><select value={status} onChange={e => setStatus(e.target.value)}><option>Current employees</option><option>All statuses</option><option>Active</option><option>On leave</option><option>Resigned</option><option>Terminated</option></select><select value={department} onChange={e => setDepartment(e.target.value)}><option>All departments</option>{departments.map(d => <option key={d}>{d}</option>)}</select><select value={type} onChange={e => setType(e.target.value)}><option>All types</option><option>Full-time</option><option>Part-time</option><option>Contract</option></select><select value={branch} onChange={e => setBranch(e.target.value)}><option>All branches</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{hasFilters && <button className="clear-filters" onClick={reset}><X size={14} />Clear</button>}</div>
      <div className="results-bar"><span><strong>{filtered.length}</strong> {filtered.length === 1 ? 'employee' : 'employees'}</span><span>{status === 'Current employees' ? 'Showing current team members' : status === 'All statuses' ? 'Including former employees' : `Showing ${status.toLowerCase()} employees`}</span></div>
      {employees.length === 0 ? <div className="empty-workspace"><div className="empty-workspace-icon"><UsersRound size={24} /></div><h3>No employees in your workspace</h3><p>Add your first employee and the directory will start filling up.</p><button className="btn btn-primary" onClick={onAdd}><Plus size={16} />Add employee</button></div> : <EmployeeTable employees={filtered} onOpen={onOpen} branches={branches} />}
      <div className="table-footer"><span>Showing {filtered.length} of {employees.length} total records</span><span>Peopleflow HR · Private workspace</span></div>
    </section>
  </div>;
}
